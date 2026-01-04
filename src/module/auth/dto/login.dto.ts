import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    example: 'username123',
    description: 'User username',
  })
  @IsNotEmpty({ message: 'Username is required!' })
  username: string;

  @ApiProperty({
    example: '1234',
    description: 'User password (min 4 characters)',
  })
  @IsNotEmpty({ message: 'Password is required!' })
  @IsString({ message: 'Password must be a string' })
  @MinLength(4, { message: 'Password must be at least 4 characters' })
  password: string;
}
