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
import { SarvamAIClient } from 'sarvamai';
import { AiAuditLog, AiAuditLogDocument } from './schemas/ai-audit-log.schema';
import { TasksService } from '../tasks/tasks.service';

interface ParsedTask {
  type: 'visit' | 'test';
  title: string;
  date: string;
}

const SYSTEM_PROMPT = `You are a medical document parser.
Extract ONLY actionable medical tasks from the document.
Return STRICT JSON only.`;

const USER_PROMPT_TEMPLATE = `Extract tasks in this format:

{
  "tasks": [
    {
      "type": "visit | test",
      "title": "string",
      "date": "YYYY-MM-DD"
    }
  ]
}

Rules:
- Only include future tasks
- Ignore past events
- Ignore irrelevant text
- If date is missing or unclear → skip task
- Do NOT hallucinate
- Do NOT explain anything
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
    private tasksService: TasksService,
    config: ConfigService,
  ) {
    const apiSubscriptionKey = config.get<string>('SARVAM_API_KEY');
    this.client = new SarvamAIClient({ apiSubscriptionKey });
  }

  async processDocument(
    patientId: string,
    fileBuffer: Buffer,
    originalName: string,
    sourceDocumentId: string | null = null,
  ) {
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
        await this.writeAudit({
          patientId,
          filePath: tempPath,
          error: `OCR: ${message}`,
        });
        throw new InternalServerErrorException(`OCR failed: ${message}`);
      }

      const { tasks, llmResponse, rawContent, parseError } =
        await this.extractTasks(extractedText);

      await this.writeAudit({
        patientId,
        filePath: tempPath,
        extractedText,
        llmResponse,
        rawLlmContent: rawContent,
        parsedTasks: tasks,
        error: parseError,
      });

      if (tasks.length === 0) {
        return {
          success: true,
          message: parseError
            ? 'Document processed but tasks could not be parsed'
            : 'No actionable tasks found',
          tasks: [],
        };
      }

      const saved = await this.tasksService.createDrafts(
        patientId,
        sourceDocumentId,
        tasks,
      );

      return {
        success: true,
        message: 'Document processed successfully',
        tasks: saved,
      };
    } finally {
      fs.promises.unlink(tempPath).catch(() => {
        /* file may already be gone */
      });
    }
  }

  private async writeTempFile(
    buffer: Buffer,
    originalName: string,
  ): Promise<string> {
    const uploadDir = path.join(process.cwd(), 'uploads');
    await fs.promises.mkdir(uploadDir, { recursive: true });
    const ext = path.extname(originalName) || '';
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    const tempPath = path.join(uploadDir, unique);
    await fs.promises.writeFile(tempPath, buffer);
    return tempPath;
  }

  private async runOcr(filePath: string, outputPath: string): Promise<string> {
    const job = await this.client.documentIntelligence.createJob({
      outputFormat: 'md',
    });
    await job.uploadFile(filePath);
    await job.start();
    await job.waitUntilComplete();

    await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
    await job.downloadOutput(outputPath);

    return fs.promises.readFile(outputPath, 'utf-8');
  }

  private async extractTasks(extractedText: string): Promise<{
    tasks: ParsedTask[];
    llmResponse: Record<string, unknown>;
    rawContent: string;
    parseError?: string;
  }> {
    const completion = await this.client.chat.completions({
      model: 'sarvam-105b',
      temperature: 0,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: USER_PROMPT_TEMPLATE.replace('{{TEXT}}', extractedText),
        },
      ],
    });

    const llmResponse = completion as unknown as Record<string, unknown>;
    const rawContent = completion.choices?.[0]?.message?.content ?? '';

    const parsed = this.safeParseTasks(rawContent);
    if (parsed.error) {
      this.logger.warn(`LLM returned invalid JSON: ${parsed.error}`);
    }

    return {
      tasks: parsed.tasks,
      llmResponse,
      rawContent,
      parseError: parsed.error,
    };
  }

  private safeParseTasks(raw: string): {
    tasks: ParsedTask[];
    error?: string;
  } {
    if (!raw) return { tasks: [], error: 'empty response' };

    const jsonStart = raw.indexOf('{');
    const jsonEnd = raw.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) {
      return { tasks: [], error: 'no JSON object found' };
    }
    const slice = raw.slice(jsonStart, jsonEnd + 1);

    let parsed: unknown;
    try {
      parsed = JSON.parse(slice);
    } catch (err) {
      return {
        tasks: [],
        error: err instanceof Error ? err.message : 'parse failed',
      };
    }

    const tasksRaw = (parsed as { tasks?: unknown })?.tasks;
    if (!Array.isArray(tasksRaw)) {
      return { tasks: [], error: 'tasks is not an array' };
    }

    const tasks: ParsedTask[] = [];
    for (const t of tasksRaw) {
      const obj = t as Partial<ParsedTask>;
      if (
        (obj.type === 'visit' || obj.type === 'test') &&
        typeof obj.title === 'string' &&
        typeof obj.date === 'string'
      ) {
        const d = new Date(obj.date);
        if (!isNaN(d.getTime())) {
          tasks.push({ type: obj.type, title: obj.title, date: obj.date });
        }
      }
    }
    return { tasks };
  }

  private async writeAudit(entry: {
    patientId: string;
    filePath: string;
    extractedText?: string;
    llmResponse?: Record<string, unknown>;
    rawLlmContent?: string;
    parsedTasks?: unknown[];
    error?: string;
  }) {
    try {
      await this.auditModel.create({
        provider: 'sarvam',
        patientId: new Types.ObjectId(entry.patientId),
        filePath: entry.filePath,
        extractedText: entry.extractedText,
        llmResponse: entry.llmResponse,
        rawLlmContent: entry.rawLlmContent,
        parsedTasks: entry.parsedTasks ?? [],
        error: entry.error,
      });
    } catch (err) {
      this.logger.error(
        `Failed to write audit log: ${err instanceof Error ? err.message : err}`,
      );
    }
  }
}
