import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, isString, MinLength } from 'class-validator';

export class AccountActiveDto {

  @ApiProperty({
    description: 'Whether the account is active',
    type: String,
    required: true,
  })
  @IsString()
  userId: string;
}

export class ChangePasswordDto {
  @ApiProperty({
    example: 'oldPassword123',
    description: 'Your current password',
  })
  @IsString({ message: 'Old password must be a string.' })
  oldPassword: string;

  @ApiProperty({
    example: 'newSecurePass456',
    description: 'Your new password (minimum 4 characters)',
  })
  @IsString({ message: 'New password must be a string.' })
  @MinLength(4, { message: 'New password must be at least 4 characters long.' })
  newPassword: string;

}




export class UpdateUserProfileDto {
  @ApiProperty({
    description: 'The first name of the user',
    example: 'John',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  firstname?: string;

  @ApiProperty({
    description: 'The last name of the user',
    example: 'Doe',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  lastname?: string;

}