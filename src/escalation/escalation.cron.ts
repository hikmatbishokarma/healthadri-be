import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EscalationService } from './escalation.service';
import { ReminderEngineService } from '../reminder-engine/reminder-engine.service';

const MISSED_THRESHOLD = 3;
const MISSED_WINDOW_HOURS = 48;
const CAREGIVER_ESCALATION_HOURS = 6;

@Injectable()
export class EscalationCron {
  private readonly logger = new Logger(EscalationCron.name);

  constructor(
    private readonly escalationService: EscalationService,
    private readonly reminderService: ReminderEngineService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async checkMissedReminders() {
    this.logger.debug('Checking patients with recent missed reminders');
    const since = new Date(Date.now() - MISSED_WINDOW_HOURS * 60 * 60 * 1000);
    const patientIds = await this.reminderService.getPatientIdsWithRecentMissed(
      since,
      MISSED_THRESHOLD,
    );
    for (const patientId of patientIds) {
      await this.escalationService.checkPatientEscalation(patientId, MISSED_THRESHOLD);
    }
  }

  // Every hour — immediately escalate to navigator if a CRITICAL med was missed in last 24h
  @Cron(CronExpression.EVERY_HOUR)
  async checkCriticalMedicationMisses() {
    this.logger.debug('Checking critical medication misses');
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const criticalMisses = await this.reminderService.getCriticalMissedReminders(since);
    for (const { patientId, taskTitle } of criticalMisses) {
      await this.escalationService.createCriticalMedicationEscalation(patientId, taskTitle);
    }
  }

  // Every 2 hours — auto-promote stale caregiver-level escalations to navigator
  @Cron('0 0 */2 * * *')
  async autoEscalateStaleToNavigator() {
    this.logger.debug('Auto-escalating stale caregiver escalations');
    const cutoff = new Date(Date.now() - CAREGIVER_ESCALATION_HOURS * 60 * 60 * 1000);
    const stale = await this.escalationService.findStaleCaregiverEscalations(cutoff);
    for (const esc of stale) {
      await this.escalationService.escalateToNavigator(
        (esc as unknown as { _id: { toString(): string } })._id.toString(),
      );
    }
    if (stale.length > 0) {
      this.logger.log(`Auto-escalated ${stale.length} caregiver escalations to navigator`);
    }
  }
}
