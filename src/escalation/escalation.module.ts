import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EscalationEvent, EscalationEventSchema } from './schemas/escalation-event.schema';
import { EscalationService } from './escalation.service';
import { EscalationCron } from './escalation.cron';
import { EscalationController } from './escalation.controller';
import { UsersModule } from '../users/users.module';
import { EventsModule } from '../events/events.module';
import { TimelineModule } from '../timeline/timeline.module';
import { ReminderEngineModule } from '../reminder-engine/reminder-engine.module';
import { CarePlanModule } from '../care-plan/care-plan.module';
import { PushNotificationsModule } from '../push-notifications/push-notifications.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: EscalationEvent.name, schema: EscalationEventSchema },
    ]),
    UsersModule,
    EventsModule,
    TimelineModule,
    forwardRef(() => ReminderEngineModule),
    CarePlanModule,
    PushNotificationsModule,
  ],
  controllers: [EscalationController],
  providers: [EscalationService, EscalationCron],
  exports: [EscalationService],
})
export class EscalationModule {}
