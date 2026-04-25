import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { SymptomEntry, SymptomEntryDocument } from './symptom-entry.schema';
import { SymptomsService } from '../symptoms/symptoms.service';
import { AlertsService } from '../alerts/alerts.service';
import { UsersService } from '../users/users.service';
import { PlaybooksService } from '../playbooks/playbooks.service';
import { CreateSymptomEntryDto } from './dto/create-symptom-entry.dto';

type Severity = 'HIGH' | 'MED' | 'LOW';

@Injectable()
export class SymptomEntryService {
  constructor(
    @InjectModel(SymptomEntry.name)
    private entryModel: Model<SymptomEntryDocument>,
    private symptomsService: SymptomsService,
    private alertsService: AlertsService,
    private usersService: UsersService,
    private playbooksService: PlaybooksService,
  ) {}

  private getSeverity(value: number): Severity {
    if (value >= 8) return 'HIGH';
    if (value >= 5) return 'MED';
    return 'LOW';
  }

  async create(dto: CreateSymptomEntryDto) {
    const patient = await this.usersService.findById(dto.patientId);
    if (!patient) throw new NotFoundException(`Patient ${dto.patientId} not found`);

    const enriched = await Promise.all(
      dto.responses.map(async (r) => ({
        symptom: await this.symptomsService.findById(r.symptomId),
        value: r.value,
        symptomId: r.symptomId,
      })),
    );

    const entry = await this.entryModel.create({
      patientId: new Types.ObjectId(dto.patientId),
      responses: enriched.map((e) => ({
        symptomId: new Types.ObjectId(e.symptomId),
        name: e.symptom?.name || 'Unknown',
        value: e.value,
      })),
    });

    const alerts = [];
    const playbookMap = new Map<string, { title: string; steps: string[] }>();

    for (const e of enriched) {
      if (!e.symptom) continue;
      if (e.value < e.symptom.threshold) continue;

      const typeKey = e.symptom.name.toUpperCase().replace(/\s+/g, '_');
      const alertType = `HIGH_${typeKey}`;

      const alert = await this.alertsService.create({
        patientId: new Types.ObjectId(dto.patientId),
        navigatorId: patient.assignedNavigatorId || null,
        type: alertType,
        severity: this.getSeverity(e.value),
        reason: `${e.symptom.name} ${e.value}/${e.symptom.max}`,
        status: 'pending',
      });
      alerts.push(alert);

      if (!playbookMap.has(alertType)) {
        const pb = await this.playbooksService.findByTriggerType(alertType);
        if (pb) {
          playbookMap.set(alertType, { title: pb.title, steps: pb.steps });
        }
      }
    }

    // Merge & de-dupe steps across all matched playbooks
    const seenSteps = new Set<string>();
    const guidance: string[] = [];
    for (const pb of playbookMap.values()) {
      for (const step of pb.steps) {
        const key = step.trim().toLowerCase();
        if (!seenSteps.has(key)) {
          seenSteps.add(key);
          guidance.push(step);
        }
      }
    }

    return { entry, alerts, guidance };
  }

  async findLatestByPatient(patientId: string) {
    return this.entryModel
      .findOne({ patientId: new Types.ObjectId(patientId) })
      .sort({ createdAt: -1 });
  }

  async findLastNByPatient(patientId: string, n: number) {
    return this.entryModel
      .find({ patientId: new Types.ObjectId(patientId) })
      .sort({ createdAt: -1 })
      .limit(n);
  }
}
