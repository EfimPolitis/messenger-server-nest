import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '@/prisma.service';
import { CreateChatDto } from './dto/create-chat.dto';

@Injectable()
export class ChatService {
  private server: Server;

  constructor(private readonly prisma: PrismaService) {}

  init(server: Server) {
    this.server = server;
  }

  async createChat(dto: CreateChatDto) {
    if (dto.participantIds[0] === dto.participantIds[1]) {
      throw new BadRequestException('Нельзя создать чат с самим собой');
    }

    const user1Id = dto.participantIds[0];
    const user2Id = dto.participantIds[1];

    const possibleChats = await this.prisma.chat.findMany({
      where: {
        participants: {
          some: { userId: user1Id },
        },
      },
      include: {
        participants: true,
      },
    });

    for (const chat of possibleChats) {
      const userIds = chat.participants.map(p => p.userId);
      if (userIds.includes(user2Id)) {
        // найден уже существующий приватный чат
        return chat;
      }
    }

    // иначе создаём новый
    const chat = await this.prisma.chat.create({ data: {} });

    // Добавляем двух участников
    await this.prisma.chatParticipant.createMany({
      data: [
        { chatId: chat.id, userId: user1Id },
        { chatId: chat.id, userId: user2Id },
      ],
      skipDuplicates: true,
    });
    return chat;
  }

  async getUserChats(userId: string) {
    const chats = await this.prisma.chat.findMany({
      where: {
        participants: {
          some: { userId },
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, name: true, surname: true, avatarPath: true },
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    const sortedChats = chats.sort((a, b) => {
      const aDate = a.messages[0]?.createdAt ?? new Date(0);
      const bDate = b.messages[0]?.createdAt ?? new Date(0);
      return bDate.getTime() - aDate.getTime();
    });

    return sortedChats;
  }

  async getParticipants(chatId: string) {
    const parts = await this.prisma.chatParticipant.findMany({
      where: { chatId },
      include: {
        user: {
          select: { id: true, name: true, surname: true, avatarPath: true },
        },
      },
    });
    return parts;
  }

  /** Получить историю сообщений чата (REST) */
  async getMessages(userId: string, chatId: string, limit = 50, offset = 0) {
    // Сначала проверяем, что пользователь участник
    const part = await this.prisma.chatParticipant.findUnique({
      where: { chatId_userId: { chatId, userId } },
    });
    if (!part)
      throw new ForbiddenException('Нет доступа к сообщениям этого чата.');
    const messages = await this.prisma.message.findMany({
      where: {
        chatId,
        deleted: false,
      },
      orderBy: { createdAt: 'asc' },
      skip: offset,
      take: limit,
      include: {
        sender: {
          select: { id: true, name: true, surname: true, avatarPath: true },
        },
        chat: {
          include: {
            participants: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    surname: true,
                    email: true,
                    avatarPath: true,
                    password: false,
                  },
                },
              },
            },
          },
        },
      },
    });

    return messages;
  }

  /** Создать и отправить сообщение (вызывается из WebSocket) */
  async createMessage(params: {
    senderId: string;
    chatId: string;
    text?: string;
    attachmentUrl?: string;
  }) {
    const { senderId, chatId, text, attachmentUrl } = params;
    // Проверяем права
    const part = await this.prisma.chatParticipant.findUnique({
      where: { chatId_userId: { chatId, userId: senderId } },
    });
    if (!part) {
      throw new ForbiddenException('Вы не участник чата.');
    }
    // Сохраняем
    const message = await this.prisma.message.create({
      data: {
        chatId,
        senderId,
        text,
        filePath: attachmentUrl,
      },
      include: {
        sender: {
          select: { id: true, name: true, surname: true, avatarPath: true },
        },
      },
    });
    return message;
  }

  /** Броадкаст сообщения всем участникам чата */
  broadcastMessage(chatId: string, msg: any) {
    if (!this.server) {
      return;
    }
    // предположим, что в WebSocket-клиенте мы подписываемся на room с именем chatId
    this.server.to(chatId).emit('message', msg);
  }

  /** Типинг-индикатор (опционально) */
  broadcastTyping(chatId: string, userId: string, isTyping: boolean) {
    if (!this.server) return;
    this.server.to(chatId).emit('typing', { userId, isTyping });
  }
}
