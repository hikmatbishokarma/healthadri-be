import { Injectable } from '@nestjs/common';
import { AlertsService } from '../alerts/alerts.service';
import { PlaybooksService } from '../playbooks/playbooks.service';
import { startOfDayIST } from '../common/ist-date';

@Injectable()
export class TriageService {
  constructor(
    private alertsService: AlertsService,
    private playbooksService: PlaybooksService,
  ) {}

  async findLatestForPatient(patientId: string) {
    const alert = await this.alertsService.findOneLatestByPatient(patientId);
    if (!alert) return null;

    const createdAt = (alert as unknown as { createdAt?: Date }).createdAt;
    if (!createdAt || createdAt < startOfDayIST(new Date())) {
      return null;
    }

    const playbook = await this.playbooksService.findByTriggerType(alert.type);
    return { alert, playbook };
  }
}
