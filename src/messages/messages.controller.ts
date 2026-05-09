import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { HeartbeatDto, SendMessageDto } from './dto/send-message.dto';

@Controller('messages')
export class MessagesController {
  constructor(private messagesService: MessagesService) {}

  @Get('thread/:patientId')
  async getThread(
    @Param('patientId') patientId: string,
    @Query('since') since?: string,
    @Query('callerRole') callerRole?: string,
  ) {
    return this.messagesService.getThread(patientId, since, callerRole ?? 'patient');
  }

  @Post('send')
  async send(@Body() dto: SendMessageDto) {
    return this.messagesService.send(dto);
  }

  @Get('inbox/:navigatorId')
  async getInbox(@Param('navigatorId') navigatorId: string) {
    return this.messagesService.getInbox(navigatorId);
  }

  @Post('read/:conversationId')
  async markRead(@Param('conversationId') conversationId: string) {
    return this.messagesService.markRead(conversationId);
  }

  @Post('heartbeat')
  async heartbeat(@Body() dto: HeartbeatDto) {
    return this.messagesService.heartbeat(dto.navigatorId);
  }
}
