import { Module } from '@nestjs/common';
import { InviteCodeModule } from '../invite-code/invite-code.module';
import { SymptomEntryModule } from '../symptom-entry/symptom-entry.module';
import { UsersModule } from '../users/users.module';
import { PatientsController } from './patients.controller';

@Module({
  imports: [UsersModule, SymptomEntryModule, InviteCodeModule],
  controllers: [PatientsController],
})
export class PatientsModule {}
