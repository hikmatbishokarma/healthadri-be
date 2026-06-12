import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { SymptomsModule } from './symptoms/symptoms.module';
import { SymptomEntryModule } from './symptom-entry/symptom-entry.module';
import { AlertsModule } from './alerts/alerts.module';
import { PlaybooksModule } from './playbooks/playbooks.module';
import { MessagesModule } from './messages/messages.module';
import { HospitalsModule } from './hospitals/hospitals.module';
import { DoctorsModule } from './doctors/doctors.module';
import { NavigatorModule } from './navigator/navigator.module';
import { PatientsModule } from './patients/patients.module';
import { TriageModule } from './triage/triage.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { DocumentsModule } from './documents/documents.module';
import { DocumentProcessingModule } from './document-processing/document-processing.module';
import { TasksModule } from './tasks/tasks.module';
import { ReportsModule } from './reports/reports.module';
import { AiModule } from './ai/ai.module';
import { InviteCodeModule } from './invite-code/invite-code.module';
import { CaregiverModule } from './caregiver/caregiver.module';
import { EventsModule } from './events/events.module';
import { VisitsModule } from './visits/visits.module';
import { TimelineModule } from './timeline/timeline.module';
import { ReviewQueueModule } from './review-queue/review-queue.module';
import { CarePlanModule } from './care-plan/care-plan.module';
import { ReminderEngineModule } from './reminder-engine/reminder-engine.module';
import { EscalationModule } from './escalation/escalation.module';
import { PushNotificationsModule } from './push-notifications/push-notifications.module';
import { MedicinesModule } from './medicines/medicines.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRoot(process.env.MONGO_URI || 'mongodb://localhost:27017/healthadri'),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    AuthModule,
    UsersModule,
    SymptomsModule,
    SymptomEntryModule,
    AlertsModule,
    PlaybooksModule,
    MessagesModule,
    HospitalsModule,
    DoctorsModule,
    NavigatorModule,
    PatientsModule,
    TriageModule,
    AppointmentsModule,
    DocumentsModule,
    DocumentProcessingModule,
    TasksModule,
    ReportsModule,
    AiModule,
    InviteCodeModule,
    CaregiverModule,
    EventsModule,
    VisitsModule,
    TimelineModule,
    ReviewQueueModule,
    CarePlanModule,
    ReminderEngineModule,
    EscalationModule,
    PushNotificationsModule,
    MedicinesModule,
  ],
})
export class AppModule {}
