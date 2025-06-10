import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayInit,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { ChatService } from './chat.service';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: 'http://localhost:3000',
    credentials: true,
  },
})
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly chatService: ChatService
  ) {}

  afterInit(server: Server) {
    this.chatService.init(server);
  }

  async handleConnection(client: Socket) {
    const cookieHeader = client.handshake.headers.cookie;
    if (!cookieHeader) {
      client.disconnect();
      return;
    }
    const accessToken = cookieHeader
      .split('; ')
      .find(str => str.startsWith('accessToken='))
      ?.split('=')[1];
    if (!accessToken) {
      client.disconnect();
      return;
    }
    try {
      const payload = await this.jwt.verifyAsync(accessToken);
      client.data.userId = payload.id;
    } catch {
      client.disconnect();
      return;
    }
  }

  async handleDisconnect(client: Socket) {}

  @SubscribeMessage('join')
  async onJoin(
    @MessageBody() payload: { chatId: string },
    @ConnectedSocket() client: Socket
  ) {
    const { chatId } = payload;

    client.join(chatId);
    // Можно отправить историю, но обычно историю запрашивают по REST
    // this.server.to(chatId).emit('userJoined', { userId, chatId });
  }

  @SubscribeMessage('leave')
  async onLeave(
    @MessageBody() payload: { chatId: string },
    @ConnectedSocket() client: Socket
  ) {
    const { chatId } = payload;
    client.leave(chatId);
  }

  @SubscribeMessage('message')
  async onMessage(
    @MessageBody()
    payload: { chatId: string; text?: string; attachmentUrl?: string },
    @ConnectedSocket() client: Socket
  ) {
    const userId = client.data.userId;
    const { chatId, text, attachmentUrl } = payload;
    try {
      const msg = await this.chatService.createMessage({
        senderId: userId,
        chatId,
        text,
        attachmentUrl,
      });
      // Броадкастим в комнату
      this.chatService.broadcastMessage(chatId, msg);
    } catch (err) {
      client.emit('error', err.message || 'Ошибка отправки сообщения');
    }
  }

  @SubscribeMessage('typing')
  async onTyping(
    @MessageBody() payload: { chatId: string; isTyping: boolean },
    @ConnectedSocket() client: Socket
  ) {
    const userId = client.data.userId;
    const { chatId, isTyping } = payload;
    // Проверка прав не обязательна для typing, но можно
    this.chatService.broadcastTyping(chatId, userId, isTyping);
  }
}
