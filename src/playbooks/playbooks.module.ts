import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Playbook, PlaybookSchema } from './playbook.schema';
import { PlaybooksService } from './playbooks.service';
import { PlaybooksController } from './playbooks.controller';

@Module({
  imports: [MongooseModule.forFeature([{ name: Playbook.name, schema: PlaybookSchema }])],
  controllers: [PlaybooksController],
  providers: [PlaybooksService],
  exports: [PlaybooksService],
})
export class PlaybooksModule {}
