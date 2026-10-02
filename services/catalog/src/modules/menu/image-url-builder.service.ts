import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.schema.js';
import { buildImageUrl } from '../../domain/image-url.js';

@Injectable()
export class ImageUrlBuilder {
  private readonly baseUrl: string;
  private readonly bucket: string;

  constructor(config: ConfigService<Env, true>) {
    this.baseUrl = config.get('STORAGE_PUBLIC_BASE_URL', { infer: true });
    this.bucket = config.get('FIREBASE_STORAGE_BUCKET', { infer: true });
  }

  build(imagePath: string | null): string | undefined {
    return buildImageUrl(imagePath, { baseUrl: this.baseUrl, bucket: this.bucket });
  }
}
