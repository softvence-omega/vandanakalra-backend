import { Module } from '@nestjs/common';
import { CloudinaryService } from 'src/common/services/cloudinary.service';
import { CloudinaryConfig } from 'src/config/cloudinary.config';

@Module({
  providers: [CloudinaryConfig, CloudinaryService],
  exports: [CloudinaryService], // 👈 crucial!
})
export class CloudinaryModule {}
