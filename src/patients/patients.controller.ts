import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { SymptomEntryService } from '../symptom-entry/symptom-entry.service';

@Controller('patients')
export class PatientsController {
  constructor(
    private usersService: UsersService,
    private symptomEntryService: SymptomEntryService,
  ) {}

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const patient = await this.usersService.findById(id);
    if (!patient) throw new NotFoundException(`Patient ${id} not found`);

    const [latestEntry, history] = await Promise.all([
      this.symptomEntryService.findLatestByPatient(id),
      this.symptomEntryService.findLastNByPatient(id, 5),
    ]);

    return { patient, latestEntry, history };
  }
}
