import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DocumentProcessingService } from './document.service';

@Controller('document-processing')
export class DocumentProcessingController {
  constructor(private service: DocumentProcessingService) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 25 * 1024 * 1024 },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body('patientId') patientId: string,
  ) {
    if (!file) throw new BadRequestException('file is required');
    return this.service.processDocument(
      patientId,
      file.buffer,
      file.originalname,
    );
  }
}
