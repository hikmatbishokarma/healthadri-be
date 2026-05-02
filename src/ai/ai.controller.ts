import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AiService } from './ai.service';

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
]);

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('explain')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async explain(
    @Body('message') message: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const trimmedMessage = typeof message === 'string' ? message.trim() : '';

    if (!trimmedMessage && !file) {
      throw new BadRequestException(
        'Either a message or a file is required.',
      );
    }

    if (file && !trimmedMessage) {
      throw new BadRequestException(
        'A message describing your question is required when uploading a file.',
      );
    }

    if (file && !ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException(
        'Unsupported file type. Only PDF, JPG, and PNG are allowed.',
      );
    }

    return this.aiService.explain(trimmedMessage, file);
  }
}
