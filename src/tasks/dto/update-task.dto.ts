import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateTaskDto {
  @IsOptional()
  @IsIn(['visit', 'test'])
  type?: 'visit' | 'test';

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsDateString()
  date?: string;
}
