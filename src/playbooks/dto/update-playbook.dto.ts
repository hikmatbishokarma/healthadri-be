import { PartialType } from '@nestjs/mapped-types';
import { CreatePlaybookDto } from './create-playbook.dto';

export class UpdatePlaybookDto extends PartialType(CreatePlaybookDto) {}
