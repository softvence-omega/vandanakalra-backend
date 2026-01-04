import { IsNotEmpty, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ForgotPasswordDto {
  @ApiProperty({
    description: 'The unique username of the user',
    example: 'mohin_user',
  })
  @IsNotEmpty()
  @IsString()
  username: string;

  @ApiProperty({
    description: 'FCM device registration token for push notification',
    example:
      'dQw4w9WgXcQ-abcdefghijklmnopqrstuvwxyz0123456789ABCDEF',
    minLength: 10,
    maxLength: 255,
  })
  @IsNotEmpty()
  @IsString()
  @Length(10, 255, { message: 'FCM token must be valid' })
  fcmToken: string;
}

export class ResetPasswordDto {
  @ApiProperty({
    description: '4-digit reset token sent via FCM notification',
    example: '7392',
    minLength: 4,
    maxLength: 4,
  })
  @IsNotEmpty()
  @IsString()
  @Length(4, 4, { message: 'Reset token must be exactly 4 characters' })
  token: string;

  @ApiProperty({
    description: 'New password — must be exactly 4 characters long',
    example: '9876', // or 'aB3!', if non-numeric allowed
    minLength: 4,
    maxLength: 4,
  })
  @IsNotEmpty()
  @IsString()
  @Length(4, 4, { message: 'Password must be exactly 4 characters long' })
  newPassword: string;
}