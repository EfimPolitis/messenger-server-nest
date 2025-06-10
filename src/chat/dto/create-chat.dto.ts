import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

export class CreateChatDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  participantIds: string[];
}
