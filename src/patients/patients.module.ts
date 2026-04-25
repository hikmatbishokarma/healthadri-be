import { Module } from '@nestjs/common';
import { PatientsController } from './patients.controller';
import { UsersModule } from '../users/users.module';
import { SymptomEntryModule } from '../symptom-entry/symptom-entry.module';

@Module({
  imports: [UsersModule, SymptomEntryModule],
  controllers: [PatientsController],
})
export class PatientsModule {}
