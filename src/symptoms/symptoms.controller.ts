import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { SymptomsService } from './symptoms.service';
import { CreateSymptomDto } from './dto/create-symptom.dto';
import { UpdateSymptomDto } from './dto/update-symptom.dto';

@Controller('symptoms')
export class SymptomsController {
  constructor(private symptomsService: SymptomsService) {}

  @Get()
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('order') order?: 'asc' | 'desc',
  ) {
    return this.symptomsService.findAll({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      search,
      sortBy,
      order,
    });
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
