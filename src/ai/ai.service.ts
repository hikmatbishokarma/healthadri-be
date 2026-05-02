import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SarvamAIClient } from 'sarvamai';
import {
  AiAuditLog,
  AiAuditLogDocument,
} from '../document-processing/schemas/ai-audit-log.schema';
import { DocumentProcessingService } from '../document-processing/document.service';

export type ExplainType = 'safe' | 'abusive' | 'non-medical';

export interface ExplainResponse {
  type: ExplainType;
  response: string;
}

const SYSTEM_PROMPT = `You are a medical explainer system.

You must classify the input AND respond safely.

Step 1: Classify the input into one of:
- safe (medical explanation)
- abusive (bad language / harmful tone)
- non-medical (irrelevant to health)

Step 2:
- If "safe": Explain in simple language. Never diagnose. Never suggest treatment, medicines, or dosage. Keep the answer short and simple.
- If "abusive": Respond exactly: "Please use respectful language."
- If "non-medical": Respond exactly: "I'm designed to provide only medical-related information."

STRICT RULES:
- Never diagnose
- Never suggest treatment
- Never suggest medicines or dosage
- Never answer non-medical queries
- Keep answers short and simple
- If unsure, treat as non-medical
- If the user asks "what medicine should I take" or asks for a prescription, classify as "safe" but respond exactly: "I'm not the right person to give medical advice. Please consult your doctor."

OUTPUT FORMAT (STRICT JSON ONLY):
{
  "type": "safe" | "abusive" | "non-medical",
  "response": "string"
}

Return ONLY the JSON object. No extra text. No explanation outside JSON.`;

const FALLBACK: ExplainResponse = {
  type: 'non-medical',
  response:
    "Sorry, I couldn't understand. Please ask a medical-related question.",
};

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly client: SarvamAIClient;

  constructor(
    config: ConfigService,
    private readonly documentProcessing: DocumentProcessingService,
    @InjectModel(AiAuditLog.name)
    private readonly auditModel: Model<AiAuditLogDocument>,
  ) {
    const apiSubscriptionKey = config.get<string>('SARVAM_API_KEY');
    this.client = new SarvamAIClient({ apiSubscriptionKey });
  }

  async explain(
    message: string,
    file?: Express.Multer.File,
  ): Promise<ExplainResponse> {
    let extractedText = '';
    if (file) {
      try {
        extractedText = await this.documentProcessing.extractTextFromBuffer(
          file.buffer,
          file.originalname,
        );
      } catch (err) {
        const reason = err instanceof Error ? err.message : 'unknown error';
        this.logger.error(`OCR failed for explain: ${reason}`);
        await this.writeAudit({
          userMessage: message,
          fileName: file.originalname,
          error: `OCR: ${reason}`,
        });
        throw new InternalServerErrorException(
          'Could not read uploaded file. Please try again or paste the text into the message.',
        );
      }
    }

    const userInput = extractedText
      ? `${extractedText}\n\nUser Question: ${message}`
      : message;

    let rawContent = '';
    let llmResponse: Record<string, unknown> | undefined;
    try {
      const completion = await this.client.chat.completions({
        model: 'sarvam-m',
        temperature: 0.2,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userInput },
        ],
      });
      llmResponse = completion as unknown as Record<string, unknown>;
      rawContent = completion.choices?.[0]?.message?.content ?? '';
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'unknown error';
      this.logger.error(`Sarvam call failed: ${reason}`);
      await this.writeAudit({
        userMessage: message,
        fileName: file?.originalname,
        extractedText,
        error: `LLM: ${reason}`,
        result: FALLBACK,
      });
      return FALLBACK;
    }

    const parsed = this.safeParse(rawContent);
    await this.writeAudit({
      userMessage: message,
      fileName: file?.originalname,
      extractedText,
      llmResponse,
      rawLlmContent: rawContent,
      result: parsed.result,
      error: parsed.error,
    });

    return parsed.result;
  }

  private safeParse(raw: string): {
    result: ExplainResponse;
    error?: string;
  } {
    if (!raw) return { result: FALLBACK, error: 'empty response' };

    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) {
      return { result: FALLBACK, error: 'no JSON object found' };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw.slice(start, end + 1));
    } catch (err) {
      return {
        result: FALLBACK,
        error: err instanceof Error ? err.message : 'parse failed',
      };
    }

    const obj = parsed as Partial<ExplainResponse>;
    const validTypes: ExplainType[] = ['safe', 'abusive', 'non-medical'];

    if (
      !obj ||
      typeof obj.response !== 'string' ||
      !obj.response.trim() ||
      !validTypes.includes(obj.type as ExplainType)
    ) {
      return { result: FALLBACK, error: 'invalid shape' };
    }

    return {
      result: { type: obj.type as ExplainType, response: obj.response },
    };
  }

  private async writeAudit(entry: {
    userMessage: string;
    fileName?: string;
    extractedText?: string;
    llmResponse?: Record<string, unknown>;
    rawLlmContent?: string;
    result?: ExplainResponse;
    error?: string;
  }) {
    try {
      await this.auditModel.create({
        provider: 'sarvam',
        feature: 'ai-explain',
        filePath: entry.fileName,
        userMessage: entry.userMessage,
        extractedText: entry.extractedText,
        llmResponse: entry.llmResponse,
        rawLlmContent: entry.rawLlmContent,
        classification: entry.result?.type,
        responseText: entry.result?.response,
        error: entry.error,
      });
    } catch (err) {
      this.logger.error(
        `Failed to write audit log: ${err instanceof Error ? err.message : err}`,
      );
    }
  }
}
