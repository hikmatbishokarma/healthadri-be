import { IsIn, IsOptional, IsString, Length, Matches } from 'class-validator';

export class VerifyOtpDto {
  @IsString()
  @Matches(/^\+?[0-9]{7,15}$/, { message: 'phone must be a valid phone number' })
  phone: string;

  @IsString()
  @Length(4, 4)
  otp: string;

  @IsOptional()
  @IsIn(['patient', 'caregiver', 'navigator'])
  role?: 'patient' | 'caregiver' | 'navigator';
}
