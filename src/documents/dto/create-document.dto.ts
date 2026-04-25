import { IsIn, IsMongoId, IsOptional } from 'class-validator';

export class CreateDocumentDto {
  @IsMongoId()
  patientId: string;

  @IsOptional()
  @IsIn(['prescription', 'lab', 'discharge', 'other'])
  category?: string;
}
