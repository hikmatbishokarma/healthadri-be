import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ReminderEngineService } from './reminder-engine.service';
import { RespondReminderDto } from './dto/respond-reminder.dto';
import { BulkRespondReminderDto } from './dto/bulk-respond-reminder.dto';
import { ReminderResponse } from './schemas/reminder-event.schema';
import { UsersService } from '../users/users.service';

@Controller('reminders')
export class ReminderEngineController {
  constructor(
    private readonly reminderService: ReminderEngineService,
    private readonly usersService: UsersService,
  ) {}

  @Get()
  getForPatient(
    @Query('patientId') patientId: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reminderService.getForPatient(patientId, {
      status,
      limit: limit ? parseInt(limit, 10) : undefined,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
  }

  @Get('summary/:patientId')
  getSummary(@Param('patientId') patientId: string) {
    return this.reminderService.getAdherenceSummary(patientId);
  }

  @Get('weekly-report/:patientId')
  getWeeklyReport(@Param('patientId') patientId: string) {
    return this.reminderService.getWeeklyReport(patientId);
  }

  @Get('navigator/:navigatorId/overview')
  getNavigatorAdherenceOverview(
    @Param('navigatorId') navigatorId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('tab') tab = 'all',
  ) {
    return this.reminderService.getNavigatorAdherenceOverview(
      navigatorId,
      parseInt(page, 10),
      parseInt(limit, 10),
      tab,
    );
  }

  @Get('navigator/:navigatorId')
  async getForNavigator(
    @Param('navigatorId') navigatorId: string,
    @Query('status') status?: string,
  ) {
    const patients = await this.usersService.findPatientsByNavigator(navigatorId);
    const patientIds = patients.map((p) => String(p._id));
    return this.reminderService.getForNavigatorPatients(patientIds, status);
  }

  @Post(':id/respond')
  respond(@Param('id') id: string, @Body() dto: RespondReminderDto) {
    return this.reminderService.respond(
      id,
      dto.response as ReminderResponse,
      dto.snoozedUntil ? new Date(dto.snoozedUntil) : undefined,
      dto.skipReason,
    );
  }

  @Post('bulk-respond')
  bulkRespond(@Body() dto: BulkRespondReminderDto) {
    return this.reminderService.bulkRespond(
      dto.patientId,
      new Date(dto.scheduledAt),
      dto.response as ReminderResponse,
      dto.skipReason,
    );
  }

  // Manual trigger for testing — generates reminders immediately
  @Post('trigger/generate')
  async triggerGenerate() {
    await this.reminderService.generateDueReminders();
    return { ok: true };
  }

  // Manual trigger for testing — dispatches due push notifications
  @Post('trigger/dispatch')
  async triggerDispatch() {
    await this.reminderService.dispatchDueNotifications();
    return { ok: true };
  }

  // DEV ONLY — send a test notification immediately to a patient
  @Post('trigger/test/:patientId')
  async triggerTest(@Param('patientId') patientId: string) {
    await this.reminderService.sendTestNotification(patientId);
    return { ok: true };
  }
}
