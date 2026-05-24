import { PartialType } from '@nestjs/mapped-types';
import { CreateCarePlanTaskDto } from './create-care-plan-task.dto';

export class UpdateCarePlanTaskDto extends PartialType(CreateCarePlanTaskDto) {}
