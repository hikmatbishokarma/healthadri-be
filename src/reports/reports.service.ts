import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  SymptomEntry,
  SymptomEntryDocument,
} from '../symptom-entry/symptom-entry.schema';

const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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

    // Current calendar week: Sunday 00:00 → next Sunday 00:00 (server local time)
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(start.getDate() + 7);

    const entries = await this.entryModel
      .find({
        patientId: new Types.ObjectId(patientId),
        createdAt: { $gte: start, $lt: end },
      })
      .lean();

    const data: Record<string, number[]> = {};

    for (const entry of entries) {
      const dayIdx = new Date(entry.createdAt as Date).getDay();
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

    return { weekDays: WEEK_DAYS, data };
  }
}
