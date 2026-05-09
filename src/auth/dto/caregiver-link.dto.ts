import { IsString, Length, Matches } from 'class-validator';

export class CaregiverLinkDto {
  @IsString()
  tempToken: string;

  @IsString()
  @Matches(/^[A-Z]{2}-[0-9]{4}$/, { message: 'Invalid invite code format' })
  inviteCode: string;
}
