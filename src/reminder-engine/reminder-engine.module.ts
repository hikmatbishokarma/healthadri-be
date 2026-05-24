import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReminderEvent, ReminderEventSchema } from './schemas/reminder-event.schema';
import { ReminderEngineService } from './reminder-engine.service';
import { ReminderEngineCron } from './reminder-engine.cron';
import { ReminderEngineController } from './reminder-engine.controller';
import { CarePlanModule } from '../care-plan/care-plan.module';
import { TimelineModule } from '../timeline/timeline.module';
import { UsersModule } from '../users/users.module';
import { PushNotificationsModule } from '../push-notifications/push-notifications.module';
import { EventsModule } from '../events/events.module';
import { EscalationModule } from '../escalation/escalation.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ReminderEvent.name, schema: ReminderEventSchema },
    ]),
    CarePlanModule,
    TimelineModule,
    UsersModule,
    PushNotificationsModule,
    EventsModule,
    forwardRef(() => EscalationModule),
  ],
  controllers: [ReminderEngineController],
  providers: [ReminderEngineService, ReminderEngineCron],
  exports: [ReminderEngineService],
})
export class ReminderEngineModule {}
