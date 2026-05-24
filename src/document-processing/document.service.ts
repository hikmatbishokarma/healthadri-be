import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import AdmZip = require('adm-zip');
import { SarvamAIClient } from 'sarvamai';
import { AiAuditLog, AiAuditLogDocument } from './schemas/ai-audit-log.schema';

export interface RichParsedTask {
  taskType: 'MEDICATION' | 'LAB_TEST' | 'APPOINTMENT' | 'PROCEDURE';
  confidence: number;
  sourceText: string;
  extractedData: Record<string, unknown>;
}

const RICH_SYSTEM_PROMPT = `You are a clinical document parser for a cancer care platform.
Extract structured medical tasks from the document.
Return STRICT JSON only. No explanations.`;

const RICH_USER_PROMPT_TEMPLATE = `Extract all medical tasks from this document. Return JSON exactly:

{
  "tasks": [
    {
      "taskType": "MEDICATION | LAB_TEST | APPOINTMENT | PROCEDURE",
      "confidence": 0.0-1.0,
      "sourceText": "exact quoted text from document",
      "extractedData": {
        // For MEDICATION: medicineName, dosage, frequency, timing (before_food|after_food|with_food|anytime), duration
        // For LAB_TEST: testName, labName, scheduledDate (YYYY-MM-DD or null)
        // For APPOINTMENT: doctorName, specialty, scheduledDate (YYYY-MM-DD or null), location
        // For PROCEDURE: procedureName, scheduledDate (YYYY-MM-DD or null), location
      }
    }
  ]
}

Rules:
- Include ALL medications, tests, appointments, procedures mentioned
- Set confidence based on how clearly the text states the task (0.0 = unclear, 1.0 = explicit)
- sourceText must be a direct quote from the document
- Use null for any field you cannot determine
- Do NOT hallucinate values
- Return ONLY JSON

Document:
---
{{TEXT}}
---`;

@Injectable()
export class DocumentProcessingService {
  private readonly logger = new Logger(DocumentProcessingService.name);
  private readonly client: SarvamAIClient;

  constructor(
    @InjectModel(AiAuditLog.name)
    private auditModel: Model<AiAuditLogDocument>,
    config: ConfigService,
  ) {
    const apiSubscriptionKey = config.get<string>('SARVAM_API_KEY');
    this.client = new SarvamAIClient({ apiSubscriptionKey });
  }

  async extractTextFromBuffer(buffer: Buffer, originalName: string): Promise<string> {
    if (!buffer || buffer.length === 0) {
      throw new BadRequestException('file is required');
    }
    const tempPath = await this.writeTempFile(buffer, originalName);
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const outputPath = path.join(process.cwd(), 'output', `extracted-${unique}.md`);
    try {
      return await this.runOcr(tempPath, outputPath);
    } finally {
      fs.promises.unlink(tempPath).catch(() => {});
      fs.promises.unlink(outputPath).catch(() => {});
    }
  }

  async processDocument(
    patientId: string,
    fileBuffer: Buffer,
    originalName: string,
    sourceDocumentId: string | null = null,
  ): Promise<{ success: boolean; message: string; richTasks: RichParsedTask[] }> {
    if (!patientId || !Types.ObjectId.isValid(patientId)) {
      throw new BadRequestException('valid patientId is required');
    }
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new BadRequestException('file is required');
    }

    const tempPath = await this.writeTempFile(fileBuffer, originalName);
    const outputPath = path.join(process.cwd(), 'output', 'extracted.md');

    try {
      let extractedText = '';
      try {
        extractedText = await this.runOcr(tempPath, outputPath);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'OCR failed';
        this.logger.error(`OCR failed: ${message}`);
        await this.writeAudit({ patientId, filePath: tempPath, error: `OCR: ${message}` });
        throw new InternalServerErrorException(`OCR failed: ${message}`);
      }

      const { richTasks } = await this.extractRichTasks(extractedText);

      await this.writeAudit({
        patientId,
        filePath: tempPath,
        extractedText,
        parsedTasks: richTasks,
        sourceDocumentId,
      });

      return {
        success: true,
        message: richTasks.length > 0 ? 'Document processed successfully' : 'No actionable tasks found',
        richTasks,
      };
    } finally {
      fs.promises.unlink(tempPath).catch(() => {});
    }
  }

  async extractRichTasks(extractedText: string): Promise<{ richTasks: RichParsedTask[] }> {
    try {
      const completion = await this.client.chat.completions({
        model: 'sarvam-105b',
        temperature: 0,
        messages: [
          { role: 'system', content: RICH_SYSTEM_PROMPT },
          {
            role: 'user',
            content: RICH_USER_PROMPT_TEMPLATE.replace('{{TEXT}}', extractedText),
          },
        ],
      });

      const raw = completion.choices?.[0]?.message?.content ?? '';
      const jsonStart = raw.indexOf('{');
      const jsonEnd = raw.lastIndexOf('}');
      if (jsonStart === -1 || jsonEnd === -1) return { richTasks: [] };

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1));
      } catch {
        return { richTasks: [] };
      }

      const rawTasks = (parsed as { tasks?: unknown })?.tasks;
      if (!Array.isArray(rawTasks)) return { richTasks: [] };

      const VALID_TYPES = new Set(['MEDICATION', 'LAB_TEST', 'APPOINTMENT', 'PROCEDURE']);
      const richTasks: RichParsedTask[] = [];

      for (const t of rawTasks) {
        const obj = t as Partial<RichParsedTask> & { extractedData?: unknown };
        if (
          typeof obj.taskType === 'string' &&
          VALID_TYPES.has(obj.taskType) &&
          typeof obj.confidence === 'number' &&
          obj.extractedData &&
          typeof obj.extractedData === 'object'
        ) {
          richTasks.push({
            taskType: obj.taskType as RichParsedTask['taskType'],
            confidence: Math.min(1, Math.max(0, obj.confidence)),
            sourceText: typeof obj.sourceText === 'string' ? obj.sourceText : '',
            extractedData: obj.extractedData as Record<string, unknown>,
          });
        }
      }

      return { richTasks };
    } catch (err) {
      this.logger.warn(`Rich extraction failed: ${err instanceof Error ? err.message : err}`);
      return { richTasks: [] };
    }
  }

  private async writeTempFile(buffer: Buffer, originalName: string): Promise<string> {
    const uploadDir = path.join(process.cwd(), 'uploads');
    await fs.promises.mkdir(uploadDir, { recursive: true });
    const ext = path.extname(originalName) || '';
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    const tempPath = path.join(uploadDir, unique);
    await fs.promises.writeFile(tempPath, buffer);
    return tempPath;
  }

  private async runOcr(filePath: string, outputPath: string): Promise<string> {
    const job = await this.client.documentIntelligence.createJob({ outputFormat: 'md' });
    await job.uploadFile(filePath);
    await job.start();
    await job.waitUntilComplete();

    await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
    await job.downloadOutput(outputPath);

    return this.readOcrOutput(outputPath);
  }

  private async readOcrOutput(outputPath: string): Promise<string> {
    const buffer = await fs.promises.readFile(outputPath);

    // Sarvam Document Intelligence returns a ZIP archive containing
    // `document.md` + metadata. Detect via the PK magic header.
    const isZip = buffer.length >= 2 && buffer[0] === 0x50 && buffer[1] === 0x4b;
    if (!isZip) return buffer.toString('utf-8');

    const zip = new AdmZip(buffer);
    const mdEntry =
      zip.getEntry('document.md') ||
      zip.getEntries().find((e) => e.entryName.endsWith('.md'));

    if (!mdEntry) {
      throw new Error('OCR output archive did not contain a markdown file');
    }
    return mdEntry.getData().toString('utf-8');
  }

  private async writeAudit(entry: {
    patientId: string;
    filePath: string;
    extractedText?: string;
    parsedTasks?: unknown[];
    sourceDocumentId?: string | null;
    error?: string;
  }) {
    try {
      await this.auditModel.create({
        provider: 'sarvam',
        feature: 'document-processing',
        patientId: new Types.ObjectId(entry.patientId),
        filePath: entry.filePath,
        extractedText: entry.extractedText,
        parsedTasks: entry.parsedTasks ?? [],
        error: entry.error,
      });
    } catch (err) {
      this.logger.error(`Failed to write audit log: ${err instanceof Error ? err.message : err}`);
    }
  }
}
