import { IsOptional, IsString } from 'class-validator';

export class SendMessageDto {
  @IsString()
  chatId: string;

  @IsOptional()
  @IsString()
  text: string;

  @IsOptional()
  @IsString()
  attachmentUrl?: string;
}
