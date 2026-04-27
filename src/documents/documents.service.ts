import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { GridFSBucket, ObjectId } from 'mongodb';
import { Readable } from 'stream';
import { DocumentMeta, DocumentMetaDocument } from './document.schema';
import { DocumentProcessingService } from '../document-processing/document.service';
import { AlertsService } from '../alerts/alerts.service';
import { UsersService } from '../users/users.service';

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const AI_CATEGORIES = new Set(['prescription', 'discharge']);

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);
  private bucket: GridFSBucket;

  constructor(
    @InjectModel(DocumentMeta.name)
    private metaModel: Model<DocumentMetaDocument>,
    @InjectConnection() private connection: Connection,
    private processingService: DocumentProcessingService,
    private alertsService: AlertsService,
    private usersService: UsersService,
  ) {}

  private getBucket(): GridFSBucket {
    if (!this.bucket) {
      this.bucket = new GridFSBucket(this.connection.db, {
        bucketName: 'medical_records',
      });
    }
    return this.bucket;
  }

  async upload(
    patientId: string,
    uploadedByUserId: string,
    category: string,
    file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `Unsupported file type: ${file.mimetype}. Allowed: PDF, JPG, PNG.`,
      );
    }
    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException(
        `File too large: ${file.size}. Max ${MAX_FILE_SIZE} bytes.`,
      );
    }

    const bucket = this.getBucket();
    const stream = Readable.from(file.buffer);

    const gridfsId: ObjectId = await new Promise((resolve, reject) => {
      const upload = bucket.openUploadStream(file.originalname, {
        contentType: file.mimetype,
      });
      stream
        .pipe(upload)
        .on('error', reject)
        .on('finish', () => resolve(upload.id as ObjectId));
    });

    const finalCategory = category || 'other';
    const isAi = AI_CATEGORIES.has(finalCategory);
    const meta = await this.metaModel.create({
      patientId: new Types.ObjectId(patientId),
      uploadedByUserId: new Types.ObjectId(uploadedByUserId),
      category: finalCategory,
      fileName: file.originalname,
      mimeType: file.mimetype,
      fileSize: file.size,
      gridfsId,
      processingStatus: isAi ? 'pending' : 'not_applicable',
    });

    if (isAi) {
      this.runAiInBackground(
        String(meta._id),
        patientId,
        file.buffer,
        file.originalname,
      );
    }

    return meta;
  }

  private runAiInBackground(
    metaId: string,
    patientId: string,
    fileBuffer: Buffer,
    originalName: string,
  ): void {
    this.processingService
      .processDocument(patientId, fileBuffer, originalName, metaId)
      .then(async (result) => {
        const taskCount = result.tasks?.length ?? 0;
        await this.metaModel.findByIdAndUpdate(metaId, {
          processingStatus: 'complete',
          draftTaskCount: taskCount,
        });

        if (taskCount > 0) {
          const patient = await this.usersService.findById(patientId);
          await this.alertsService.create({
            patientId: new Types.ObjectId(patientId),
            navigatorId: patient?.assignedNavigatorId || null,
            type: 'DOCUMENT_REVIEW',
            severity: 'LOW',
            reason: `${taskCount} draft task${taskCount === 1 ? '' : 's'} from ${originalName}`,
            status: 'pending',
          });
        }
      })
      .catch(async (err) => {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(`AI processing failed for ${metaId}: ${message}`);
        await this.metaModel
          .findByIdAndUpdate(metaId, {
            processingStatus: 'failed',
            processingError: message,
          })
          .catch(() => {
            /* swallow — already in error path */
          });
      });
  }

  async listByPatient(patientId: string) {
    return this.metaModel
      .find({ patientId: new Types.ObjectId(patientId) })
      .sort({ createdAt: -1 });
  }

  async getMeta(id: string) {
    const meta = await this.metaModel.findById(id);
    if (!meta) throw new NotFoundException(`Document ${id} not found`);
    return meta;
  }

  async streamFile(id: string): Promise<{
    stream: NodeJS.ReadableStream;
    meta: DocumentMetaDocument;
  }> {
    const meta = await this.getMeta(id);
    const bucket = this.getBucket();
    const stream = bucket.openDownloadStream(meta.gridfsId);
    return { stream, meta };
  }

  async remove(id: string) {
    const meta = await this.getMeta(id);
    const bucket = this.getBucket();
    try {
      await bucket.delete(meta.gridfsId);
    } catch {
      // file may already be missing — proceed with metadata removal
    }
    await this.metaModel.findByIdAndDelete(id);
    return { ok: true };
  }
}
