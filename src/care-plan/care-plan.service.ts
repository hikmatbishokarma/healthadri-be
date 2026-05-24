import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  CarePlanVersion,
  CarePlanVersionDocument,
  CarePlanVersionStatus,
  VersionDiffEntry,
} from './schemas/care-plan-version.schema';
import {
  CarePlanTask,
  CarePlanTaskDocument,
  CarePlanTaskStatus,
} from './schemas/care-plan-task.schema';
import { CreateCarePlanTaskDto } from './dto/create-care-plan-task.dto';
import { UpdateCarePlanTaskDto } from './dto/update-care-plan-task.dto';
import { PublishVersionDto } from './dto/publish-version.dto';
import { UsersService } from '../users/users.service';
import { TimelineService } from '../timeline/timeline.service';
import { TimelineEventType } from '../timeline/timeline.schema';
import { EventsGateway } from '../events/events.gateway';

export interface CarePlanSummaryItem {
  patientId: string;
  name: string;
  patientCode: string;
  cancerType?: string;
  cancerStage?: string;
  acuityScore: number;
  treatmentStatus?: string;
  chemoSessionsCompleted?: number;
  chemoSessionsTotal?: number;
  versionId: string;
  versionNumber: number;
  lastUpdatedAt: Date;
  publishedAt: Date | null;
  activeMedications: { title: string; medicineName?: string; dosage?: string }[];
  nextTask: { type: string; title: string; dueDate: Date } | null;
  attentionItems: { count: number; label: string };
}

@Injectable()
export class CarePlanService {
  constructor(
    @InjectModel(CarePlanVersion.name) private versionModel: Model<CarePlanVersionDocument>,
    @InjectModel(CarePlanTask.name) private taskModel: Model<CarePlanTaskDocument>,
    private usersService: UsersService,
    private timelineService: TimelineService,
    private eventsGateway: EventsGateway,
  ) {}

  // ── Draft creation ──────────────────────────────────────────────────────────

  async createDraft(
    patientId: string,
    sourceBatchId: string | null,
    tasks: CreateCarePlanTaskDto[],
  ): Promise<{ version: CarePlanVersion; tasks: CarePlanTask[] }> {
    const nextVersion = await this.nextVersionNumber(patientId);
    const previousActive = await this.findActive(patientId);

    const version = await this.versionModel.create({
      patientId: new Types.ObjectId(patientId),
      versionNumber: nextVersion,
      previousVersionId: previousActive
        ? (previousActive as unknown as { _id: Types.ObjectId })._id
        : null,
      status: CarePlanVersionStatus.DRAFT,
      sourceBatchId: sourceBatchId ? new Types.ObjectId(sourceBatchId) : null,
    });

    const versionId = (version as unknown as { _id: Types.ObjectId })._id.toString();
    const savedTasks = await this.createTasksForVersion(versionId, patientId, tasks);

    return { version, tasks: savedTasks };
  }

  // ── Publish draft → ACTIVE ──────────────────────────────────────────────────

  async publishVersion(
    versionId: string,
    dto: PublishVersionDto,
    versionDiff?: VersionDiffEntry[],
  ): Promise<CarePlanVersion> {
    const version = await this.versionModel.findById(versionId);
    if (!version) throw new NotFoundException('Care plan version not found');
    if (version.status !== CarePlanVersionStatus.DRAFT) {
      throw new BadRequestException(`Version is already ${version.status}`);
    }

    const patientId = version.patientId.toString();

    await this.versionModel.updateMany(
      { patientId: new Types.ObjectId(patientId), status: CarePlanVersionStatus.ACTIVE },
      { status: CarePlanVersionStatus.SUPERSEDED },
    );

    const now = new Date();
    version.status = CarePlanVersionStatus.ACTIVE;
    version.publishedAt = now;
    version.effectiveFrom = dto.effectiveFrom ? new Date(dto.effectiveFrom) : now;
    version.publishedById = new Types.ObjectId(dto.navigatorId);
    version.nextReviewDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    version.visibleToPatient = true;
    if (dto.notes) version.notes = dto.notes;
    if (versionDiff && versionDiff.length > 0) version.versionDiff = versionDiff;
    await version.save();

    await this.usersService.setActiveCarePlan(patientId, versionId);

    await this.timelineService.append({
      patientId,
      eventType: TimelineEventType.CARE_PLAN_PUBLISHED,
      description: `Care plan v${version.versionNumber} published`,
      relatedEntityId: versionId,
      relatedEntityType: 'CarePlanVersion',
      metadata: { versionNumber: version.versionNumber, publishedById: dto.navigatorId },
    });

    this.eventsGateway.emitCarePlanPublished(dto.navigatorId, {
      patientId,
      versionId,
      versionNumber: version.versionNumber,
    });

    return version;
  }

  // ── Task management within a draft ──────────────────────────────────────────

  async addTask(versionId: string, dto: CreateCarePlanTaskDto): Promise<CarePlanTask> {
    const version = await this.versionModel.findById(versionId);
    if (!version) throw new NotFoundException('Care plan version not found');
    if (version.status !== CarePlanVersionStatus.DRAFT) {
      throw new BadRequestException('Can only add tasks to a DRAFT version');
    }

    const [task] = await this.createTasksForVersion(
      versionId,
      version.patientId.toString(),
      [dto],
    );
    return task;
  }

  async updateTask(taskId: string, dto: UpdateCarePlanTaskDto): Promise<CarePlanTask> {
    const task = await this.taskModel.findById(taskId);
    if (!task) throw new NotFoundException('Care plan task not found');

    const version = await this.versionModel.findById(task.carePlanVersionId);
    if (version?.status !== CarePlanVersionStatus.DRAFT) {
      throw new BadRequestException('Can only edit tasks in a DRAFT version');
    }

    const patch: Record<string, unknown> = {};
    if (dto.type !== undefined) patch.type = dto.type;
    if (dto.title !== undefined) patch.title = dto.title;
    if (dto.severity !== undefined) patch.severity = dto.severity;
    if (dto.startDate !== undefined) patch.startDate = new Date(dto.startDate);
    if (dto.endDate !== undefined) patch.endDate = new Date(dto.endDate);
    if (dto.instructions !== undefined) patch.instructions = dto.instructions;
    if (dto.taskData !== undefined) patch.taskData = dto.taskData;
    if (dto.schedule !== undefined) patch.schedule = dto.schedule;

    const updated = await this.taskModel.findByIdAndUpdate(taskId, patch, { new: true });
    if (!updated) throw new NotFoundException('Care plan task not found');
    return updated;
  }

  async removeTask(taskId: string): Promise<void> {
    const task = await this.taskModel.findById(taskId);
    if (!task) throw new NotFoundException('Care plan task not found');

    const version = await this.versionModel.findById(task.carePlanVersionId);
    if (version?.status !== CarePlanVersionStatus.DRAFT) {
      throw new BadRequestException('Can only remove tasks from a DRAFT version');
    }
    await this.taskModel.findByIdAndDelete(taskId);
  }

  // ── Query methods ────────────────────────────────────────────────────────────

  async getVersionsForPatient(patientId: string): Promise<CarePlanVersion[]> {
    return this.versionModel
      .find({ patientId: new Types.ObjectId(patientId) })
      .sort({ versionNumber: -1 })
      .lean();
  }

  async getActiveForPatient(
    patientId: string,
  ): Promise<{ version: CarePlanVersion; tasks: CarePlanTask[] } | null> {
    const version = await this.findActive(patientId);
    if (!version) return null;

    const versionId = (version as unknown as { _id: Types.ObjectId })._id.toString();
    const tasks = await this.taskModel
      .find({
        carePlanVersionId: new Types.ObjectId(versionId),
        status: { $in: [CarePlanTaskStatus.ACTIVE, CarePlanTaskStatus.COMPLETED] },
      })
      .sort({ createdAt: 1 })
      .lean();

    return { version, tasks };
  }

  async getVersion(
    versionId: string,
  ): Promise<{ version: CarePlanVersion; tasks: CarePlanTask[] }> {
    const version = await this.versionModel.findById(versionId).lean();
    if (!version) throw new NotFoundException('Care plan version not found');

    const tasks = await this.taskModel
      .find({ carePlanVersionId: new Types.ObjectId(versionId) })
      .sort({ createdAt: 1 })
      .lean();

    return { version, tasks };
  }

  async getDraftForPatient(patientId: string): Promise<CarePlanVersion | null> {
    return this.versionModel
      .findOne({ patientId: new Types.ObjectId(patientId), status: CarePlanVersionStatus.DRAFT })
      .lean();
  }

  async getActiveCarePlansForNavigator(navigatorId: string): Promise<
    Array<{
      patient: {
        _id: string; name: string; patientCode: string;
        cancerType?: string; cancerStage?: string;
        acuityScore?: number; chemoSessionsCompleted?: number; chemoSessionsTotal?: number;
      };
      version: CarePlanVersion;
      tasks: CarePlanTask[];
    }>
  > {
    const patients = await this.usersService.findPatientsByNavigator(navigatorId);
    if (patients.length === 0) return [];

    const patientIds = (patients as unknown as { _id: Types.ObjectId }[]).map(
      (p) => new Types.ObjectId(p._id.toString()),
    );

    const versions = await this.versionModel
      .find({ patientId: { $in: patientIds }, status: CarePlanVersionStatus.ACTIVE })
      .lean();
    if (versions.length === 0) return [];

    const versionIds = (versions as unknown as { _id: Types.ObjectId }[]).map(
      (v) => new Types.ObjectId(v._id.toString()),
    );

    const allTasks = await this.taskModel
      .find({ carePlanVersionId: { $in: versionIds } })
      .sort({ createdAt: 1 })
      .lean();

    const patientMap = new Map<string, unknown>();
    for (const p of patients as unknown as Record<string, unknown>[]) {
      patientMap.set(String(p._id), p);
    }

    const taskMap = new Map<string, CarePlanTask[]>();
    for (const task of allTasks) {
      const vid = (task as unknown as { carePlanVersionId: Types.ObjectId }).carePlanVersionId.toString();
      if (!taskMap.has(vid)) taskMap.set(vid, []);
      taskMap.get(vid)!.push(task);
    }

    return (versions as unknown as (CarePlanVersion & { _id: Types.ObjectId; patientId: Types.ObjectId })[]).map(
      (v) => {
        const p = patientMap.get(v.patientId.toString()) as Record<string, unknown>;
        return {
          patient: {
            _id: String(p._id),
            name: String(p.name ?? ''),
            patientCode: String(p.patientCode ?? ''),
            cancerType: p.cancerType as string | undefined,
            cancerStage: p.cancerStage as string | undefined,
            acuityScore: p.acuityScore as number | undefined,
            chemoSessionsCompleted: p.chemoSessionsCompleted as number | undefined,
            chemoSessionsTotal: p.chemoSessionsTotal as number | undefined,
          },
          version: v,
          tasks: taskMap.get(v._id.toString()) ?? [],
        };
      },
    );
  }

  // ── Navigator summary stat cards ─────────────────────────────────────────────

  async getNavigatorSummary(navigatorId: string): Promise<{
    activePatients: number;
    needAttention: number;
    upcomingThisWeek: number;
    recentlyUpdated: number;
  }> {
    const patients = await this.usersService.findPatientsByNavigator(navigatorId);
    if (patients.length === 0) {
      return { activePatients: 0, needAttention: 0, upcomingThisWeek: 0, recentlyUpdated: 0 };
    }

    const patientIds = (patients as unknown as { _id: Types.ObjectId }[]).map(
      (p) => new Types.ObjectId(p._id.toString()),
    );

    const activeVersions = await this.versionModel
      .find({ patientId: { $in: patientIds }, status: CarePlanVersionStatus.ACTIVE })
      .lean();

    const activePatients = activeVersions.length;
    if (activePatients === 0) {
      return { activePatients: 0, needAttention: 0, upcomingThisWeek: 0, recentlyUpdated: 0 };
    }

    const versionIds = (activeVersions as unknown as { _id: Types.ObjectId }[]).map(
      (v) => new Types.ObjectId(v._id.toString()),
    );

    const now = new Date();
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    const [overduePatientIds, upcomingCount, recentCount] = await Promise.all([
      this.taskModel.distinct('patientId', {
        carePlanVersionId: { $in: versionIds },
        status: CarePlanTaskStatus.ACTIVE,
        endDate: { $ne: null, $lt: now },
      }),
      this.taskModel.countDocuments({
        carePlanVersionId: { $in: versionIds },
        status: CarePlanTaskStatus.ACTIVE,
        startDate: { $gte: now, $lte: weekFromNow },
      }),
      this.versionModel.countDocuments({
        _id: { $in: versionIds },
        updatedAt: { $gte: twoDaysAgo },
      }),
    ]);

    return {
      activePatients,
      needAttention: (overduePatientIds as Types.ObjectId[]).length,
      upcomingThisWeek: upcomingCount,
      recentlyUpdated: recentCount,
    };
  }

  // ── Paginated summary list for the Active Care Plans screen ──────────────────

  async getActiveCarePlansSummaryList(
    navigatorId: string,
    page: number,
    limit: number,
    tab: string,
  ): Promise<{ total: number; page: number; pageSize: number; items: CarePlanSummaryItem[] }> {
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const safePage = Math.max(page, 1);

    const patients = await this.usersService.findPatientsByNavigator(navigatorId);
    if (patients.length === 0) {
      return { total: 0, page: safePage, pageSize: safeLimit, items: [] };
    }

    const patientRecords = patients as unknown as Record<string, unknown>[];
    const patientIds = patientRecords.map((p) => new Types.ObjectId(String(p._id)));

    const versions = await this.versionModel
      .find({ patientId: { $in: patientIds }, status: CarePlanVersionStatus.ACTIVE })
      .lean();

    if (versions.length === 0) {
      return { total: 0, page: safePage, pageSize: safeLimit, items: [] };
    }

    const versionIds = (versions as unknown as { _id: Types.ObjectId }[]).map(
      (v) => new Types.ObjectId(v._id.toString()),
    );

    const allTasks = await this.taskModel
      .find({ carePlanVersionId: { $in: versionIds } })
      .lean();

    const patientMap = new Map<string, Record<string, unknown>>();
    for (const p of patientRecords) patientMap.set(String(p._id), p);

    type RawTask = CarePlanTask & { _id: Types.ObjectId; carePlanVersionId: Types.ObjectId };
    const tasksByVersion = new Map<string, RawTask[]>();
    for (const task of allTasks as unknown as RawTask[]) {
      const vid = task.carePlanVersionId.toString();
      if (!tasksByVersion.has(vid)) tasksByVersion.set(vid, []);
      tasksByVersion.get(vid)!.push(task);
    }

    type EnrichedRow = {
      patientId: string;
      name: string;
      patientCode: string;
      cancerType?: string;
      cancerStage?: string;
      acuityScore: number;
      treatmentStatus?: string;
      chemoSessionsCompleted?: number;
      chemoSessionsTotal?: number;
      versionId: string;
      versionNumber: number;
      lastUpdatedAt: Date;
      publishedAt: Date | null;
      tasks: RawTask[];
    };

    type RawVersion = CarePlanVersion & { _id: Types.ObjectId; patientId: Types.ObjectId; updatedAt: Date };

    const enriched: EnrichedRow[] = [];
    for (const v of versions as unknown as RawVersion[]) {
      const p = patientMap.get(v.patientId.toString());
      if (!p) continue;
      enriched.push({
        patientId: String(p._id),
        name: String(p.name ?? ''),
        patientCode: String(p.patientCode ?? ''),
        cancerType: p.cancerType as string | undefined,
        cancerStage: p.cancerStage as string | undefined,
        acuityScore: (p.acuityScore as number) ?? 0,
        treatmentStatus: p.treatmentStatus as string | undefined,
        chemoSessionsCompleted: p.chemoSessionsCompleted as number | undefined,
        chemoSessionsTotal: p.chemoSessionsTotal as number | undefined,
        versionId: v._id.toString(),
        versionNumber: v.versionNumber,
        lastUpdatedAt: v.updatedAt,
        publishedAt: v.publishedAt,
        tasks: tasksByVersion.get(v._id.toString()) ?? [],
      });
    }

    const now = new Date();
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    let filtered = enriched;
    switch (tab) {
      case 'needs_attention':
        filtered = enriched.filter((r) =>
          r.tasks.some(
            (t) => t.status === CarePlanTaskStatus.ACTIVE && t.endDate && new Date(t.endDate) < now,
          ),
        );
        break;
      case 'recently_updated':
        filtered = enriched.filter((r) => r.lastUpdatedAt >= twoDaysAgo);
        break;
      case 'high_risk':
        filtered = enriched.filter((r) => r.acuityScore >= 7);
        break;
      case 'upcoming_this_week':
        filtered = enriched.filter((r) =>
          r.tasks.some(
            (t) =>
              t.status === CarePlanTaskStatus.ACTIVE &&
              t.startDate &&
              new Date(t.startDate) >= now &&
              new Date(t.startDate) <= weekFromNow,
          ),
        );
        break;
    }

    filtered.sort((a, b) => b.lastUpdatedAt.getTime() - a.lastUpdatedAt.getTime());

    const total = filtered.length;
    const paginated = filtered.slice((safePage - 1) * safeLimit, safePage * safeLimit);

    const items: CarePlanSummaryItem[] = paginated.map((r) => {
      const activeMedications = r.tasks
        .filter((t) => t.type === 'MEDICATION' && t.status === CarePlanTaskStatus.ACTIVE)
        .slice(0, 2)
        .map((t) => ({
          title: t.title,
          medicineName: (t.taskData as Record<string, unknown>)?.medicineName as string | undefined,
          dosage: (t.taskData as Record<string, unknown>)?.dosage as string | undefined,
        }));

      const futureTasks = r.tasks
        .filter(
          (t) =>
            t.status === CarePlanTaskStatus.ACTIVE &&
            t.startDate &&
            new Date(t.startDate) >= now,
        )
        .sort((a, b) => new Date(a.startDate!).getTime() - new Date(b.startDate!).getTime());

      const nextTask = futureTasks.length > 0
        ? { type: futureTasks[0].type, title: futureTasks[0].title, dueDate: futureTasks[0].startDate! }
        : null;

      const overdueTasks = r.tasks.filter(
        (t) => t.status === CarePlanTaskStatus.ACTIVE && t.endDate && new Date(t.endDate) < now,
      );
      const overdueTypes = [...new Set(overdueTasks.map((t) => t.type))];
      const count = overdueTasks.length;

      let label = '';
      if (count > 0) {
        if (overdueTypes.length === 1) {
          switch (overdueTypes[0]) {
            case 'MEDICATION':
              label = `${count} missed medication${count > 1 ? 's' : ''}`;
              break;
            case 'LAB_TEST':
              label = `${count} overdue test${count > 1 ? 's' : ''}`;
              break;
            case 'APPOINTMENT':
              label = `${count} overdue appointment${count > 1 ? 's' : ''}`;
              break;
            default:
              label = `${count} overdue item${count > 1 ? 's' : ''}`;
          }
        } else {
          label = `${count} overdue item${count > 1 ? 's' : ''}`;
        }
      }

      return {
        patientId: r.patientId,
        name: r.name,
        patientCode: r.patientCode,
        cancerType: r.cancerType,
        cancerStage: r.cancerStage,
        acuityScore: r.acuityScore,
        treatmentStatus: r.treatmentStatus,
        chemoSessionsCompleted: r.chemoSessionsCompleted,
        chemoSessionsTotal: r.chemoSessionsTotal,
        versionId: r.versionId,
        versionNumber: r.versionNumber,
        lastUpdatedAt: r.lastUpdatedAt,
        publishedAt: r.publishedAt,
        activeMedications,
        nextTask,
        attentionItems: { count, label },
      };
    });

    return { total, page: safePage, pageSize: safeLimit, items };
  }

  async getActiveTasksForPatient(patientId: string): Promise<CarePlanTask[]> {
    const result = await this.getActiveForPatient(patientId);
    return result?.tasks ?? [];
  }

  // ── Internal helpers ─────────────────────────────────────────────────────────

  private async findActive(patientId: string): Promise<CarePlanVersion | null> {
    return this.versionModel
      .findOne({ patientId: new Types.ObjectId(patientId), status: CarePlanVersionStatus.ACTIVE })
      .lean();
  }

  private async nextVersionNumber(patientId: string): Promise<number> {
    const latest = await this.versionModel
      .findOne({ patientId: new Types.ObjectId(patientId) })
      .sort({ versionNumber: -1 })
      .lean();
    return latest ? latest.versionNumber + 1 : 1;
  }

  private async createTasksForVersion(
    versionId: string,
    patientId: string,
    dtos: CreateCarePlanTaskDto[],
  ): Promise<CarePlanTask[]> {
    if (dtos.length === 0) return [];
    const docs = dtos.map((dto) => ({
      carePlanVersionId: new Types.ObjectId(versionId),
      patientId: new Types.ObjectId(patientId),
      previousTaskId: dto.previousTaskId ? new Types.ObjectId(dto.previousTaskId) : null,
      sourceExtractedTaskId: dto.sourceExtractedTaskId
        ? new Types.ObjectId(dto.sourceExtractedTaskId)
        : null,
      type: dto.type,
      title: dto.title,
      severity: dto.severity ?? 'MEDIUM',
      startDate: dto.startDate ? new Date(dto.startDate) : null,
      endDate: dto.endDate ? new Date(dto.endDate) : null,
      instructions: dto.instructions ?? '',
      taskData: dto.taskData ?? {},
      schedule: dto.schedule ?? null,
      status: CarePlanTaskStatus.ACTIVE,
    }));
    return this.taskModel.insertMany(docs) as unknown as Promise<CarePlanTask[]>;
  }
}
