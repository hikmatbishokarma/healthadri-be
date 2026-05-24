import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

@Injectable()
export class PushNotificationsService implements OnModuleInit {
  private readonly logger = new Logger(PushNotificationsService.name);
  private firebaseApp: admin.app.App | null = null;

  constructor(private config: ConfigService) {}

  onModuleInit() {
    const value = this.config.get<string>('FIREBASE_SERVICE_ACCOUNT');
    if (!value) {
      this.logger.log('FIREBASE_SERVICE_ACCOUNT not set — FCM disabled, Expo push only');
      return;
    }
    try {
      let serviceAccount: admin.ServiceAccount;
      if (value.trim().startsWith('{')) {
        serviceAccount = JSON.parse(value) as admin.ServiceAccount;
      } else {
        const resolved = path.isAbsolute(value) ? value : path.resolve(process.cwd(), value);
        serviceAccount = JSON.parse(fs.readFileSync(resolved, 'utf8')) as admin.ServiceAccount;
      }
      this.firebaseApp = admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
      this.logger.log('Firebase Admin initialised');
    } catch (err) {
      this.logger.error('Failed to initialise Firebase Admin', err);
    }
  }

  async sendToTokens(tokens: string[], payload: PushPayload): Promise<void> {
    if (tokens.length === 0) return;

    const expoTokens = tokens.filter((t) => t.startsWith('ExponentPushToken['));
    const fcmTokens = tokens.filter((t) => !t.startsWith('ExponentPushToken['));

    await Promise.all([
      expoTokens.length > 0 ? this.sendViaExpo(expoTokens, payload) : Promise.resolve(),
      fcmTokens.length > 0 ? this.sendViaFcm(fcmTokens, payload) : Promise.resolve(),
    ]);
  }

  async sendToToken(token: string, payload: PushPayload): Promise<void> {
    await this.sendToTokens([token], payload);
  }

  // ── Expo Push API (for Expo Go / development) ────────────────────────────────

  private async sendViaExpo(tokens: string[], payload: PushPayload): Promise<void> {
    const messages = tokens.map((to) => ({
      to,
      title: payload.title,
      body: payload.body,
      data: payload.data ?? {},
      sound: 'default',
    }));

    try {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(messages),
      });

      if (!response.ok) {
        this.logger.warn(`Expo Push API error: ${response.status} ${await response.text()}`);
      }
    } catch (err) {
      this.logger.warn(`Expo push send failed: ${err}`);
    }
  }

  // ── Firebase FCM (for production standalone builds) ──────────────────────────

  private async sendViaFcm(tokens: string[], payload: PushPayload): Promise<void> {
    if (!this.firebaseApp) {
      this.logger.warn('FCM not initialised — skipping native token push');
      return;
    }
    const chunks: string[][] = [];
    for (let i = 0; i < tokens.length; i += 500) {
      chunks.push(tokens.slice(i, i + 500));
    }
    for (const chunk of chunks) {
      try {
        await admin.messaging(this.firebaseApp).sendEachForMulticast({
          tokens: chunk,
          notification: { title: payload.title, body: payload.body },
          data: payload.data ?? {},
          android: { priority: 'high' },
          apns: { payload: { aps: { sound: 'default' } } },
        });
      } catch (err) {
        this.logger.warn(`FCM multicast error: ${err}`);
      }
    }
  }
}
