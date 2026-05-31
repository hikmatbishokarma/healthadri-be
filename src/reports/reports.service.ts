import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  SymptomEntry,
  SymptomEntryDocument,
} from '../symptom-entry/symptom-entry.schema';
import { addDays, dayNameIST, startOfDayIST } from '../common/ist-date';

@Injectable()
export class ReportsService {
  constructor(
    @InjectModel(SymptomEntry.name)
    private entryModel: Model<SymptomEntryDocument>,
  ) {}

  async getWeekly(patientId: string, weeksBack = 0) {
    if (!patientId || !Types.ObjectId.isValid(patientId)) {
      throw new BadRequestException('valid patientId is required');
    }

    const n = 7;
    const todayStart = startOfDayIST(new Date());
    // Slide the 7-day window back by weeksBack weeks
    const windowEnd = addDays(todayStart, 1 - weeksBack * 7);
    const start = addDays(windowEnd, -7);
    const end = windowEnd;

    const weekDays: string[] = [];
    for (let i = 0; i < n; i++) {
      weekDays.push(dayNameIST(addDays(start, i)));
    }

    const entries = await this.entryModel
      .find({
        patientId: new Types.ObjectId(patientId),
        createdAt: { $gte: start, $lt: end },
      })
      .lean();

    const data: Record<string, (number | null)[]> = {};

    for (const entry of entries) {
      const entryDayStart = startOfDayIST(new Date(entry.createdAt as Date));
      const dayIdx = Math.round(
        (entryDayStart.getTime() - start.getTime()) / (24 * 60 * 60 * 1000),
      );
      if (dayIdx < 0 || dayIdx >= 7) continue;

      for (const r of entry.responses || []) {
        if (!r?.name) continue;
        if (!data[r.name]) {
          data[r.name] = Array(n).fill(null);
        }
        const value = Number(r.value) || 0;
        const current = data[r.name][dayIdx];
        if (current === null || value > current) {
          data[r.name][dayIdx] = value;
        }
      }
    }

    return { weekDays, data };
  }
}
