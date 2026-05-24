import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ReminderEngineService } from './reminder-engine.service';

@Injectable()
export class ReminderEngineCron {
  private readonly logger = new Logger(ReminderEngineCron.name);

  constructor(private readonly reminderService: ReminderEngineService) {}

  // Every hour — generate reminder events for the next 7 days
  @Cron(CronExpression.EVERY_HOUR)
  async generateDueReminders() {
    this.logger.debug('Running generateDueReminders');
    await this.reminderService.generateDueReminders();
  }

  // Every 5 minutes — dispatch push notifications for reminders whose notifyAt has passed
  @Cron('0 */5 * * * *')
  async dispatchDueNotifications() {
    await this.reminderService.dispatchDueNotifications();
  }

  // Every 30 minutes — mark SENT/PENDING reminders past their response window as MISSED
  @Cron('0 */30 * * * *')
  async detectMissedReminders() {
    this.logger.debug('Running detectMissedReminders');
    await this.reminderService.detectMissedReminders();
  }

  // Every 30 minutes — convert ignored SKIPPED reminders (>2h old) to MISSED
  @Cron('15 */30 * * * *')
  async processSkippedFollowups() {
    await this.reminderService.processSkippedFollowups();
  }

  // Every 15 minutes — re-queue snoozed reminders whose snooze has expired
  @Cron('0 */15 * * * *')
  async processSnoozes() {
    await this.reminderService.processSnoozes();
  }
}
