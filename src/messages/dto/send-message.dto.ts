import { IsEnum, IsMongoId, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class SendMessageDto {
  @IsMongoId()
  patientId: string;

  @IsMongoId()
  senderId: string;

  @IsEnum(['patient', 'caregiver', 'navigator'])
  senderType: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  body: string;

  // Navigator reply scope — who sees this message
  @IsOptional()
  @IsEnum(['both', 'patient', 'caregiver'])
  scope?: string;
}

export class HeartbeatDto {
  @IsMongoId()
  navigatorId: string;
}
