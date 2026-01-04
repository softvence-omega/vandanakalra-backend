import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './strategy/jwt.strategy';
import { NotificationModule } from '../notification/notification.module';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';

@Module({
  imports: [JwtModule.register({}) , NotificationModule , CloudinaryModule ],
  providers: [AuthService , JwtStrategy],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
