import { Injectable, NotFoundException } from '@nestjs/common';
import { AlertsService } from '../alerts/alerts.service';
import { PlaybooksService } from '../playbooks/playbooks.service';
import { UsersService } from '../users/users.service';

const SEVERITY_ORDER = { HIGH: 0, MED: 1, LOW: 2 };

type SeverityKey = keyof typeof SEVERITY_ORDER;

@Injectable()
export class NavigatorService {
  constructor(
    private alertsService: AlertsService,
    private playbooksService: PlaybooksService,
    private usersService: UsersService,
  ) {}

  async getDashboard(navigatorId: string) {
    const alerts = await this.alertsService.findPendingByNavigator(navigatorId);

    const patientMap = new Map<string, any>();
    for (const alert of alerts) {
      const patient = alert.patientId as any;
      const pid = patient._id.toString();
      const current = patientMap.get(pid);
      if (
        !current ||
        SEVERITY_ORDER[alert.severity as SeverityKey] <
          SEVERITY_ORDER[current.severity as SeverityKey]
      ) {
        patientMap.set(pid, {
          _id: pid,
          name: patient.name,
          gender: patient.gender,
          cancerType: patient.cancerType,
          stage: patient.cancerStage,
          severity: alert.severity,
          reason: alert.reason,
          alertType: alert.type,
        });
      }
    }

    const patients = Array.from(patientMap.values()).sort(
      (a, b) =>
        SEVERITY_ORDER[a.severity as SeverityKey] -
        SEVERITY_ORDER[b.severity as SeverityKey],
    );

    const highPriorityToday = alerts.filter((a) => a.severity === 'HIGH').length;

    const priorityQueueText = this.buildPriorityQueueText(patients);

    return {
      summary: {
        activePatients: patientMap.size,
        highPriorityToday,
        actionsPending: alerts.length,
      },
      priorityQueueText,
      patients,
    };
  }

  async getPlaybookRun(patientId: string) {
    const patient = await this.usersService.findById(patientId);
    if (!patient) throw new NotFoundException(`Patient ${patientId} not found`);

    const alert = await this.alertsService.findOneLatestByPatient(patientId);
    if (!alert) {
      return { patient, alert: null, playbook: null, otherActive: [] };
    }

    const playbook = await this.playbooksService.findByTriggerType(alert.type);

    const otherAlerts = patient.assignedNavigatorId
      ? await this.alertsService.findPendingByNavigator(
          patient.assignedNavigatorId.toString(),
        )
      : [];

    const seenPatients = new Set<string>([patientId]);
    const otherActive: Array<{
      patientId: string;
      patientName: string;
      severity: string;
      type: string;
      title: string;
      stepIndex: number;
      stepTotal: number;
      triggeredAt: Date | null;
    }> = [];

    for (const a of otherAlerts) {
      const p = a.patientId as any;
      const pid = p?._id?.toString?.();
      if (!pid || seenPatients.has(pid)) continue;
      seenPatients.add(pid);
      const pb = await this.playbooksService.findByTriggerType(a.type);
      otherActive.push({
        patientId: pid,
        patientName: p.name,
        severity: a.severity,
        type: a.type,
        title: pb?.title || a.type,
        stepIndex: (pb?.autoCompletedCount ?? 0) + 1,
        stepTotal: pb?.steps?.length || 0,
        triggeredAt: (a as any).createdAt || null,
      });
    }

    return { patient, alert, playbook, otherActive };
  }

  private buildPriorityQueueText(patients: any[]): string {
    const top = patients.slice(0, 3);
    if (top.length === 0) return 'No active playbooks today.';
    const phrases = top.map((p) => {
      const reason = p.reason || p.alertType;
      const firstName = (p.name || 'Patient').split(' ')[0];
      return `${firstName} (${(reason || '').toLowerCase()})`;
    });
    const joined =
      phrases.length === 1
        ? phrases[0]
        : phrases.length === 2
          ? `${phrases[0]} and ${phrases[1]}`
          : `${phrases.slice(0, -1).join(', ')}, ${phrases[phrases.length - 1]}`;
    return `${top.length} patient${top.length === 1 ? '' : 's'} triggered playbooks overnight. ${joined}. Prioritised in order below.`;
  }
}
