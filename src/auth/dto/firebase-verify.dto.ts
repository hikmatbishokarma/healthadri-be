import { IsIn, IsOptional, IsString } from 'class-validator';

export class FirebaseVerifyDto {
  @IsString()
  idToken: string;

  @IsOptional()
  @IsIn(['patient', 'caregiver'])
  role?: 'patient' | 'caregiver';
}
