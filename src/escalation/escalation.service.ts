import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  EscalationEvent,
  EscalationEventDocument,
  EscalationLevel,
  EscalationStatus,
  EscalationTrigger,
} from './schemas/escalation-event.schema';
import { UsersService } from '../users/users.service';
import { EventsGateway } from '../events/events.gateway';
import { TimelineService } from '../timeline/timeline.service';
import { TimelineEventType } from '../timeline/timeline.schema';

@Injectable()
export class EscalationService {
  private readonly logger = new Logger(EscalationService.name);

  constructor(
    @InjectModel(EscalationEvent.name)
    private escalationModel: Model<EscalationEventDocument>,
    private usersService: UsersService,
    private eventsGateway: EventsGateway,
    private timelineService: TimelineService,
  ) {}

  /**
   * Create a caregiver- or navigator-level escalation for a patient.
   * @param forceCreate When true, bypasses the 3-miss threshold and creates immediately
   *                    (used for single-miss immediate caregiver notification).
   */
  async checkPatientEscalation(
    patientId: string,
    missedCount: number,
    forceCreate = false,
  ): Promise<void> {
    const existing = await this.escalationModel.findOne({
      patientId: new Types.ObjectId(patientId),
      status: { $in: [EscalationStatus.OPEN, EscalationStatus.ESCALATED_TO_NAVIGATOR] },
    });
    if (existing) return;

    const patient = await this.usersService.findById(patientId);
    if (!patient?.assignedNavigatorId) return;

    const navigatorId = patient.assignedNavigatorId.toString();
    const caregiver = await this.usersService.findCaregiverForPatient(patientId);
    const level = caregiver ? EscalationLevel.CAREGIVER : EscalationLevel.NAVIGATOR;

    const trigger = forceCreate
      ? EscalationTrigger.MISSED_REMINDERS
      : EscalationTrigger.MISSED_REMINDERS;

    const escalation = await this.escalationModel.create({
      patientId: new Types.ObjectId(patientId),
      navigatorId: new Types.ObjectId(navigatorId),
      trigger,
      level,
      status: EscalationStatus.OPEN,
      missedCount,
      navigatorNotifiedAt: new Date(),
    });

    this.eventsGateway.emitEscalation(navigatorId, {
      _id: escalation._id,
      patientId,
      patientName: patient.name,
      trigger,
      level,
      missedCount,
    });

    this.logger.log(
      `Escalation created for patient ${patientId} — ${missedCount} missed, level=${level}`,
    );
  }

  async createCriticalMedicationEscalation(
    patientId: string,
    taskTitle: string,
  ): Promise<void> {
    const existing = await this.escalationModel.findOne({
      patientId: new Types.ObjectId(patientId),
      status: { $in: [EscalationStatus.OPEN, EscalationStatus.ESCALATED_TO_NAVIGATOR] },
      trigger: EscalationTrigger.CRITICAL_MEDICATION_MISSED,
    });
    if (existing) return;

    const patient = await this.usersService.findById(patientId);
    if (!patient?.assignedNavigatorId) return;

    const navigatorId = patient.assignedNavigatorId.toString();

    const escalation = await this.escalationModel.create({
      patientId: new Types.ObjectId(patientId),
      navigatorId: new Types.ObjectId(navigatorId),
      trigger: EscalationTrigger.CRITICAL_MEDICATION_MISSED,
      level: EscalationLevel.NAVIGATOR,
      status: EscalationStatus.OPEN,
      missedCount: 1,
      navigatorNotifiedAt: new Date(),
    });

    this.eventsGateway.emitEscalation(navigatorId, {
      _id: escalation._id,
      patientId,
      patientName: patient.name,
      trigger: EscalationTrigger.CRITICAL_MEDICATION_MISSED,
      level: EscalationLevel.NAVIGATOR,
      taskTitle,
    });

    this.logger.warn(
      `CRITICAL medication escalation for patient ${patientId}: ${taskTitle}`,
    );
  }

  /**
   * Resolve any open CAREGIVER-level escalation for a patient.
   * Called when caregiver confirms a dose.
   */
  async resolveOpenCaregiverEscalation(
    patientId: string,
    resolvedById: string,
  ): Promise<void> {
    const escalation = await this.escalationModel.findOne({
      patientId: new Types.ObjectId(patientId),
      status: EscalationStatus.OPEN,
      level: EscalationLevel.CAREGIVER,
    });
    if (!escalation) return;

    escalation.status = EscalationStatus.RESOLVED;
    escalation.resolvedAt = new Date();
    escalation.resolvedById = new Types.ObjectId(resolvedById);
    escalation.resolutionNote = 'Resolved by caregiver confirmation';
    await escalation.save();

    await this.timelineService.append({
      patientId,
      eventType: TimelineEventType.ESCALATION_RESOLVED,
      description: 'Caregiver confirmed dose — escalation resolved',
      relatedEntityId: (escalation as unknown as { _id: { toString(): string } })._id.toString(),
      relatedEntityType: 'EscalationEvent',
    });
  }

  async escalateToNavigator(escalationId: string): Promise<void> {
    const escalation = await this.escalationModel.findById(escalationId);
    if (!escalation || escalation.status === EscalationStatus.RESOLVED) return;

    escalation.level = EscalationLevel.NAVIGATOR;
    escalation.status = EscalationStatus.ESCALATED_TO_NAVIGATOR;
    escalation.navigatorNotifiedAt = new Date();
    await escalation.save();

    this.eventsGateway.emitEscalation(escalation.navigatorId.toString(), {
      _id: escalation._id,
      patientId: escalation.patientId,
      trigger: escalation.trigger,
      level: EscalationLevel.NAVIGATOR,
      escalatedFromCaregiver: true,
    });
  }

  async resolve(
    escalationId: string,
    resolvedById: string,
    note?: string,
  ): Promise<EscalationEvent> {
    const escalation = await this.escalationModel.findById(escalationId);
    if (!escalation) throw new NotFoundException('Escalation not found');

    escalation.status = EscalationStatus.RESOLVED;
    escalation.resolvedAt = new Date();
    escalation.resolvedById = new Types.ObjectId(resolvedById);
    if (note) escalation.resolutionNote = note;
    await escalation.save();

    await this.timelineService.append({
      patientId: escalation.patientId.toString(),
      eventType: TimelineEventType.ESCALATION_RESOLVED,
      description: note || 'Escalation resolved by navigator',
      relatedEntityId: escalationId,
      relatedEntityType: 'EscalationEvent',
    });

    return escalation;
  }

  async getOpenByNavigator(navigatorId: string) {
    return this.escalationModel
      .find({
        navigatorId: new Types.ObjectId(navigatorId),
        status: { $in: [EscalationStatus.OPEN, EscalationStatus.ESCALATED_TO_NAVIGATOR] },
      })
      .populate('patientId', 'name patientCode cancerType')
      .sort({ createdAt: -1 })
      .lean();
  }

  async getAllByNavigator(navigatorId: string) {
    return this.escalationModel
      .find({ navigatorId: new Types.ObjectId(navigatorId) })
      .populate('patientId', 'name patientCode cancerType')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
  }

  async getForPatient(patientId: string) {
    return this.escalationModel
      .find({ patientId: new Types.ObjectId(patientId) })
      .sort({ createdAt: -1 })
      .lean();
  }

  async getOpenEscalationMap(
    navigatorId: string,
  ): Promise<Map<string, { status: string; level: string; missedCount: number }>> {
    const escalations = await this.escalationModel
      .find({
        navigatorId: new Types.ObjectId(navigatorId),
        status: { $in: [EscalationStatus.OPEN, EscalationStatus.ESCALATED_TO_NAVIGATOR] },
      })
      .lean();
    const map = new Map<string, { status: string; level: string; missedCount: number }>();
    for (const esc of escalations) {
      map.set(esc.patientId.toString(), {
        status: esc.status,
        level: esc.level,
        missedCount: esc.missedCount,
      });
    }
    return map;
  }

  async findStaleCaregiverEscalations(olderThan: Date) {
    return this.escalationModel
      .find({
        status: EscalationStatus.OPEN,
        level: EscalationLevel.CAREGIVER,
        createdAt: { $lte: olderThan },
      })
      .lean();
  }
}
