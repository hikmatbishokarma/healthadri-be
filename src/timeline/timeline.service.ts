import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { TimelineEvent, TimelineEventDocument, TimelineEventType, ChangeType } from './timeline.schema';

export interface AppendTimelineDto {
  patientId: string;
  eventType: TimelineEventType;
  eventDate?: Date;
  description: string;
  changeType?: ChangeType;
  relatedEntityId?: string;
  relatedEntityType?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class TimelineService {
  constructor(
    @InjectModel(TimelineEvent.name) private timelineModel: Model<TimelineEventDocument>,
  ) {}

  async append(dto: AppendTimelineDto): Promise<TimelineEvent> {
    const event = new this.timelineModel({
      patientId: new Types.ObjectId(dto.patientId),
      eventType: dto.eventType,
      eventDate: dto.eventDate ?? new Date(),
      description: dto.description,
      changeType: dto.changeType ?? null,
      relatedEntityId: dto.relatedEntityId ? new Types.ObjectId(dto.relatedEntityId) : null,
      relatedEntityType: dto.relatedEntityType ?? null,
      metadata: dto.metadata ?? null,
    });
    return event.save();
  }

  async query(
    patientId: string,
    options: {
      from?: Date;
      to?: Date;
      types?: TimelineEventType[];
      limit?: number;
    } = {},
  ): Promise<TimelineEvent[]> {
    const filter: Record<string, unknown> = {
      patientId: new Types.ObjectId(patientId),
    };

    if (options.from || options.to) {
      const dateFilter: Record<string, Date> = {};
      if (options.from) dateFilter.$gte = options.from;
      if (options.to) dateFilter.$lte = options.to;
      filter.eventDate = dateFilter;
    }

    if (options.types?.length) {
      filter.eventType = { $in: options.types };
    }

    return this.timelineModel
      .find(filter)
      .sort({ eventDate: -1 })
      .limit(options.limit ?? 100)
      .lean();
  }
}
