import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { PlaybooksService } from './playbooks.service';
import { CreatePlaybookDto } from './dto/create-playbook.dto';
import { UpdatePlaybookDto } from './dto/update-playbook.dto';

@Controller('playbooks')
export class PlaybooksController {
  constructor(private playbooksService: PlaybooksService) {}

  @Get()
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('order') order?: 'asc' | 'desc',
  ) {
    return this.playbooksService.findAll({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      search,
      sortBy,
      order,
    });
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.playbooksService.findById(id);
  }

  @Post()
  async create(@Body() dto: CreatePlaybookDto) {
    return this.playbooksService.create(dto);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdatePlaybookDto) {
    return this.playbooksService.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.playbooksService.remove(id);
  }
}
