import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { DocumentsService } from './documents.service';

@Controller('documents')
export class DocumentsController {
  constructor(private documentsService: DocumentsService) {}

  @Get()
  async list(@Query('patientId') patientId: string) {
    return this.documentsService.listByPatient(patientId);
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body('patientId') patientId: string,
    @Body('uploadedByUserId') uploadedByUserId: string,
    @Body('category') category: string,
  ) {
    return this.documentsService.upload(
      patientId,
      uploadedByUserId || patientId,
      category,
      file,
    );
  }

  @Get(':id/file')
  async getFile(@Param('id') id: string, @Res() res: Response) {
    const { stream, meta } = await this.documentsService.streamFile(id);
    res.setHeader('Content-Type', meta.mimeType);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(meta.fileName)}"`,
    );
    stream.on('error', () => {
      if (!res.headersSent) {
        res.status(404).json({ message: 'File not found in storage' });
      }
    });
    stream.pipe(res);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.documentsService.remove(id);
  }
}
