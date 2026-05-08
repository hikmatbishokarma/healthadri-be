import { Module } from '@nestjs/common';
import { AlertsModule } from '../alerts/alerts.module';
import { AppointmentsModule } from '../appointments/appointments.module';
import { SymptomEntryModule } from '../symptom-entry/symptom-entry.module';
import { UsersModule } from '../users/users.module';
import { CaregiverController } from './caregiver.controller';
import { CaregiverService } from './caregiver.service';

@Module({
  imports: [UsersModule, SymptomEntryModule, AlertsModule, AppointmentsModule],
  controllers: [CaregiverController],
  providers: [CaregiverService],
})
export class CaregiverModule {}
