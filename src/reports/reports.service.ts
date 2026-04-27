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

  async getWeekly(patientId: string) {
    if (!patientId || !Types.ObjectId.isValid(patientId)) {
      throw new BadRequestException('valid patientId is required');
    }

    // Rolling 7-day window ending today (IST), so column 6 is always today.
    const todayStart = startOfDayIST(new Date());
    const start = addDays(todayStart, -6);
    const end = addDays(todayStart, 1);

    const weekDays: string[] = [];
    for (let i = 0; i < 7; i++) {
      weekDays.push(dayNameIST(addDays(start, i)));
    }

    const entries = await this.entryModel
      .find({
        patientId: new Types.ObjectId(patientId),
        createdAt: { $gte: start, $lt: end },
      })
      .lean();

    const data: Record<string, number[]> = {};

    for (const entry of entries) {
      const entryDayStart = startOfDayIST(new Date(entry.createdAt as Date));
      const dayIdx = Math.round(
        (entryDayStart.getTime() - start.getTime()) / (24 * 60 * 60 * 1000),
      );
      if (dayIdx < 0 || dayIdx > 6) continue;

      for (const r of entry.responses || []) {
        if (!r?.name) continue;
        if (!data[r.name]) {
          data[r.name] = [0, 0, 0, 0, 0, 0, 0];
        }
        const value = Number(r.value) || 0;
        if (value > data[r.name][dayIdx]) {
          data[r.name][dayIdx] = value;
        }
      }
    }

    return { weekDays, data };
  }
}
