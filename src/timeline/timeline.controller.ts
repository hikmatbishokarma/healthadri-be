import { Controller, Get, Query } from '@nestjs/common';
import { TimelineService } from './timeline.service';
import { TimelineEventType } from './timeline.schema';

@Controller('timeline')
export class TimelineController {
  constructor(private readonly timelineService: TimelineService) {}

  @Get()
  query(
    @Query('patientId') patientId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('types') types?: string | string[],
    @Query('limit') limit?: string,
  ) {
    const typeList = types
      ? (Array.isArray(types) ? types : types.split(',')) as TimelineEventType[]
      : undefined;

    return this.timelineService.query(patientId, {
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      types: typeList,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }
}
