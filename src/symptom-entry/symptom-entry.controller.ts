import { Controller, Post, Body, Get, Query } from '@nestjs/common';
import { SymptomEntryService } from './symptom-entry.service';
import { CreateSymptomEntryDto } from './dto/create-symptom-entry.dto';

@Controller('symptom-entry')
export class SymptomEntryController {
  constructor(private symptomEntryService: SymptomEntryService) {}

  @Post()
  async create(@Body() dto: CreateSymptomEntryDto) {
    return this.symptomEntryService.create(dto);
  }

  @Get('history')
  async history(
    @Query('patientId') patientId: string,
    @Query('days') days?: string,
  ) {
    const n = days ? parseInt(days, 10) : 7;
    return this.symptomEntryService.findLastNByPatient(patientId, n);
  }
}
