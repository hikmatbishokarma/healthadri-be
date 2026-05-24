import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CarePlanVersion, CarePlanVersionSchema } from './schemas/care-plan-version.schema';
import { CarePlanTask, CarePlanTaskSchema } from './schemas/care-plan-task.schema';
import { CarePlanService } from './care-plan.service';
import { CarePlanController } from './care-plan.controller';
import { UsersModule } from '../users/users.module';
import { TimelineModule } from '../timeline/timeline.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CarePlanVersion.name, schema: CarePlanVersionSchema },
      { name: CarePlanTask.name, schema: CarePlanTaskSchema },
    ]),
    UsersModule,
    TimelineModule,
    EventsModule,
  ],
  controllers: [CarePlanController],
  providers: [CarePlanService],
  exports: [
    CarePlanService,
    MongooseModule, // exports CarePlanVersion + CarePlanTask models to importing modules
  ],
})
export class CarePlanModule {}
