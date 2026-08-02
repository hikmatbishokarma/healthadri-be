import { Injectable, NotFoundException } from '@nestjs/common';
import { AlertsService } from '../alerts/alerts.service';
import { PlaybooksService } from '../playbooks/playbooks.service';
import { UsersService } from '../users/users.service';

const SEVERITY_ORDER = { HIGH: 0, MED: 1, LOW: 2 };

type SeverityKey = keyof typeof SEVERITY_ORDER;

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

@Injectable()
export class NavigatorService {
  constructor(
    private alertsService: AlertsService,
    private playbooksService: PlaybooksService,
    private usersService: UsersService,
  ) {}

  async getDashboard(navigatorId: string) {
    const today = startOfDay(new Date());
    const yesterday = startOfDay(new Date(Date.now() - 86_400_000));

    const [alerts, allPatients, todayHigh, yesterdayHigh, todayAlerts, yesterdayAlerts] =
      await Promise.all([
        this.alertsService.findPendingByNavigator(navigatorId),
        this.usersService.findPatientsByNavigator(navigatorId),
        this.alertsService.countByNavigatorSince(navigatorId, today, undefined, 'HIGH'),
        this.alertsService.countByNavigatorSince(navigatorId, yesterday, today, 'HIGH'),
        this.alertsService.countByNavigatorSince(navigatorId, today),
        this.alertsService.countByNavigatorSince(navigatorId, yesterday, today),
      ]);

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

    const priorityQueueText = this.buildPriorityQueueText(patients);

    return {
      summary: {
        totalPatients: allPatients.length,
        highPriority: alerts.filter((a) => a.severity === 'HIGH').length,
        highPriorityChange: todayHigh - yesterdayHigh,
        alerts: alerts.length,
        alertsChange: todayAlerts - yesterdayAlerts,
        followupsDue: 0,          // populated by appointments module when ready
        followupsDueChange: 0,
      },
      priorityQueueText,
      highPriorityPatients: patients.filter((p) => p.severity === 'HIGH').slice(0, 5),
      patients,
    };
  }

  async getPatientsList(navigatorId: string) {
    const allPatients = await this.usersService.findPatientsByNavigator(navigatorId);
    if (allPatients.length === 0) return [];

    const patientIds = allPatients.map((p) => (p as any)._id.toString());
    const pendingAlerts = await this.alertsService.findPendingByPatients(patientIds);

    // Build a map: patientId → highest-severity pending alert
    const alertMap = new Map<string, any>();
    for (const alert of pendingAlerts) {
      const pid = (alert.patientId as any).toString();
      const current = alertMap.get(pid);
      if (
        !current ||
        SEVERITY_ORDER[alert.severity as SeverityKey] <
          SEVERITY_ORDER[current.severity as SeverityKey]
      ) {
        alertMap.set(pid, alert);
      }
    }

    return allPatients.map((patient: any) => {
      const pid = patient._id.toString();
      const alert = alertMap.get(pid);
      return {
        _id: pid,
        name: patient.name,
        patientCode: patient.patientCode || '',
        cancerType: patient.cancerType || '',
        stage: patient.cancerStage || '',
        priority: (alert?.severity ?? 'LOW') as 'HIGH' | 'MED' | 'LOW',
        topSymptom: alert?.reason ?? null,
        alertType: alert?.type ?? null,
        lastUpdatedAt: alert?.updatedAt ?? patient.updatedAt ?? null,
        acuityScore: patient.acuityScore ?? 0,
      };
    }).sort(
      (a, b) =>
        SEVERITY_ORDER[a.priority as SeverityKey] -
        SEVERITY_ORDER[b.priority as SeverityKey],
    );
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
