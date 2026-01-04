import { HttpStatus, Injectable, OnModuleInit, HttpException } from '@nestjs/common';
import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class NotificationService implements OnModuleInit {
  onModuleInit() {
    if (!admin.apps.length) {
      const serviceAccountPath = path.join(
        __dirname,
        '..',
        '..',
        '..',
        'firebase-service-account.json',
      );

      const serviceAccount = JSON.parse(
        fs.readFileSync(serviceAccountPath, 'utf8'),
      );

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    }
  }

  async sendPushNotification(
    fcmToken: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<string> {
    if (!fcmToken ) {
      throw new HttpException(
        'Invalid FCM token: Token is missing or too short',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const message = {
        notification: { title, body },
        data,
        token: fcmToken,
      };

      const response = await admin.messaging().send(message);
      console.log('✅ FCM notification sent:', response);
      return response;
    } catch (error) {
      console.error('❌ FCM send error:', error);

      // Handle Firebase-specific errors
      if (error?.code) {
        switch (error.code) {
          case 'messaging/invalid-registration-token':
          case 'messaging/registration-token-not-registered':
            throw new HttpException(
              'Device token is invalid or no longer registered. Please refresh the app.',
              HttpStatus.BAD_REQUEST,
            );

          case 'messaging/message-rate-exceeded':
            throw new HttpException(
              'Too many messages sent. Please try again later.',
              HttpStatus.TOO_MANY_REQUESTS,
            );

          case 'messaging/invalid-argument':
            throw new HttpException(
              'Invalid notification payload or token format.',
              HttpStatus.BAD_REQUEST,
            );

          case 'messaging/server-unavailable':
          case 'messaging/third-party-auth-error':
            throw new HttpException(
              'Notification service temporarily unavailable.',
              HttpStatus.SERVICE_UNAVAILABLE,
            );

          default:
            throw new HttpException(
              `Failed to send notification: ${error.message || 'Unknown error'}`,
              HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
      }

      // Fallback for non-Firebase errors
      throw new HttpException(
        'Failed to send push notification due to an internal error.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}