import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { PlaybooksService } from './playbooks.service';
import { CreatePlaybookDto } from './dto/create-playbook.dto';
import { UpdatePlaybookDto } from './dto/update-playbook.dto';

@Controller('playbooks')
export class PlaybooksController {
  constructor(private playbooksService: PlaybooksService) {}

  @Get()
  async findAll() {
    return this.playbooksService.findAll();
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
