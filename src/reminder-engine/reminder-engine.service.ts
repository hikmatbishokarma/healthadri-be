import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  ReminderEvent,
  ReminderEventDocument,
  ReminderResponse,
  ReminderStatus,
  SkipReason,
} from './schemas/reminder-event.schema';
import { CarePlanVersion, CarePlanVersionDocument } from '../care-plan/schemas/care-plan-version.schema';
import { CarePlanTask, CarePlanTaskDocument } from '../care-plan/schemas/care-plan-task.schema';
import { TimelineService } from '../timeline/timeline.service';
import { TimelineEventType } from '../timeline/timeline.schema';
import { UsersService } from '../users/users.service';
import { PushNotificationsService } from '../push-notifications/push-notifications.service';
import { EventsGateway } from '../events/events.gateway';
import { EscalationService } from '../escalation/escalation.service';

interface TaskSchedule {
  times?: string[];
  intervalDays?: number;
  notifyBeforeMinutes?: number;
}

export interface AdherencePatientRow {
  patientId: string;
  name: string;
  patientCode: string;
  cancerType?: string;
  cancerStage?: string;
  acuityScore: number;
  adherenceRate: number;
  trend: 'improving' | 'stable' | 'declining';
  weeklyAdherenceRate: number;
  dailyRates: number[];
  currentRisk: {
    description: string;
    detail: string;
    badgeText: string;
    badgeLevel: 'high' | 'medium' | 'low' | 'appointment' | 'none';
  };
  lastActivity: {
    responded: boolean;
    lastActiveAt: string | null;
    lastActivityDate: string | null;
    daysAgo: number | null;
  };
  interventionStatus: {
    label: string;
    detail: string;
    level: 'escalated' | 'follow-up' | 'pending' | 'monitoring';
  };
}

export interface AdherenceOverviewResponse {
  total: number;
  page: number;
  pageSize: number;
  summary: {
    needIntervention: number;
    criticalRisk: number;
    missedFollowups: number;
    improving: number;
    overallAdherenceRate: number;
  };
  distribution: { excellent: number; good: number; fair: number; poor: number };
  topMissedMedications: { taskTitle: string; count: number }[];
  items: AdherencePatientRow[];
}

const LOOKAHEAD_DAYS = 7;
const MISSED_WINDOW_HOURS = 4;
const DEFAULT_MEDICATION_TIME = '09:00';
const DEFAULT_NOTIFY_BEFORE_MINUTES = 15;
const SKIPPED_FOLLOWUP_HOURS = 2;

type AdherenceClassification = 'good' | 'moderate' | 'poor';
type AdherenceTrend = 'improving' | 'stable' | 'declining';

function classify(rate: number): AdherenceClassification {
  if (rate >= 90) return 'good';
  if (rate >= 70) return 'moderate';
  return 'poor';
}

@Injectable()
export class ReminderEngineService {
  private readonly logger = new Logger(ReminderEngineService.name);

  constructor(
    @InjectModel(ReminderEvent.name) private reminderModel: Model<ReminderEventDocument>,
    @InjectModel(CarePlanVersion.name) private versionModel: Model<CarePlanVersionDocument>,
    @InjectModel(CarePlanTask.name) private taskModel: Model<CarePlanTaskDocument>,
    private timelineService: TimelineService,
    private usersService: UsersService,
    private pushService: PushNotificationsService,
    private eventsGateway: EventsGateway,
    private escalationService: EscalationService,
  ) {}

  // ── Cron: generate upcoming reminders ───────────────────────────────────────

  async generateDueReminders(): Promise<void> {
    const activeVersions = await this.versionModel.find({ status: 'ACTIVE' }).lean();
    if (activeVersions.length === 0) return;

    const versionIds = activeVersions.map((v) => (v as unknown as { _id: Types.ObjectId })._id);
    const activeTasks = await this.taskModel
      .find({ carePlanVersionId: { $in: versionIds }, status: 'ACTIVE' })
      .lean();

    let created = 0;

    for (const task of activeTasks) {
      const taskId = (task as unknown as { _id: Types.ObjectId })._id;
      const schedule = task.schedule as TaskSchedule | null;
      const notifyBeforeMinutes = schedule?.notifyBeforeMinutes ?? DEFAULT_NOTIFY_BEFORE_MINUTES;
      const slots = this.computeSlots(task);

      for (const scheduledAt of slots) {
        const exists = await this.reminderModel.exists({
          patientId: task.patientId,
          carePlanTaskId: taskId,
          scheduledAt,
        });
        if (exists) continue;

        const notifyAt = new Date(scheduledAt.getTime() - notifyBeforeMinutes * 60 * 1000);

        try {
          await this.reminderModel.create({
            patientId: task.patientId,
            carePlanTaskId: taskId,
            carePlanVersionId: task.carePlanVersionId,
            scheduledAt,
            notifyAt,
            status: ReminderStatus.PENDING,
            taskType: task.type,
            taskTitle: task.title,
            escalationLevel: 'NONE',
          });
          created++;
        } catch {
          // unique index violation — already exists
        }
      }
    }

    if (created > 0) this.logger.log(`Generated ${created} reminder events`);
  }

  // ── Cron: dispatch push notifications for due reminders ─────────────────────

  async dispatchDueNotifications(): Promise<void> {
    const now = new Date();
    const due = await this.reminderModel
      .find({ status: ReminderStatus.PENDING, notifyAt: { $lte: now } })
      .lean();

    if (due.length === 0) return;

    // Group by patient + scheduledAt slot so one notification covers all meds at that time
    const groups = new Map<string, typeof due>();
    for (const r of due) {
      const key = `${r.patientId}::${r.scheduledAt.toISOString()}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(r);
    }

    for (const [, reminders] of groups) {
      const patientId = reminders[0].patientId.toString();
      const scheduledAt = reminders[0].scheduledAt;
      const patient = await this.usersService.findById(patientId);
      if (!patient) continue;

      const tokens: string[] = (patient as unknown as { pushTokens?: string[] }).pushTokens ?? [];
      if (tokens.length === 0) continue;

      const time = scheduledAt.toLocaleTimeString('en-IN', {
        hour: '2-digit', minute: '2-digit', hour12: true,
      });
      const medNames = reminders.map((r) => r.taskTitle).join(', ');

      await this.pushService.sendToTokens(tokens, {
        title: `Time for your ${time} meds`,
        body: reminders.length === 1
          ? `${reminders[0].taskTitle} — tap to take or skip`
          : `${reminders.length} medications due — ${medNames.slice(0, 60)}`,
        data: {
          type: 'MEDICATION_DUE',
          patientId,
          scheduledAt: scheduledAt.toISOString(),
          screen: 'MedicationAlarm',
        },
      });
    }

    const ids = due.map((r) => (r as unknown as { _id: Types.ObjectId })._id);
    await this.reminderModel.updateMany(
      { _id: { $in: ids }, status: ReminderStatus.PENDING },
      { status: ReminderStatus.SENT, sentAt: now },
    );

    this.logger.log(`Dispatched ${groups.size} grouped push notifications for ${due.length} reminders`);
  }

  // ── Cron: mark overdue SENT/PENDING reminders as MISSED ─────────────────────

  async detectMissedReminders(): Promise<void> {
    const cutoff = new Date(Date.now() - MISSED_WINDOW_HOURS * 60 * 60 * 1000);

    const missed = await this.reminderModel.find({
      status: { $in: [ReminderStatus.SENT, ReminderStatus.PENDING] },
      scheduledAt: { $lt: cutoff },
    });

    if (missed.length === 0) return;

    const ids = missed.map((r) => (r as unknown as { _id: Types.ObjectId })._id);
    await this.reminderModel.updateMany(
      { _id: { $in: ids } },
      { status: ReminderStatus.MISSED },
    );

    // Notify caregiver and create escalation for each missed patient
    const patientIdSet = new Set(missed.map((r) => r.patientId.toString()));
    for (const patientId of patientIdSet) {
      await this.notifyCaregiverOfMiss(patientId, missed.filter((r) => r.patientId.toString() === patientId));
      // Create caregiver-level escalation so auto-promote cron can escalate to navigator
      await this.escalationService.checkPatientEscalation(patientId, 1, true);
    }

    this.logger.log(`Marked ${missed.length} reminders as MISSED`);
  }

  // ── Cron: mark SKIPPED reminders with no follow-up as MISSED ────────────────

  async processSkippedFollowups(): Promise<void> {
    const cutoff = new Date(Date.now() - SKIPPED_FOLLOWUP_HOURS * 60 * 60 * 1000);
    const staleSkipped = await this.reminderModel.find({
      status: ReminderStatus.SKIPPED,
      respondedAt: { $lt: cutoff },
    });

    if (staleSkipped.length === 0) return;

    const ids = staleSkipped.map((r) => (r as unknown as { _id: Types.ObjectId })._id);
    await this.reminderModel.updateMany(
      { _id: { $in: ids } },
      { status: ReminderStatus.MISSED },
    );

    const patientIdSet = new Set(staleSkipped.map((r) => r.patientId.toString()));
    for (const patientId of patientIdSet) {
      const relevant = staleSkipped.filter((r) => r.patientId.toString() === patientId);
      await this.notifyCaregiverOfMiss(patientId, relevant);
      await this.escalationService.checkPatientEscalation(patientId, 1, true);
    }

    this.logger.log(`Converted ${staleSkipped.length} ignored SKIPPED reminders to MISSED`);
  }

  // ── Cron: re-queue snoozed reminders ────────────────────────────────────────

  async processSnoozes(): Promise<void> {
    await this.reminderModel.updateMany(
      {
        status: ReminderStatus.SNOOZED,
        snoozedUntil: { $lte: new Date() },
      },
      { status: ReminderStatus.PENDING, snoozedUntil: null },
    );
  }

  // ── Patient / caregiver response ─────────────────────────────────────────────

  async respond(
    reminderId: string,
    response: ReminderResponse,
    snoozedUntil?: Date,
    skipReason?: SkipReason,
  ): Promise<ReminderEvent> {
    const reminder = await this.reminderModel.findById(reminderId);
    if (!reminder) throw new NotFoundException('Reminder not found');

    reminder.response = response;
    reminder.respondedAt = new Date();

    switch (response) {
      case ReminderResponse.TAKEN:
        reminder.status = ReminderStatus.PATIENT_CONFIRMED;
        break;
      case ReminderResponse.SNOOZED:
        reminder.status = ReminderStatus.SNOOZED;
        reminder.snoozedUntil = snoozedUntil ?? new Date(Date.now() + 30 * 60 * 1000);
        break;
      case ReminderResponse.SKIPPED:
        // SKIPPED = intentional skip; stays SKIPPED until follow-up or 2h timeout
        reminder.status = ReminderStatus.SKIPPED;
        if (skipReason) reminder.skipReason = skipReason;
        await this.sendSkipFollowupPush(reminder);
        break;
      case ReminderResponse.CAREGIVER_CONFIRMED:
        reminder.status = ReminderStatus.CAREGIVER_CONFIRMED;
        // Resolve any open caregiver-level escalation for this patient
        await this.escalationService.resolveOpenCaregiverEscalation(
          reminder.patientId.toString(),
          reminder.patientId.toString(),
        );
        break;
    }

    await reminder.save();

    if (response === ReminderResponse.TAKEN) {
      await this.timelineService.append({
        patientId: reminder.patientId.toString(),
        eventType: TimelineEventType.REMINDER_SENT,
        description: `${reminder.taskTitle} confirmed`,
        relatedEntityId: reminderId,
        relatedEntityType: 'ReminderEvent',
      });
    }

    return reminder;
  }

  // ── Bulk respond (TAKE ALL / SKIP ALL) ───────────────────────────────────────

  async bulkRespond(
    patientId: string,
    scheduledAt: Date,
    response: ReminderResponse,
    skipReason?: SkipReason,
  ): Promise<ReminderEvent[]> {
    const windowMs = 30 * 60 * 1000;
    const from = new Date(scheduledAt.getTime() - windowMs);
    const to = new Date(scheduledAt.getTime() + windowMs);

    const reminders = await this.reminderModel.find({
      patientId: new Types.ObjectId(patientId),
      status: { $in: [ReminderStatus.PENDING, ReminderStatus.SENT] },
      scheduledAt: { $gte: from, $lte: to },
    });

    const results: ReminderEvent[] = [];
    for (const r of reminders) {
      const updated = await this.respond(
        (r as unknown as { _id: { toString(): string } })._id.toString(),
        response,
        undefined,
        skipReason,
      );
      results.push(updated);
    }
    return results;
  }

  async sendTestNotification(patientId: string): Promise<void> {
    const patient = await this.usersService.findById(patientId);
    if (!patient) return;
    const tokens: string[] = (patient as unknown as { pushTokens?: string[] }).pushTokens ?? [];
    if (tokens.length === 0) {
      this.logger.warn(`No push tokens for patient ${patientId}`);
      return;
    }
    const now = new Date();
    const time = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    await this.pushService.sendToTokens(tokens, {
      title: `Test: Time for your ${time} meds`,
      body: 'TAB APRIDEZ · TAB BILATIS M · 5 CRM. LIZOLE CREAM',
      data: {
        type: 'MEDICATION_DUE',
        patientId,
        scheduledAt: now.toISOString(),
        screen: 'MedicationAlarm',
      },
    });
    this.logger.log(`Test notification sent to patient ${patientId}`);
  }

  // ── Queries ──────────────────────────────────────────────────────────────────

  async getForPatient(
    patientId: string,
    options: { status?: string; limit?: number; from?: Date; to?: Date },
  ): Promise<ReminderEvent[]> {
    const filter: Record<string, unknown> = {
      patientId: new Types.ObjectId(patientId),
    };
    if (options.status) filter.status = options.status;
    if (options.from || options.to) {
      const range: Record<string, Date> = {};
      if (options.from) range.$gte = options.from;
      if (options.to) range.$lte = options.to;
      filter.scheduledAt = range;
    }

    const reminders = await this.reminderModel
      .find(filter)
      .sort({ scheduledAt: 1 })
      .limit(options.limit ?? 200)
      .populate('carePlanTaskId', 'taskData title type')
      .lean();

    // Deduplicate: per (carePlanTaskId, calendar-date) keep the one with highest priority status
    // Priority: PATIENT_CONFIRMED > SKIPPED > MISSED > PENDING
    const statusPriority: Record<string, number> = {
      PATIENT_CONFIRMED: 4, CAREGIVER_CONFIRMED: 4,
      SKIPPED: 3, MISSED: 2, SENT: 1, PENDING: 0,
    };
    const seen = new Map<string, typeof reminders[0]>();
    for (const r of reminders) {
      const taskId = r.carePlanTaskId
        ? ((r.carePlanTaskId as unknown as { _id: { toString(): string } })._id ?? r.carePlanTaskId).toString()
        : r.carePlanTaskId?.toString() ?? '';
      const dateKey = `${taskId}::${new Date(r.scheduledAt).toISOString().slice(0, 10)}`;
      const existing = seen.get(dateKey);
      const curPriority = statusPriority[r.status] ?? 0;
      const exPriority = existing ? (statusPriority[existing.status] ?? 0) : -1;
      if (!existing || curPriority > exPriority) {
        seen.set(dateKey, r);
      }
    }
    return Array.from(seen.values()).sort(
      (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
    );
  }

  async getAdherenceSummary(patientId: string): Promise<{
    total: number;
    confirmed: number;
    missed: number;
    skipped: number;
    pending: number;
    adherenceRate: number;
    classification: AdherenceClassification;
    upcoming: ReminderEvent[];
  }> {
    const pid = new Types.ObjectId(patientId);
    const [total, confirmed, missed, skipped] = await Promise.all([
      this.reminderModel.countDocuments({ patientId: pid }),
      this.reminderModel.countDocuments({
        patientId: pid,
        status: { $in: [ReminderStatus.PATIENT_CONFIRMED, ReminderStatus.CAREGIVER_CONFIRMED] },
      }),
      this.reminderModel.countDocuments({ patientId: pid, status: ReminderStatus.MISSED }),
      this.reminderModel.countDocuments({ patientId: pid, status: ReminderStatus.SKIPPED }),
    ]);

    const resolved = confirmed + missed;
    const adherenceRate = resolved > 0 ? Math.round((confirmed / resolved) * 100) : 0;

    const upcoming = await this.reminderModel
      .find({
        patientId: pid,
        status: { $in: [ReminderStatus.PENDING, ReminderStatus.SENT] },
        scheduledAt: { $gte: new Date() },
      })
      .sort({ scheduledAt: 1 })
      .limit(5)
      .lean();

    const pending = await this.reminderModel.countDocuments({
      patientId: pid,
      status: { $in: [ReminderStatus.PENDING, ReminderStatus.SENT] },
    });

    return {
      total,
      confirmed,
      missed,
      skipped,
      pending,
      adherenceRate,
      classification: classify(adherenceRate),
      upcoming,
    };
  }

  async getWeeklyReport(patientId: string): Promise<{
    weeklyAdherencePct: number;
    taken: number;
    skipped: number;
    missed: number;
    total: number;
    classification: AdherenceClassification;
    trend: AdherenceTrend;
  }> {
    const pid = new Types.ObjectId(patientId);
    const now = new Date();
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const prevWeekStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const [taken, skipped, missed, prevTaken, prevResolved] = await Promise.all([
      this.reminderModel.countDocuments({
        patientId: pid,
        status: { $in: [ReminderStatus.PATIENT_CONFIRMED, ReminderStatus.CAREGIVER_CONFIRMED] },
        scheduledAt: { $gte: weekStart, $lte: now },
      }),
      this.reminderModel.countDocuments({
        patientId: pid,
        status: ReminderStatus.SKIPPED,
        scheduledAt: { $gte: weekStart, $lte: now },
      }),
      this.reminderModel.countDocuments({
        patientId: pid,
        status: ReminderStatus.MISSED,
        scheduledAt: { $gte: weekStart, $lte: now },
      }),
      this.reminderModel.countDocuments({
        patientId: pid,
        status: { $in: [ReminderStatus.PATIENT_CONFIRMED, ReminderStatus.CAREGIVER_CONFIRMED] },
        scheduledAt: { $gte: prevWeekStart, $lt: weekStart },
      }),
      this.reminderModel.countDocuments({
        patientId: pid,
        status: { $in: [ReminderStatus.PATIENT_CONFIRMED, ReminderStatus.CAREGIVER_CONFIRMED, ReminderStatus.MISSED] },
        scheduledAt: { $gte: prevWeekStart, $lt: weekStart },
      }),
    ]);

    const total = taken + skipped + missed;
    const resolved = taken + missed;
    const weeklyAdherencePct = resolved > 0 ? Math.round((taken / resolved) * 100) : 0;
    const prevRate = prevResolved > 0 ? Math.round((prevTaken / prevResolved) * 100) : 0;

    let trend: AdherenceTrend = 'stable';
    if (weeklyAdherencePct >= prevRate + 5) trend = 'improving';
    else if (weeklyAdherencePct <= prevRate - 5) trend = 'declining';

    return {
      weeklyAdherencePct,
      taken,
      skipped,
      missed,
      total,
      classification: classify(weeklyAdherencePct),
      trend,
    };
  }

  async getForNavigatorPatients(
    patientIds: string[],
    status?: string,
    limit = 50,
  ): Promise<ReminderEvent[]> {
    const filter: Record<string, unknown> = {
      patientId: { $in: patientIds.map((id) => new Types.ObjectId(id)) },
    };
    if (status) {
      filter.status = status;
    } else {
      filter.status = {
        $in: [ReminderStatus.MISSED, ReminderStatus.PENDING, ReminderStatus.SENT],
      };
    }
    return this.reminderModel
      .find(filter)
      .sort({ scheduledAt: 1 })
      .limit(limit)
      .lean();
  }

  async getPatientIdsWithRecentMissed(since: Date, threshold: number): Promise<string[]> {
    const results = await this.reminderModel.aggregate([
      { $match: { status: ReminderStatus.MISSED, scheduledAt: { $gte: since } } },
      { $group: { _id: '$patientId', count: { $sum: 1 } } },
      { $match: { count: { $gte: threshold } } },
    ]);
    return results.map((r) => r._id.toString());
  }

  async getCriticalMissedReminders(since: Date): Promise<{ patientId: string; taskTitle: string }[]> {
    const missed = await this.reminderModel
      .find({ status: ReminderStatus.MISSED, taskType: 'MEDICATION', scheduledAt: { $gte: since } })
      .lean();
    if (missed.length === 0) return [];

    const taskIds = missed.map((r) => r.carePlanTaskId);
    const criticalTasks = await this.taskModel
      .find({ _id: { $in: taskIds }, severity: 'CRITICAL' })
      .lean();

    const criticalIdSet = new Set(
      criticalTasks.map((t) => (t as unknown as { _id: { toString(): string } })._id.toString()),
    );

    return missed
      .filter((r) => criticalIdSet.has(r.carePlanTaskId.toString()))
      .map((r) => ({ patientId: r.patientId.toString(), taskTitle: r.taskTitle }));
  }

  // ── Navigator adherence overview (single call for the Adherence Monitoring page) ──

  async getNavigatorAdherenceOverview(
    navigatorId: string,
    page: number,
    limit: number,
    tab: string,
  ): Promise<AdherenceOverviewResponse> {
    const patients = await this.usersService.findPatientsByNavigator(navigatorId);

    if (patients.length === 0) {
      return {
        total: 0, page, pageSize: limit,
        summary: { needIntervention: 0, criticalRisk: 0, missedFollowups: 0, improving: 0, overallAdherenceRate: 0 },
        distribution: { excellent: 0, good: 0, fair: 0, poor: 0 },
        topMissedMedications: [],
        items: [],
      };
    }

    const patientIds = patients.map((p) => (p as unknown as { _id: Types.ObjectId })._id);
    const now = new Date();
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [recentReminders, allTimeStats, escalationMap] = await Promise.all([
      this.reminderModel
        .find({ patientId: { $in: patientIds }, scheduledAt: { $gte: fourteenDaysAgo } })
        .lean(),
      this.reminderModel.aggregate([
        { $match: { patientId: { $in: patientIds } } },
        {
          $group: {
            _id: '$patientId',
            totalConfirmed: {
              $sum: {
                $cond: [
                  { $in: ['$status', [ReminderStatus.PATIENT_CONFIRMED, ReminderStatus.CAREGIVER_CONFIRMED]] },
                  1, 0,
                ],
              },
            },
            totalMissed: {
              $sum: { $cond: [{ $eq: ['$status', ReminderStatus.MISSED] }, 1, 0] },
            },
          },
        },
      ]),
      this.escalationService.getOpenEscalationMap(navigatorId),
    ]);

    const allTimeMap = new Map<string, { totalConfirmed: number; totalMissed: number }>();
    for (const stat of allTimeStats) {
      allTimeMap.set(stat._id.toString(), { totalConfirmed: stat.totalConfirmed, totalMissed: stat.totalMissed });
    }

    const remindersByPatient = new Map<string, typeof recentReminders>();
    for (const r of recentReminders) {
      const pid = r.patientId.toString();
      if (!remindersByPatient.has(pid)) remindersByPatient.set(pid, []);
      remindersByPatient.get(pid)!.push(r);
    }

    const rows: AdherencePatientRow[] = [];

    for (const patient of patients) {
      const p = patient as unknown as {
        _id: { toString(): string };
        name: string;
        patientCode?: string;
        cancerType?: string;
        cancerStage?: string;
        acuityScore?: number;
      };
      const pid = p._id.toString();
      const patientReminders = remindersByPatient.get(pid) ?? [];
      const stats = allTimeMap.get(pid) ?? { totalConfirmed: 0, totalMissed: 0 };
      const escalation = escalationMap.get(pid) ?? null;

      const resolvedAll = stats.totalConfirmed + stats.totalMissed;
      const adherenceRate = resolvedAll > 0 ? Math.round((stats.totalConfirmed / resolvedAll) * 100) : 0;

      const thisWeek = patientReminders.filter((r) => new Date(r.scheduledAt) >= sevenDaysAgo);
      const prevWeek = patientReminders.filter((r) => {
        const d = new Date(r.scheduledAt);
        return d >= fourteenDaysAgo && d < sevenDaysAgo;
      });

      const isConfirmed = (s: string) => s === ReminderStatus.PATIENT_CONFIRMED || s === ReminderStatus.CAREGIVER_CONFIRMED;

      const thisWeekConfirmed = thisWeek.filter((r) => isConfirmed(r.status)).length;
      const thisWeekMissed = thisWeek.filter((r) => r.status === ReminderStatus.MISSED).length;
      const thisWeekResolved = thisWeekConfirmed + thisWeekMissed;
      const weeklyAdherenceRate = thisWeekResolved > 0 ? Math.round((thisWeekConfirmed / thisWeekResolved) * 100) : 0;

      const prevConfirmed = prevWeek.filter((r) => isConfirmed(r.status)).length;
      const prevMissed = prevWeek.filter((r) => r.status === ReminderStatus.MISSED).length;
      const prevResolved = prevConfirmed + prevMissed;
      const prevRate = prevResolved > 0 ? Math.round((prevConfirmed / prevResolved) * 100) : 0;

      let trend: AdherencePatientRow['trend'] = 'stable';
      if (weeklyAdherenceRate >= prevRate + 5) trend = 'improving';
      else if (weeklyAdherenceRate <= prevRate - 5) trend = 'declining';

      // Daily rates for the 7-day sparkline (index 0 = 6 days ago, index 6 = today)
      const dailyRates: number[] = [];
      for (let d = 6; d >= 0; d--) {
        const dayStart = new Date(now);
        dayStart.setDate(dayStart.getDate() - d);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayEnd.getDate() + 1);
        const day = thisWeek.filter((r) => {
          const t = new Date(r.scheduledAt);
          return t >= dayStart && t < dayEnd;
        });
        const dc = day.filter((r) => isConfirmed(r.status)).length;
        const dm = day.filter((r) => r.status === ReminderStatus.MISSED).length;
        const dr = dc + dm;
        dailyRates.push(dr > 0 ? Math.round((dc / dr) * 100) : -1);
      }

      // Current risk
      const missedThisWeek = thisWeek.filter((r) => r.status === ReminderStatus.MISSED);
      const missedMeds = missedThisWeek.filter((r) => r.taskType === 'MEDICATION');
      const missedAppts = missedThisWeek.filter((r) => r.taskType === 'APPOINTMENT');
      const acuityScore = p.acuityScore ?? 0;

      const missedByTitle = new Map<string, number>();
      for (const r of missedMeds) {
        missedByTitle.set(r.taskTitle, (missedByTitle.get(r.taskTitle) ?? 0) + 1);
      }
      let worstTitle = '';
      let worstCount = 0;
      for (const [title, count] of missedByTitle.entries()) {
        if (count > worstCount) { worstTitle = title; worstCount = count; }
      }

      let currentRisk: AdherencePatientRow['currentRisk'];
      if (missedAppts.length > 0) {
        currentRisk = { description: `Missed ${missedAppts[0].taskTitle}`, detail: `${missedAppts.length} appointment(s) this week`, badgeText: 'Appointment Missed', badgeLevel: 'appointment' };
      } else if (worstCount > 0 && (acuityScore >= 7 || worstCount >= 3)) {
        currentRisk = { description: `Missed ${worstTitle}`, detail: `${worstCount} dose(s) this week`, badgeText: 'High Risk Medication', badgeLevel: 'high' };
      } else if (worstCount >= 2) {
        currentRisk = { description: `Missed ${worstTitle}`, detail: `${worstCount} dose(s) this week`, badgeText: 'Medium Risk', badgeLevel: 'medium' };
      } else if (worstCount === 1) {
        currentRisk = { description: `Missed ${worstTitle}`, detail: '1 dose this week', badgeText: 'Low Risk', badgeLevel: 'low' };
      } else {
        currentRisk = { description: 'On track', detail: 'No missed doses', badgeText: 'On Track', badgeLevel: 'none' };
      }

      // Last activity
      const confirmedSorted = [...patientReminders]
        .filter((r) => isConfirmed(r.status))
        .sort((a, b) => new Date(b.respondedAt ?? b.scheduledAt).getTime() - new Date(a.respondedAt ?? a.scheduledAt).getTime());
      const lastConfirmed = confirmedSorted[0] ?? null;
      const lastActiveAt = lastConfirmed ? (lastConfirmed.respondedAt ?? lastConfirmed.scheduledAt) : null;
      const daysAgo = lastActiveAt ? Math.floor((now.getTime() - new Date(lastActiveAt).getTime()) / (24 * 60 * 60 * 1000)) : null;
      const responded = lastActiveAt ? now.getTime() - new Date(lastActiveAt).getTime() <= 72 * 60 * 60 * 1000 : false;

      const respondedSorted = [...patientReminders]
        .filter((r) => r.respondedAt)
        .sort((a, b) => new Date(b.respondedAt!).getTime() - new Date(a.respondedAt!).getTime());
      const lastActivityDate = respondedSorted[0]?.respondedAt ? new Date(respondedSorted[0].respondedAt).toISOString() : null;

      // Intervention status
      let interventionStatus: AdherencePatientRow['interventionStatus'];
      if (escalation?.status === 'ESCALATED_TO_NAVIGATOR') {
        interventionStatus = { label: 'Escalated', detail: 'Escalated to senior', level: 'escalated' };
      } else if (escalation?.status === 'OPEN' && escalation.level === 'CAREGIVER') {
        interventionStatus = { label: 'Pending Call', detail: `Attempted ${escalation.missedCount} time(s)`, level: 'pending' };
      } else if (missedThisWeek.length >= 3) {
        interventionStatus = { label: 'Follow-up Needed', detail: 'Call patient', level: 'follow-up' };
      } else if (missedThisWeek.length >= 1) {
        interventionStatus = { label: 'Monitoring', detail: 'Track adherence', level: 'monitoring' };
      } else {
        interventionStatus = { label: 'Monitoring', detail: 'No action needed', level: 'monitoring' };
      }

      rows.push({
        patientId: pid,
        name: p.name,
        patientCode: p.patientCode ?? '',
        cancerType: p.cancerType,
        cancerStage: p.cancerStage,
        acuityScore,
        adherenceRate,
        trend,
        weeklyAdherenceRate,
        dailyRates,
        currentRisk,
        lastActivity: { responded, lastActiveAt: lastActiveAt ? new Date(lastActiveAt).toISOString() : null, lastActivityDate, daysAgo },
        interventionStatus,
      });
    }

    // Apply tab filter
    const LEVEL_ORDER: Record<string, number> = { escalated: 0, 'follow-up': 1, pending: 2, monitoring: 3 };
    let filtered = rows;
    switch (tab) {
      case 'needs_intervention': filtered = rows.filter((r) => r.interventionStatus.level === 'follow-up' || r.interventionStatus.level === 'escalated'); break;
      case 'critical_misses':   filtered = rows.filter((r) => r.currentRisk.badgeLevel === 'high'); break;
      case 'missed_followups':  filtered = rows.filter((r) => r.interventionStatus.level === 'pending' || r.interventionStatus.level === 'follow-up'); break;
      case 'declining':         filtered = rows.filter((r) => r.trend === 'declining'); break;
      case 'improving':         filtered = rows.filter((r) => r.trend === 'improving'); break;
      case 'no_activity':       filtered = rows.filter((r) => !r.lastActivity.responded); break;
      case 'resolved':          filtered = rows.filter((r) => r.interventionStatus.level === 'monitoring' && r.currentRisk.badgeLevel === 'none'); break;
    }

    filtered.sort((a, b) => {
      const lvl = (LEVEL_ORDER[a.interventionStatus.level] ?? 3) - (LEVEL_ORDER[b.interventionStatus.level] ?? 3);
      return lvl !== 0 ? lvl : a.adherenceRate - b.adherenceRate;
    });

    // Summary (always computed from all rows, not the filtered set)
    const needIntervention = rows.filter((r) => r.interventionStatus.level === 'follow-up' || r.interventionStatus.level === 'escalated').length;
    const criticalRisk = rows.filter((r) => r.currentRisk.badgeLevel === 'high').length;
    const missedFollowups = rows.filter((r) => r.interventionStatus.level === 'pending').length;
    const improving = rows.filter((r) => r.trend === 'improving').length;
    const overallAdherenceRate = rows.length > 0 ? Math.round(rows.reduce((s, r) => s + r.adherenceRate, 0) / rows.length) : 0;

    const distribution = { excellent: 0, good: 0, fair: 0, poor: 0 };
    for (const r of rows) {
      if (r.adherenceRate >= 90) distribution.excellent++;
      else if (r.adherenceRate >= 75) distribution.good++;
      else if (r.adherenceRate >= 50) distribution.fair++;
      else distribution.poor++;
    }

    const medMissMap = new Map<string, number>();
    for (const r of recentReminders) {
      if (r.status === ReminderStatus.MISSED && r.taskType === 'MEDICATION') {
        medMissMap.set(r.taskTitle, (medMissMap.get(r.taskTitle) ?? 0) + 1);
      }
    }
    const topMissedMedications = Array.from(medMissMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([taskTitle, count]) => ({ taskTitle, count }));

    const total = filtered.length;
    const start = (page - 1) * limit;
    const items = filtered.slice(start, start + limit);

    return { total, page, pageSize: limit, summary: { needIntervention, criticalRisk, missedFollowups, improving, overallAdherenceRate }, distribution, topMissedMedications, items };
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private async notifyCaregiverOfMiss(
    patientId: string,
    reminders: ReminderEvent[],
  ): Promise<void> {
    const caregiver = await this.usersService.findCaregiverForPatient(patientId);
    if (!caregiver) return;

    const tokens: string[] = (caregiver as unknown as { pushTokens?: string[] }).pushTokens ?? [];
    const names = [...new Set(reminders.map((r) => r.taskTitle))].join(', ');

    if (tokens.length > 0) {
      await this.pushService.sendToTokens(tokens, {
        title: 'Missed medication',
        body: `Your patient missed: ${names}. Please check in.`,
        data: { patientId, type: 'MISSED_DOSE_CAREGIVER' },
      });
    }

    // Also notify navigator via WebSocket
    const patient = await this.usersService.findById(patientId);
    if (patient?.assignedNavigatorId) {
      this.eventsGateway.emitReminderSent(patientId, {
        patientId,
        patientName: patient.name,
        missedDoses: reminders.map((r) => r.taskTitle),
        type: 'MISSED_DOSE',
      });
    }
  }

  private async sendSkipFollowupPush(reminder: ReminderEvent): Promise<void> {
    const patient = await this.usersService.findById(reminder.patientId.toString());
    const tokens: string[] = (patient as unknown as { pushTokens?: string[] }).pushTokens ?? [];
    if (tokens.length > 0) {
      await this.pushService.sendToTokens(tokens, {
        title: 'Did you take your medication?',
        body: `${reminder.taskTitle} — please let us know if you took it or want to provide a reason for skipping.`,
        data: {
          reminderId: (reminder as unknown as { _id: { toString(): string } })._id.toString(),
          type: 'SKIP_FOLLOWUP',
        },
      });
    }
  }

  // ── Schedule computation ─────────────────────────────────────────────────────

  private computeSlots(task: CarePlanTask): Date[] {
    const now = new Date();
    const lookaheadEnd = new Date(now.getTime() + LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000);
    const schedule = task.schedule as TaskSchedule | null;
    const slots: Date[] = [];

    if (task.type === 'MEDICATION') {
      const times = schedule?.times?.length ? schedule.times : [DEFAULT_MEDICATION_TIME];
      const intervalDays = schedule?.intervalDays ?? 1;

      const start = task.startDate ? new Date(task.startDate) : now;
      const end = task.endDate
        ? new Date(Math.min(new Date(task.endDate).getTime(), lookaheadEnd.getTime()))
        : lookaheadEnd;

      let cursor = new Date(Math.max(start.getTime(), now.getTime()));
      cursor.setHours(0, 0, 0, 0);

      while (cursor <= end) {
        for (const time of times) {
          const [h, m] = time.split(':').map(Number);
          const slot = new Date(cursor);
          slot.setHours(h, m, 0, 0);
          if (slot > now && slot <= end) {
            slots.push(new Date(slot));
          }
        }
        cursor = new Date(cursor.getTime() + intervalDays * 24 * 60 * 60 * 1000);
      }
    } else {
      const scheduledDate = task.startDate ? new Date(task.startDate) : null;
      if (scheduledDate) {
        const dayBefore = new Date(scheduledDate);
        dayBefore.setDate(dayBefore.getDate() - 1);
        dayBefore.setHours(9, 0, 0, 0);
        if (dayBefore > now && dayBefore <= lookaheadEnd) {
          slots.push(dayBefore);
        }

        const onDay = new Date(scheduledDate);
        onDay.setHours(8, 0, 0, 0);
        if (onDay > now && onDay <= lookaheadEnd) {
          slots.push(onDay);
        }
      }
    }

    return slots;
  }
}
