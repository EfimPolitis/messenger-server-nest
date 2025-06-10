import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { ChatService } from './chat.service';
import { CreateChatDto } from './dto/create-chat.dto';
import { Auth } from '@/auth/decorators/auth.decorator';
import { Role } from '@prisma/client';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Auth(Role.USER)
  @Post()
  async createChat(@Body() dto: CreateChatDto) {
    const chat = await this.chatService.createChat(dto);
    return chat;
  }

  @Auth(Role.USER)
  @Get(':userId')
  async getUserChats(@Param('userId') userId: string) {
    return this.chatService.getUserChats(userId);
  }

  // @Auth(Role.USER)
  @Get(':userId/:chatId/messages')
  async getMessages(
    @Param('userId') userId: string,
    @Param('chatId') chatId: string
  ) {
    return this.chatService.getMessages(userId, chatId);
  }
}
