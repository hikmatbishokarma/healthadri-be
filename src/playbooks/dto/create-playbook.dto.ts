import { ArrayMinSize, IsArray, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreatePlaybookDto {
  @IsString()
  @Matches(/^[A-Z][A-Z0-9_]{1,60}$/, {
    message: 'triggerType must be UPPER_SNAKE_CASE (e.g. HIGH_FATIGUE)',
  })
  triggerType: string;

  @IsString()
  @MinLength(3)
  @MaxLength(120)
  title: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  steps: string[];
}
