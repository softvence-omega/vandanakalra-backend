import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './module/auth/auth.module';
import { PrismaModule } from './module/prisma/prisma.module';
import { MailModule } from './module/mail/mail.module';
import { MailerModule } from '@nestjs-modules/mailer';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SeederService } from './seeder/seeder.service';
import { EventModule } from './module/event/event.module';
import { EnrollementModule } from './module/enrollement/enrollement.module';
import { NotificationModule } from './module/notification/notification.module';

@Module({
  imports: [ MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        transport: {
          host: config.get<string>('SMTP_HOST'),
          port: Number(config.get<string>('SMTP_PORT') || 587),
          secure: Number(config.get<string>('SMTP_PORT') || 587) === 465,
          auth: {
            user: config.get<string>('SMTP_USER'),
            pass: config.get<string>('SMTP_PASS'),
          },
        },
        defaults: {
          from: config.get<string>('SMTP_FROM') || config.get<string>('SMTP_USER'),
        },
      }),
    }),AuthModule, PrismaModule, MailModule, EventModule, EnrollementModule, NotificationModule,],
  controllers: [AppController, ],
  providers: [AppService , SeederService, ],
})
export class AppModule {}
