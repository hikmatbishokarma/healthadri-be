import { Controller, Get, Post, Param, Body, Query } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { SendMessageDto } from './dto/send-message.dto';

@Controller('messages')
export class MessagesController {
  constructor(private messagesService: MessagesService) {}

  @Get(':userId')
  async getConversation(
    @Param('userId') userId: string,
    @Query('with') withUserId: string,
  ) {
    return this.messagesService.getConversation(userId, withUserId);
  }

  @Post()
  async send(@Body() dto: SendMessageDto) {
    return this.messagesService.send(dto.senderId, dto.receiverId, dto.text);
  }
}
