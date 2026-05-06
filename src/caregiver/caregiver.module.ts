import { Module } from '@nestjs/common';
import { AlertsModule } from '../alerts/alerts.module';
import { SymptomEntryModule } from '../symptom-entry/symptom-entry.module';
import { UsersModule } from '../users/users.module';
import { CaregiverController } from './caregiver.controller';
import { CaregiverService } from './caregiver.service';

@Module({
  imports: [UsersModule, SymptomEntryModule, AlertsModule],
  controllers: [CaregiverController],
  providers: [CaregiverService],
})
export class CaregiverModule {}
