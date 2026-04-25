import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Message, MessageDocument } from './message.schema';

@Injectable()
export class MessagesService {
  constructor(
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
  ) {}

  async getConversation(userId1: string, userId2: string) {
    return this.messageModel
      .find({
        $or: [
          { senderId: new Types.ObjectId(userId1), receiverId: new Types.ObjectId(userId2) },
          { senderId: new Types.ObjectId(userId2), receiverId: new Types.ObjectId(userId1) },
        ],
      })
      .sort({ createdAt: 1 });
  }

  async send(senderId: string, receiverId: string, text: string) {
    return this.messageModel.create({
      senderId: new Types.ObjectId(senderId),
      receiverId: new Types.ObjectId(receiverId),
      text,
    });
  }
}
