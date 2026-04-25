import { Injectable } from '@nestjs/common';
import { AlertsService } from '../alerts/alerts.service';

const SEVERITY_ORDER = { HIGH: 0, MED: 1, LOW: 2 };

@Injectable()
export class NavigatorService {
  constructor(private alertsService: AlertsService) {}

  async getDashboard(navigatorId: string) {
    const alerts = await this.alertsService.findPendingByNavigator(navigatorId);

    const patientMap = new Map<string, any>();
    for (const alert of alerts) {
      const patient = alert.patientId as any;
      const pid = patient._id.toString();
      const current = patientMap.get(pid);
      if (!current || SEVERITY_ORDER[alert.severity] < SEVERITY_ORDER[current.severity]) {
        patientMap.set(pid, {
          _id: pid,
          name: patient.name,
          cancerType: patient.cancerType,
          stage: patient.cancerStage,
          severity: alert.severity,
          reason: alert.reason,
        });
      }
    }

    const patients = Array.from(patientMap.values()).sort(
      (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
    );

    const highPriorityToday = alerts.filter((a) => a.severity === 'HIGH').length;

    return {
      summary: {
        activePatients: patientMap.size,
        highPriorityToday,
        actionsPending: alerts.length,
      },
      patients,
    };
  }
}
