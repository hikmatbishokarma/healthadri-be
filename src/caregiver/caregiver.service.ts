import { Injectable, NotFoundException } from '@nestjs/common';
import { AlertsService } from '../alerts/alerts.service';
import { SymptomEntryService } from '../symptom-entry/symptom-entry.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class CaregiverService {
  constructor(
    private usersService: UsersService,
    private symptomEntryService: SymptomEntryService,
    private alertsService: AlertsService,
  ) {}

  async getPatientStatus(caregiverId: string) {
    const caregiver = await this.usersService.findById(caregiverId);
    if (!caregiver?.linkedPatientId) {
      throw new NotFoundException('No linked patient found for this caregiver');
    }

    const patientId = caregiver.linkedPatientId.toString();

    const [patient, latestEntry, pendingAlerts] = await Promise.all([
      this.usersService.findById(patientId),
      this.symptomEntryService.findLatestByPatient(patientId),
      this.alertsService.findLatestByPatient(patientId),
    ]);

    if (!patient) throw new NotFoundException('Linked patient not found');

    let navigator = null;
    if (patient.assignedNavigatorId) {
      navigator = await this.usersService.findById(patient.assignedNavigatorId.toString());
    }

    return {
      patient: {
        _id: patient._id,
        name: patient.name,
        cancerType: patient.cancerType,
        cancerStage: patient.cancerStage,
        acuityScore: patient.acuityScore,
        patientCode: patient.patientCode,
      },
      navigator: navigator
        ? { _id: navigator._id, name: navigator.name, phone: navigator.phone }
        : null,
      latestEntry,
      recentAlerts: pendingAlerts.filter((a) => a.status === 'pending').slice(0, 5),
    };
  }
}
