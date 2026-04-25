import { Module } from '@nestjs/common';
import { TriageController } from './triage.controller';
import { TriageService } from './triage.service';
import { AlertsModule } from '../alerts/alerts.module';
import { PlaybooksModule } from '../playbooks/playbooks.module';

@Module({
  imports: [AlertsModule, PlaybooksModule],
  controllers: [TriageController],
  providers: [TriageService],
})
export class TriageModule {}
