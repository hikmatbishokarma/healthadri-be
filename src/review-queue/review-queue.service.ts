import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ReviewBatch, ReviewBatchDocument, ReviewBatchStatus } from './schemas/review-batch.schema';
import {
  AiExtractedTask,
  AiExtractedTaskDocument,
  ReviewStatus,
} from './schemas/ai-extracted-task.schema';
import { UsersService } from '../users/users.service';
import { CarePlanService } from '../care-plan/care-plan.service';
import { CarePlanTask } from '../care-plan/schemas/care-plan-task.schema';
import { CreateCarePlanTaskDto } from '../care-plan/dto/create-care-plan-task.dto';
import { VersionDiffEntry } from '../care-plan/schemas/care-plan-version.schema';

export interface RichExtractedTask {
  taskType: string;
  confidence: number;
  sourceText: string;
  extractedData: Record<string, unknown>;
}

export interface TaskDiff {
  changeType: 'ADDED' | 'CHANGED';
  previousValue: string | null;
}

@Injectable()
export class ReviewQueueService {
  constructor(
    @InjectModel(ReviewBatch.name) private batchModel: Model<ReviewBatchDocument>,
    @InjectModel(AiExtractedTask.name) private taskModel: Model<AiExtractedTaskDocument>,
    private usersService: UsersService,
    private carePlanService: CarePlanService,
  ) {}

  async createBatch(
    patientId: string,
    documentId: string,
    richTasks: RichExtractedTask[],
  ): Promise<ReviewBatch | null> {
    if (richTasks.length === 0) return null;

    const patient = await this.usersService.findById(patientId);
    const navigatorId = patient?.assignedNavigatorId?.toString();
    if (!navigatorId) return null;

    const taskTypeCounts = { MEDICATION: 0, LAB_TEST: 0, APPOINTMENT: 0, PROCEDURE: 0 };
    const taskPills: { name: string; taskType: string }[] = [];
    let hasLowConfidence = false;

    for (const t of richTasks) {
      const type = t.taskType as keyof typeof taskTypeCounts;
      if (type in taskTypeCounts) taskTypeCounts[type]++;
      if (t.confidence < 0.75) hasLowConfidence = true;
      if (taskPills.length < 3) {
        const name = this.extractTaskName(t.taskType, t.extractedData);
        if (name) taskPills.push({ name, taskType: t.taskType });
      }
    }

    const batch = await this.batchModel.create({
      patientId: new Types.ObjectId(patientId),
      documentId: new Types.ObjectId(documentId),
      navigatorId: new Types.ObjectId(navigatorId),
      status: ReviewBatchStatus.PENDING,
      taskCount: richTasks.length,
      taskTypeCounts,
      taskPills,
      hasLowConfidence,
    });

    const taskDocs = richTasks.map((t) => ({
      reviewBatchId: batch._id,
      patientId: new Types.ObjectId(patientId),
      documentId: new Types.ObjectId(documentId),
      taskType: t.taskType,
      confidence: t.confidence,
      sourceText: t.sourceText,
      extractedData: t.extractedData,
      reviewStatus: ReviewStatus.AI_GENERATED,
    }));

    await this.taskModel.insertMany(taskDocs);
    return batch;
  }

  async getMetrics(navigatorId: string): Promise<{
    total: number;
    pending: number;
    inReview: number;
    reviewed: number;
  }> {
    const result = await this.batchModel.aggregate<{ _id: string; count: number }>([
      {
        $match: {
          navigatorId: new Types.ObjectId(navigatorId),
          status: { $ne: ReviewBatchStatus.PUBLISHED },
        },
      },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const counts = { total: 0, pending: 0, inReview: 0, reviewed: 0 };
    for (const r of result) {
      if (r._id === ReviewBatchStatus.PENDING) {
        counts.pending = r.count;
        counts.total += r.count;
      } else if (r._id === ReviewBatchStatus.IN_REVIEW) {
        counts.inReview = r.count;
        counts.total += r.count;
      } else if (r._id === ReviewBatchStatus.REVIEWED) {
        counts.reviewed = r.count;
        counts.total += r.count;
      }
    }
    return counts;
  }

  async getSummaryList(
    navigatorId: string,
    filter: string,
    page: number,
    limit: number,
  ): Promise<{ total: number; batches: unknown[] }> {
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const safePage = Math.max(page, 1);

    const query: Record<string, unknown> = {
      navigatorId: new Types.ObjectId(navigatorId),
      status: { $ne: ReviewBatchStatus.PUBLISHED },
    };

    switch (filter) {
      case 'pending':
        query.status = ReviewBatchStatus.PENDING;
        break;
      case 'in_review':
        query.status = ReviewBatchStatus.IN_REVIEW;
        break;
      case 'reviewed':
        query.status = ReviewBatchStatus.REVIEWED;
        break;
      case 'medication':
        query['taskTypeCounts.MEDICATION'] = { $gt: 0 };
        delete query.status;
        query.status = { $ne: ReviewBatchStatus.PUBLISHED };
        break;
      case 'appointment':
        query['taskTypeCounts.APPOINTMENT'] = { $gt: 0 };
        delete query.status;
        query.status = { $ne: ReviewBatchStatus.PUBLISHED };
        break;
      case 'lab_test':
        query['taskTypeCounts.LAB_TEST'] = { $gt: 0 };
        delete query.status;
        query.status = { $ne: ReviewBatchStatus.PUBLISHED };
        break;
      case 'needs_verification':
        query.hasLowConfidence = true;
        delete query.status;
        query.status = { $ne: ReviewBatchStatus.PUBLISHED };
        break;
    }

    const [total, rawBatches] = await Promise.all([
      this.batchModel.countDocuments(query),
      this.batchModel
        .find(query)
        .populate('patientId', 'name patientCode cancerType cancerStage')
        .populate('documentId', 'fileName category createdAt fileSize')
        .sort({ createdAt: -1 })
        .skip((safePage - 1) * safeLimit)
        .limit(safeLimit)
        .lean(),
    ]);

    const typed = rawBatches as unknown as (Record<string, unknown> & { _id: Types.ObjectId })[];

    // Identify legacy batches that were created before taskTypeCounts/taskPills were added
    const legacyIds = typed
      .filter((b) => {
        const tc = b.taskTypeCounts as Record<string, number> | undefined;
        const pills = b.taskPills as unknown[] | undefined;
        const hasNoCounts = !tc || (tc.MEDICATION === 0 && tc.LAB_TEST === 0 && tc.APPOINTMENT === 0 && tc.PROCEDURE === 0);
        return hasNoCounts && (!pills || pills.length === 0) && (b.taskCount as number) > 0;
      })
      .map((b) => b._id);

    // Enrich all legacy batches in a single aggregation
    const enrichMap = new Map<string, { taskTypeCounts: Record<string, number>; taskPills: { name: string; taskType: string }[] }>();

    if (legacyIds.length > 0) {
      const agg = await this.taskModel.aggregate<{
        _id: Types.ObjectId;
        counts: { taskType: string; count: number; firstName: string }[];
      }>([
        { $match: { reviewBatchId: { $in: legacyIds } } },
        {
          $group: {
            _id: { batchId: '$reviewBatchId', taskType: '$taskType' },
            count: { $sum: 1 },
            firstName: { $first: '$extractedData' },
          },
        },
        {
          $group: {
            _id: '$_id.batchId',
            counts: {
              $push: { taskType: '$_id.taskType', count: '$count', firstName: '$firstName' },
            },
          },
        },
      ]);

      for (const row of agg) {
        const taskTypeCounts = { MEDICATION: 0, LAB_TEST: 0, APPOINTMENT: 0, PROCEDURE: 0 } as Record<string, number>;
        const taskPills: { name: string; taskType: string }[] = [];

        for (const c of row.counts) {
          if (c.taskType in taskTypeCounts) taskTypeCounts[c.taskType] = c.count;
          if (taskPills.length < 3) {
            const name = this.extractTaskName(c.taskType, c.firstName as unknown as Record<string, unknown>);
            if (name) taskPills.push({ name, taskType: c.taskType });
          }
        }

        enrichMap.set(row._id.toString(), { taskTypeCounts, taskPills });
      }
    }

    const batches = typed.map((b) => {
      const enrich = enrichMap.get(b._id.toString());
      return {
        ...b,
        taskTypeCounts: enrich?.taskTypeCounts ?? b.taskTypeCounts,
        taskPills: enrich?.taskPills ?? b.taskPills,
        patient: b.patientId,
        document: b.documentId,
      };
    });

    return { total, batches };
  }

  async getPendingBatches(navigatorId: string): Promise<ReviewBatch[]> {
    return this.batchModel
      .find({
        navigatorId: new Types.ObjectId(navigatorId),
        status: { $in: [ReviewBatchStatus.PENDING, ReviewBatchStatus.IN_REVIEW] },
      })
      .populate('patientId', 'name patientCode phone cancerType')
      .populate('documentId', 'fileName category createdAt')
      .sort({ createdAt: -1 })
      .lean();
  }

  async getAllBatches(navigatorId: string): Promise<ReviewBatch[]> {
    return this.batchModel
      .find({ navigatorId: new Types.ObjectId(navigatorId) })
      .populate('patientId', 'name patientCode phone cancerType')
      .populate('documentId', 'fileName category createdAt')
      .sort({ createdAt: -1 })
      .lean();
  }

  async getBatch(batchId: string): Promise<{ batch: Record<string, unknown>; tasks: (AiExtractedTask & { diff: TaskDiff })[] }> {
    const batch = await this.batchModel
      .findById(batchId)
      .populate('patientId', 'name patientCode phone cancerType cancerStage')
      .populate('documentId', 'fileName category createdAt fileSize')
      .lean();

    if (!batch) throw new NotFoundException('Review batch not found');

    const tasks = await this.taskModel
      .find({ reviewBatchId: new Types.ObjectId(batchId) })
      .sort({ createdAt: 1 })
      .lean();

    // When populated, patientId is the full user object; extract _id safely
    const patientRaw = batch.patientId as unknown as { _id?: Types.ObjectId } | Types.ObjectId;
    const patientIdStr = (patientRaw as { _id?: Types.ObjectId })?._id?.toString()
      ?? (patientRaw as Types.ObjectId)?.toString()
      ?? '';

    const activePlanResult = await this.carePlanService.getActiveTasksForPatient(patientIdStr);
    const activeTasks = activePlanResult ?? [];

    const tasksWithDiff = tasks.map((task) => ({
      ...task,
      diff: this.computeDiff(task, activeTasks),
    }));

    // Remap populated fields to match frontend contract
    const batchForResponse = {
      ...(batch as unknown as Record<string, unknown>),
      patient: batch.patientId,
      document: batch.documentId,
    };

    return { batch: batchForResponse, tasks: tasksWithDiff };
  }

  private async taskWithDiff(task: AiExtractedTaskDocument): Promise<AiExtractedTask & { diff: TaskDiff }> {
    const batch = await this.batchModel.findById(task.reviewBatchId).lean();
    const patientId = batch?.patientId?.toString() ?? '';
    const activeTasks = patientId
      ? ((await this.carePlanService.getActiveTasksForPatient(patientId)) ?? [])
      : [];
    return { ...(task.toObject ? task.toObject() : task), diff: this.computeDiff(task, activeTasks) };
  }

  async verifyTask(taskId: string, navigatorId: string): Promise<AiExtractedTask & { diff: TaskDiff }> {
    const task = await this.taskModel.findById(taskId);
    if (!task) throw new NotFoundException('Task not found');
    if (task.reviewStatus === ReviewStatus.REJECTED) {
      throw new BadRequestException('Cannot verify a rejected task');
    }

    task.reviewStatus = ReviewStatus.VERIFIED;
    task.reviewedBy = new Types.ObjectId(navigatorId);
    task.reviewedAt = new Date();
    await task.save();

    await this.updateBatchCounts(task.reviewBatchId.toString());
    return this.taskWithDiff(task);
  }

  async editTask(
    taskId: string,
    navigatorId: string,
    edits: Record<string, unknown>,
  ): Promise<AiExtractedTask & { diff: TaskDiff }> {
    const task = await this.taskModel.findById(taskId);
    if (!task) throw new NotFoundException('Task not found');
    if (task.reviewStatus === ReviewStatus.REJECTED) {
      throw new BadRequestException('Cannot edit a rejected task');
    }

    task.reviewStatus = ReviewStatus.EDITED;
    task.navigatorEdits = edits;
    task.extractedData = { ...task.extractedData, ...edits };
    task.reviewedBy = new Types.ObjectId(navigatorId);
    task.reviewedAt = new Date();
    await task.save();

    await this.updateBatchCounts(task.reviewBatchId.toString());
    return this.taskWithDiff(task);
  }

  async rejectTask(taskId: string, navigatorId: string): Promise<AiExtractedTask & { diff: TaskDiff }> {
    const task = await this.taskModel.findById(taskId);
    if (!task) throw new NotFoundException('Task not found');

    task.reviewStatus = ReviewStatus.REJECTED;
    task.reviewedBy = new Types.ObjectId(navigatorId);
    task.reviewedAt = new Date();
    await task.save();

    await this.updateBatchCounts(task.reviewBatchId.toString());
    return this.taskWithDiff(task);
  }

  async markBatchInReview(batchId: string): Promise<void> {
    await this.batchModel.findByIdAndUpdate(batchId, {
      status: ReviewBatchStatus.IN_REVIEW,
    });
  }

  async publishBatch(batchId: string, navigatorId: string) {
    const batch = await this.batchModel.findById(batchId);
    if (!batch) throw new NotFoundException('Review batch not found');
    if (batch.status === ReviewBatchStatus.PUBLISHED) {
      throw new BadRequestException('Batch already published');
    }

    const tasks = await this.taskModel
      .find({ reviewBatchId: new Types.ObjectId(batchId) })
      .lean();

    const unreviewedCount = tasks.filter(
      (t) => t.reviewStatus === ReviewStatus.AI_GENERATED || t.reviewStatus === ReviewStatus.UNDER_REVIEW,
    ).length;

    if (unreviewedCount > 0) {
      throw new BadRequestException(
        `${unreviewedCount} task${unreviewedCount === 1 ? '' : 's'} still pending review — review all tasks before publishing`,
      );
    }

    const verifiedTasks = tasks.filter(
      (t) => t.reviewStatus === ReviewStatus.VERIFIED || t.reviewStatus === ReviewStatus.EDITED,
    );

    if (verifiedTasks.length === 0) {
      throw new BadRequestException('No verified tasks — at least one task must be verified to create a care plan');
    }

    // Capture current active tasks before creating the draft (used for diff)
    const activeTasks = await this.carePlanService.getActiveTasksForPatient(batch.patientId.toString());

    const carePlanTasks: CreateCarePlanTaskDto[] = verifiedTasks.map((t) => {
      const data = t.extractedData as Record<string, unknown>;

      let schedule: Record<string, unknown> | undefined;
      let endDate: string | undefined = this.extractDate(data, 'scheduledDate');

      if (t.taskType === 'MEDICATION') {
        const times = this.parseMedicationTimes(data);
        schedule = { times, intervalDays: 1, notifyBeforeMinutes: 15 };

        // Derive endDate from duration if not already set (e.g. "30 days" → today + 30)
        if (!endDate) {
          const durationStr = typeof data.duration === 'string' ? data.duration : '';
          const daysMatch = durationStr.match(/(\d+)\s*days?/i);
          if (daysMatch) {
            const end = new Date();
            end.setDate(end.getDate() + parseInt(daysMatch[1], 10));
            endDate = end.toISOString().split('T')[0];
          }
        }
      }

      return {
        type: t.taskType,
        title: this.deriveTitle(t.taskType, data),
        severity: 'MEDIUM',
        taskData: data,
        schedule,
        startDate: new Date().toISOString().split('T')[0],
        endDate,
        sourceExtractedTaskId: (t as unknown as { _id: { toString(): string } })._id.toString(),
      };
    });

    const { version } = await this.carePlanService.createDraft(
      batch.patientId.toString(),
      batchId,
      carePlanTasks,
    );

    const versionDiff = this.buildVersionDiff(verifiedTasks, activeTasks, carePlanTasks);
    const versionId = (version as unknown as { _id: { toString(): string } })._id.toString();

    const published = await this.carePlanService.publishVersion(
      versionId,
      { navigatorId },
      versionDiff,
    );

    await this.batchModel.findByIdAndUpdate(batchId, {
      status: ReviewBatchStatus.PUBLISHED,
      reviewedBy: new Types.ObjectId(navigatorId),
      reviewedAt: new Date(),
    });

    await this.taskModel.updateMany(
      {
        reviewBatchId: new Types.ObjectId(batchId),
        reviewStatus: { $in: [ReviewStatus.VERIFIED, ReviewStatus.EDITED] },
      },
      { reviewStatus: 'PUBLISHED' },
    );

    return published;
  }

  private buildVersionDiff(
    verifiedTasks: AiExtractedTask[],
    activeTasks: CarePlanTask[],
    carePlanTasks: CreateCarePlanTaskDto[],
  ): VersionDiffEntry[] {
    return verifiedTasks.map((extracted, i) => {
      const taskDiff = this.computeDiff(extracted, activeTasks);
      const title = carePlanTasks[i].title;

      if (taskDiff.changeType === 'ADDED') {
        return { title, changeType: 'ADDED' as const };
      }

      const data = extracted.extractedData as Record<string, unknown>;
      return {
        title,
        changeType: 'CHANGED' as const,
        previousValue: taskDiff.previousValue ?? undefined,
        currentValue: this.deriveCurrentValue(extracted.taskType, data),
      };
    });
  }

  private deriveCurrentValue(taskType: string, data: Record<string, unknown>): string | undefined {
    if (taskType === 'MEDICATION') {
      const parts = [data.dosage, data.frequency].filter(Boolean) as string[];
      return parts.length > 0 ? parts.join(' ') : undefined;
    }
    return undefined;
  }

  private computeDiff(
    extracted: AiExtractedTask,
    activeTasks: CarePlanTask[],
  ): TaskDiff {
    const data = extracted.extractedData as Record<string, unknown>;
    let matchKey: string | null = null;

    switch (extracted.taskType) {
      case 'MEDICATION':
        matchKey = typeof data.medicineName === 'string' ? data.medicineName.toLowerCase().trim() : null;
        break;
      case 'LAB_TEST':
        matchKey = typeof data.testName === 'string' ? data.testName.toLowerCase().trim() : null;
        break;
      case 'APPOINTMENT':
        matchKey = typeof data.specialty === 'string' ? data.specialty.toLowerCase().trim() : null;
        break;
    }

    if (!matchKey) return { changeType: 'ADDED', previousValue: null };

    const match = (activeTasks as unknown as (CarePlanTask & { taskData?: Record<string, unknown>; type?: string })[])
      .find((t) => {
        if (t.type !== extracted.taskType) return false;
        const td = (t.taskData ?? {}) as Record<string, unknown>;
        switch (extracted.taskType) {
          case 'MEDICATION':
            return (td.medicineName as string | undefined)?.toLowerCase().trim() === matchKey;
          case 'LAB_TEST':
            return (td.testName as string | undefined)?.toLowerCase().trim() === matchKey;
          case 'APPOINTMENT':
            return (td.specialty as string | undefined)?.toLowerCase().trim() === matchKey;
          default:
            return false;
        }
      });

    if (!match) return { changeType: 'ADDED', previousValue: null };

    const td = ((match as unknown as { taskData?: Record<string, unknown> }).taskData ?? {}) as Record<string, unknown>;
    let previousValue: string | null = null;
    if (extracted.taskType === 'MEDICATION') {
      const parts = [td.dosage, td.frequency].filter(Boolean);
      previousValue = parts.length > 0 ? (parts as string[]).join(' ') : null;
    }

    return { changeType: 'CHANGED', previousValue };
  }

  private extractTaskName(taskType: string, data: Record<string, unknown>): string | null {
    switch (taskType) {
      case 'MEDICATION':
        return typeof data.medicineName === 'string' ? data.medicineName : null;
      case 'LAB_TEST':
        return typeof data.testName === 'string' ? data.testName : null;
      case 'APPOINTMENT':
        return typeof data.specialty === 'string'
          ? data.specialty
          : typeof data.doctorName === 'string'
          ? data.doctorName
          : null;
      case 'PROCEDURE':
        return typeof data.procedureName === 'string' ? data.procedureName : null;
      default:
        return null;
    }
  }

  private deriveTitle(taskType: string, data: Record<string, unknown>): string {
    switch (taskType) {
      case 'MEDICATION':
        return data.medicineName
          ? `${data.medicineName}${data.dosage ? ' ' + data.dosage : ''}`
          : 'Medication';
      case 'LAB_TEST':
        return (data.testName as string) || 'Lab Test';
      case 'APPOINTMENT':
        return data.doctorName
          ? `Appointment with ${data.doctorName}`
          : (data.specialty as string) || 'Appointment';
      case 'PROCEDURE':
        return (data.procedureName as string) || 'Procedure';
      default:
        return 'Task';
    }
  }

  private extractDate(data: Record<string, unknown>, key: string): string | undefined {
    const val = data[key];
    return typeof val === 'string' && val ? val : undefined;
  }

  private parseMedicationTimes(data: Record<string, unknown>): string[] {
    const timing = typeof data.timing === 'string' ? data.timing.toLowerCase().trim() : '';
    const frequency = typeof data.frequency === 'string' ? data.frequency.toLowerCase().trim() : '';
    const combined = `${timing} ${frequency}`;

    // ── 1. Explicit timing words take priority ─────────────────────────────────

    // Multi-time keywords
    if (/morning.*(evening|night|dinner)|evening.*morning|(twice|bd|bid)/.test(combined)) {
      return ['08:00', '20:00'];
    }
    if (/morning.*afternoon.*night|three.*times|tds|tid/.test(combined)) {
      return ['08:00', '13:00', '20:00'];
    }
    if (/four.*times|qid/.test(combined)) {
      return ['08:00', '12:00', '16:00', '20:00'];
    }

    // Single-time keywords
    if (/bed\s?time|bedtime|\bhs\b/.test(combined))                             return ['22:00'];
    if (/before\s+dinner|with\s+dinner|after\s+dinner|\bdinner\b/.test(combined)) return ['20:00'];
    if (/before\s+lunch|with\s+lunch|after\s+lunch|\blunch\b/.test(combined))   return ['13:00'];
    if (/\bnight\b/.test(combined))                                              return ['20:00'];
    if (/\bevening\b/.test(combined))                                            return ['18:00'];
    if (/\bafternoon\b/.test(combined))                                          return ['13:00'];
    if (/\bmorning\b|before\s+breakfast|with\s+breakfast/.test(combined))       return ['08:00'];

    // ── 2. ODS fallback: Morning-Afternoon-Night dose counts (0-0-1, 2-2-0…) ──
    // Only used when no explicit timing words found above
    const odsMatch = timing.match(/^(\d+)-(\d+)-(\d+)$/) || frequency.match(/^(\d+)-(\d+)-(\d+)$/);
    if (odsMatch) {
      const times: string[] = [];
      if (parseInt(odsMatch[1]) > 0) times.push('08:00'); // morning
      if (parseInt(odsMatch[2]) > 0) times.push('13:00'); // afternoon
      if (parseInt(odsMatch[3]) > 0) times.push('20:00'); // night
      if (times.length) return times;
    }

    // ── 3. Default ─────────────────────────────────────────────────────────────
    return ['09:00'];
  }

  private async updateBatchCounts(batchId: string): Promise<void> {
    const [verified, rejected, total] = await Promise.all([
      this.taskModel.countDocuments({
        reviewBatchId: new Types.ObjectId(batchId),
        reviewStatus: { $in: [ReviewStatus.VERIFIED, ReviewStatus.EDITED] },
      }),
      this.taskModel.countDocuments({
        reviewBatchId: new Types.ObjectId(batchId),
        reviewStatus: ReviewStatus.REJECTED,
      }),
      this.taskModel.countDocuments({
        reviewBatchId: new Types.ObjectId(batchId),
      }),
    ]);

    const allReviewed = verified + rejected === total;
    await this.batchModel.findByIdAndUpdate(batchId, {
      verifiedCount: verified,
      rejectedCount: rejected,
      status: allReviewed ? ReviewBatchStatus.REVIEWED : ReviewBatchStatus.IN_REVIEW,
    });
  }
}
