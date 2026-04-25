import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { SymptomsService } from './symptoms.service';
import { CreateSymptomDto } from './dto/create-symptom.dto';
import { UpdateSymptomDto } from './dto/update-symptom.dto';

@Controller('symptoms')
export class SymptomsController {
  constructor(private symptomsService: SymptomsService) {}

  @Get()
  async findAll() {
    return this.symptomsService.findAll();
  }

  @Post()
  async create(@Body() dto: CreateSymptomDto) {
    return this.symptomsService.create(dto);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateSymptomDto) {
    return this.symptomsService.update(id, dto);
  }
}
