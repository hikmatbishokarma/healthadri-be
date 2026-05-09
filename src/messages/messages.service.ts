import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Conversation, ConversationDocument } from './conversation.schema';
import { Message, MessageDocument } from './message.schema';
import { SendMessageDto } from './dto/send-message.dto';
import { User, UserDocument } from '../users/user.schema';

const ESCALATION_KEYWORDS = [
  'pain', 'emergency', 'hospital', 'bleeding', 'breathing',
  'unconscious', 'chest', 'serious', 'urgent', 'help',
];

const BOT_OFFLINE =
  "Your navigator is currently unavailable. I've logged your message and they'll respond soon. For urgent medical emergencies, please call 108 immediately.";

const BOT_ESCALATED =
  "This sounds urgent. I've immediately alerted your navigator. Please call 108 right now if this is a medical emergency. Your navigator has been notified and will respond as soon as possible.";

const NAVIGATOR_ONLINE_WINDOW_MS = 5 * 60 * 1000;

// Derive visibleTo array from senderType and scope
function computeVisibleTo(senderType: string, scope?: string): string[] {
  if (senderType === 'patient')   return ['patient', 'navigator'];
  if (senderType === 'caregiver') return ['caregiver', 'navigator'];
  if (senderType === 'bot')       return ['patient', 'caregiver', 'navigator'];
  // navigator
  if (scope === 'patient')        return ['patient', 'navigator'];
  if (scope === 'caregiver')      return ['caregiver', 'navigator'];
  return ['patient', 'caregiver', 'navigator']; // 'both' is default
}

// Human-readable scope label for system confirmation pills
function scopeLabel(scope?: string): string {
  if (scope === 'patient')   return 'Patient only';
  if (scope === 'caregiver') return 'Caregiver only';
  return 'Patient and Caregiver';
}

@Injectable()
export class MessagesService {
  constructor(
    @InjectModel(Conversation.name) private convModel: Model<ConversationDocument>,
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  private async getOrCreateConversation(patientId: string): Promise<ConversationDocument> {
    let conv = await this.convModel.findOne({ patientId: new Types.ObjectId(patientId) });
    if (!conv) {
      const patient = await this.userModel.findById(patientId).select('assignedNavigatorId');
      if (!patient) throw new NotFoundException('Patient not found');
      conv = await this.convModel.create({
        patientId: new Types.ObjectId(patientId),
        navigatorId: patient.assignedNavigatorId ?? null,
        status: 'pending',
      });
    }
    return conv;
  }

  private async isNavigatorOnline(navigatorId: Types.ObjectId | null): Promise<boolean> {
    if (!navigatorId) return false;
    const nav = await this.userModel.findById(navigatorId).select('lastActiveAt');
    if (!nav?.lastActiveAt) return false;
    return Date.now() - new Date(nav.lastActiveAt).getTime() < NAVIGATOR_ONLINE_WINDOW_MS;
  }

  async getThread(patientId: string, since?: string, callerRole = 'patient') {
    const conv = await this.getOrCreateConversation(patientId);

    const query: any = { conversationId: conv._id };
    if (since) query.createdAt = { $gt: new Date(since) };

    const allMessages = await this.messageModel.find(query).sort({ createdAt: 1 });

    // Navigators see everything; patients/caregivers see only their visibleTo slice
    // Hidden messages become blocker placeholders so the timeline is never silently gapped
    let messages: any[];
    if (callerRole === 'navigator') {
      messages = allMessages;
    } else {
      messages = [];
      for (const msg of allMessages) {
        const vt: string[] = msg.visibleTo ?? [];
        // Old messages with empty visibleTo are treated as visible to all
        if (vt.length === 0 || vt.includes(callerRole)) {
          messages.push(msg);
        } else {
          // Rule 14: never silently hide — show a placeholder instead
          const hiddenFrom = msg.senderType;
          const placeholderBody =
            hiddenFrom === 'caregiver' ? 'Caregiver sent a message · visible to navigator only'
            : hiddenFrom === 'patient' ? 'Patient sent a message · visible to navigator only'
            : null;
          if (placeholderBody) {
            messages.push({
              _id: `ph_${msg._id}`,
              conversationId: conv._id,
              senderType: 'placeholder',
              senderId: null,
              body: placeholderBody,
              visibleTo: [callerRole],
              isPlaceholder: true,
              createdAt: msg.createdAt,
            });
          }
        }
      }
    }

    const navigatorOnline = await this.isNavigatorOnline(conv.navigatorId);

    const patient = await this.userModel
      .findById(conv.patientId)
      .select('name cancerType cancerStage hospitalName chemoSessionsCompleted chemoSessionsTotal patientCode caregiverRelationship');

    return { conversation: conv, messages, navigatorOnline, patient };
  }

  async send(dto: SendMessageDto) {
    const conv = await this.getOrCreateConversation(dto.patientId);

    const visibleTo = computeVisibleTo(dto.senderType, dto.scope);

    const msg = await this.messageModel.create({
      conversationId: conv._id,
      senderType: dto.senderType,
      senderId: new Types.ObjectId(dto.senderId),
      body: dto.body,
      visibleTo,
      readByNavigator: dto.senderType === 'navigator',
    });

    let unreadIncrement = dto.senderType !== 'navigator' ? 1 : 0;
    let newStatus = conv.status;
    let botMsg: MessageDocument | null = null;
    let scopeMsg: any | null = null;

    if (dto.senderType === 'navigator') {
      newStatus = 'active';
      // Rule 13: system confirmation pill after navigator sends
      scopeMsg = {
        _id: `scope_${msg._id}`,
        senderType: 'system',
        body: `Sent to ${scopeLabel(dto.scope)}`,
        createdAt: msg.createdAt,
        isSystem: true,
      };
    } else {
      const online = await this.isNavigatorOnline(conv.navigatorId);
      if (online) {
        newStatus = 'active';
      } else {
        const isUrgent = ESCALATION_KEYWORDS.some((kw) =>
          dto.body.toLowerCase().includes(kw),
        );
        newStatus = isUrgent ? 'escalated' : 'bot_held';
        const botBody = isUrgent ? BOT_ESCALATED : BOT_OFFLINE;
        botMsg = await this.messageModel.create({
          conversationId: conv._id,
          senderType: 'bot',
          senderId: null,
          body: botBody,
          visibleTo: ['patient', 'caregiver', 'navigator'],
          readByNavigator: false,
        });
        unreadIncrement += 1;
      }
    }

    await this.convModel.findByIdAndUpdate(conv._id, {
      $set: { lastMessageAt: new Date(), status: newStatus },
      $inc: { unreadCount: unreadIncrement },
    });

    return { message: msg, botMessage: botMsg, scopeMessage: scopeMsg };
  }

  async markRead(conversationId: string) {
    await this.messageModel.updateMany(
      { conversationId: new Types.ObjectId(conversationId), readByNavigator: false },
      { $set: { readByNavigator: true } },
    );
    await this.convModel.findByIdAndUpdate(conversationId, { $set: { unreadCount: 0 } });
    return { ok: true };
  }

  async getInbox(navigatorId: string) {
    const conversations = await this.convModel
      .find({ navigatorId: new Types.ObjectId(navigatorId) })
      .sort({ lastMessageAt: -1 });

    const result = await Promise.all(
      conversations.map(async (conv) => {
        const lastMessage = await this.messageModel
          .findOne({ conversationId: conv._id })
          .sort({ createdAt: -1 });

        const patient = await this.userModel
          .findById(conv.patientId)
          .select('name cancerType cancerStage patientCode');

        return { conversation: conv, patient, lastMessage, unreadCount: conv.unreadCount };
      }),
    );

    return result;
  }

  async heartbeat(navigatorId: string) {
    await this.userModel.findByIdAndUpdate(navigatorId, { $set: { lastActiveAt: new Date() } });
    return { ok: true };
  }
}
