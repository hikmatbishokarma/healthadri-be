import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { HospitalsService } from './hospitals.service';
import { CreateHospitalDto } from './dto/create-hospital.dto';
import { UpdateHospitalDto } from './dto/update-hospital.dto';

@Controller('hospitals')
export class HospitalsController {
  constructor(private hospitalsService: HospitalsService) {}

  @Get()
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('type') type?: string,
    @Query('city') city?: string,
    @Query('sortBy') sortBy?: string,
    @Query('order') order?: 'asc' | 'desc',
  ) {
    return this.hospitalsService.findAll({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      search,
      type,
      city,
      sortBy,
      order,
    });
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.hospitalsService.findOne(id);
  }

  @Post()
  async create(@Body() dto: CreateHospitalDto) {
    return this.hospitalsService.create(dto);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateHospitalDto) {
    return this.hospitalsService.update(id, dto);
  }
}
