import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, S3ClientConfig } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class S3Service {
  private s3Client: S3Client;

  constructor(private configService: ConfigService) {
    const awsRegion = this.configService.get<string>('AWS_REGION');
    const awsAccessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
    const awsSecretAccessKey = this.configService.get<string>(
      'AWS_SECRET_ACCESS_KEY',
    );
    const awsBucket = this.configService.get<string>('AWS_S3_BUCKET');

    // Validate required env vars
    if (!awsRegion || !awsAccessKeyId || !awsSecretAccessKey || !awsBucket) {
      throw new InternalServerErrorException(
        'Missing required AWS environment variables: AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, or AWS_S3_BUCKET',
      );
    }

    const s3Config: S3ClientConfig = {
      region: awsRegion,
      credentials: {
        accessKeyId: awsAccessKeyId,
        secretAccessKey: awsSecretAccessKey,
      },
    };

    this.s3Client = new S3Client(s3Config);
  }

  async uploadFile(file: Express.Multer.File, folder: string): Promise<string> {
    if (!file) {
      throw new InternalServerErrorException('No file provided for upload');
    }

    const fileExtension = file.originalname.split('.').pop();
    if (!fileExtension) {
      throw new InternalServerErrorException(
        'Unable to determine file extension',
      );
    }

    const key = `${folder}/${uuidv4()}.${fileExtension}`;

    try {
      const parallelUpload = new Upload({
        client: this.s3Client,
        params: {
          Bucket: this.configService.get<string>('AWS_S3_BUCKET')!, // safe due to validation above
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
        },
      });

      await parallelUpload.done();

      // Construct public URL
      const url = `https://${this.configService.get<string>(
        'AWS_S3_BUCKET',
      )}.s3.${this.configService.get<string>('AWS_REGION')}.amazonaws.com/${key}`;

      return url;
    } catch (error) {
      console.error('S3 Upload Error:', error);
      throw new InternalServerErrorException(
        'Failed to upload image to S3. Please try again.',
      );
    }
  }
}
