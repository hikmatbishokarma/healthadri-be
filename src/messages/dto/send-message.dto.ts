import { IsMongoId, IsString, MaxLength, MinLength } from 'class-validator';

export class SendMessageDto {
  @IsMongoId()
  senderId: string;

  @IsMongoId()
  receiverId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  text: string;
}
