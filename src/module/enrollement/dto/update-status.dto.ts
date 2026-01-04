import { IsNotEmpty, IsString, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateEnrollementStatusDto {
  @ApiProperty({ example: 'JOIN', description: 'Status to set (JOIN|ATTENDED)' })
  @IsNotEmpty({ message: 'Status is required' })
  @IsString()
  @IsIn(['JOIN', 'ATTENDED'])
  status: string;

  
}
