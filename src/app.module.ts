import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { SymptomsModule } from './symptoms/symptoms.module';
import { SymptomEntryModule } from './symptom-entry/symptom-entry.module';
import { AlertsModule } from './alerts/alerts.module';
import { PlaybooksModule } from './playbooks/playbooks.module';
import { MessagesModule } from './messages/messages.module';
import { HospitalsModule } from './hospitals/hospitals.module';
import { NavigatorModule } from './navigator/navigator.module';
import { PatientsModule } from './patients/patients.module';
import { TriageModule } from './triage/triage.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { DocumentsModule } from './documents/documents.module';
import { DocumentProcessingModule } from './document-processing/document-processing.module';
import { TasksModule } from './tasks/tasks.module';
import { ReportsModule } from './reports/reports.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRoot(process.env.MONGO_URI || 'mongodb://localhost:27017/healthadri'),
    AuthModule,
    UsersModule,
    SymptomsModule,
    SymptomEntryModule,
    AlertsModule,
    PlaybooksModule,
    MessagesModule,
    HospitalsModule,
    NavigatorModule,
    PatientsModule,
    TriageModule,
    AppointmentsModule,
    DocumentsModule,
    DocumentProcessingModule,
    TasksModule,
    ReportsModule,
  ],
})
export class AppModule {}
