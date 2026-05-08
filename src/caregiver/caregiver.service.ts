import { Injectable, NotFoundException } from '@nestjs/common';
import { AlertsService } from '../alerts/alerts.service';
import { AppointmentsService } from '../appointments/appointments.service';
import { SymptomEntryService } from '../symptom-entry/symptom-entry.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class CaregiverService {
  constructor(
    private usersService: UsersService,
    private symptomEntryService: SymptomEntryService,
    private alertsService: AlertsService,
    private appointmentsService: AppointmentsService,
  ) {}

  async getPatientStatus(caregiverId: string) {
    const caregiver = await this.usersService.findById(caregiverId);
    if (!caregiver?.linkedPatientId) {
      throw new NotFoundException('No linked patient found for this caregiver');
    }

    const patientId = caregiver.linkedPatientId.toString();

    const [patient, latestEntry, pendingAlerts, allAppointments] = await Promise.all([
      this.usersService.findById(patientId),
      this.symptomEntryService.findLatestByPatient(patientId),
      this.alertsService.findLatestByPatient(patientId),
      this.appointmentsService.findByPatient(patientId),
    ]);

    if (!patient) throw new NotFoundException('Linked patient not found');

    let navigator = null;
    if (patient.assignedNavigatorId) {
      navigator = await this.usersService.findById(patient.assignedNavigatorId.toString());
    }

    const now = new Date();
    const upcomingAppointments = allAppointments
      .filter((a) => new Date(a.scheduledAt) > now)
      .slice(0, 5);

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
      upcomingAppointments,
    };
  }
}
