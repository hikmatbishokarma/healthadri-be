import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SymptomEntry, SymptomEntrySchema } from './symptom-entry.schema';
import { SymptomEntryController } from './symptom-entry.controller';
import { SymptomEntryService } from './symptom-entry.service';
import { SymptomsModule } from '../symptoms/symptoms.module';
import { AlertsModule } from '../alerts/alerts.module';
import { UsersModule } from '../users/users.module';
import { PlaybooksModule } from '../playbooks/playbooks.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: SymptomEntry.name, schema: SymptomEntrySchema }]),
    SymptomsModule,
    AlertsModule,
    UsersModule,
    PlaybooksModule,
  ],
  controllers: [SymptomEntryController],
  providers: [SymptomEntryService],
  exports: [SymptomEntryService],
})
export class SymptomEntryModule {}
