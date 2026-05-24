import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ cors: { origin: '*' }, namespace: '/navigator' })
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    const navigatorId = client.handshake.query.navigatorId as string;
    if (navigatorId) {
      client.join(`navigator:${navigatorId}`);
    }
  }

  handleDisconnect(_client: Socket) {}

  @SubscribeMessage('join')
  handleJoin(
    @MessageBody() data: { navigatorId: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.join(`navigator:${data.navigatorId}`);
  }

  emitNewAlert(navigatorId: string, payload: unknown) {
    this.server.to(`navigator:${navigatorId}`).emit('new_alert', payload);
  }

  emitNewMessage(navigatorId: string, payload: unknown) {
    this.server.to(`navigator:${navigatorId}`).emit('new_message', payload);
  }

  emitReviewBatchReady(navigatorId: string, payload: unknown) {
    this.server.to(`navigator:${navigatorId}`).emit('review_batch_ready', payload);
  }

  emitReminderSent(patientId: string, payload: unknown) {
    this.server.to(`patient:${patientId}`).emit('reminder_sent', payload);
  }

  emitEscalation(navigatorId: string, payload: unknown) {
    this.server.to(`navigator:${navigatorId}`).emit('escalation_triggered', payload);
  }

  emitCarePlanPublished(navigatorId: string, payload: unknown) {
    this.server.to(`navigator:${navigatorId}`).emit('care_plan_published', payload);
  }
}
