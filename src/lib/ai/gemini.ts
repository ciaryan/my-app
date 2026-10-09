// Shared Gemini client for build-time scripts (news quiz generator, planned
// Connections agent). Never import this from src/app — the API key must not
// reach the browser bundle. ESLint enforces this.

import { ApiError, GoogleGenAI } from '@google/genai';
import { z } from 'zod';

const DEFAULT_TIMEOUT_MS = 120_000;
const MAX_ATTEMPTS = 3;
/** Longest server-requested wait we'll honour before giving up. */
const MAX_RETRY_DELAY_MS = 60_000;

let client: GoogleGenAI | undefined;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
}

export function getGeminiModel(): string {
  return requireEnv('GEMINI_MODEL');
}

function getClient(): GoogleGenAI {
  client ??= new GoogleGenAI({
    apiKey: requireEnv('GEMINI_API_KEY'),
    httpOptions: {
      timeout: DEFAULT_TIMEOUT_MS,
      // Retries are handled in withRetry so daily-quota errors fail fast.
      retryOptions: { attempts: 1 },
    },
  });
  return client;
}

function toResponseSchema(schema: z.ZodType): unknown {
  // Gemini accepts a subset of JSON Schema and rejects the $schema keyword.
  const jsonSchema: Record<string, unknown> = z.toJSONSchema(schema, {
    target: 'draft-7',
  });
  delete jsonSchema.$schema;
  return jsonSchema;
}

/** Server-suggested retry delay from a 429 body, e.g. "retryDelay":"33571s". */
function retryDelayMs(err: ApiError): number | undefined {
  const match = err.message.match(/"retryDelay":\s*"(\d+(?:\.\d+)?)s"/);
  return match ? Number(match[1]) * 1000 : undefined;
}

/**
 * Retries transient failures (5xx, timeouts, short rate-limit waits). Daily
 * quota exhaustion asks for a wait of hours, so that is rethrown immediately
 * rather than burning more quota or hanging the job.
 */
async function withRetry<T>(call: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await call();
    } catch (err) {
      if (attempt >= MAX_ATTEMPTS || !(err instanceof ApiError)) throw err;
      let delay = 2 ** attempt * 5_000;
      if (err.status === 429) {
        const requested = retryDelayMs(err);
        if (requested === undefined || requested > MAX_RETRY_DELAY_MS) {
          throw err;
        }
        delay = requested + 1_000;
      } else if (err.status < 500) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

export interface GenerateJsonOptions<T extends z.ZodType> {
  system: string;
  prompt: string;
  schema: T;
  temperature?: number;
  model?: string;
}

/**
 * Calls Gemini with structured JSON output and validates the response against
 * the given Zod schema. Throws if the model returns invalid JSON or the
 * response doesn't match the schema.
 */
export async function generateJson<T extends z.ZodType>({
  system,
  prompt,
  schema,
  temperature = 0.4,
  model = getGeminiModel(),
}: GenerateJsonOptions<T>): Promise<z.infer<T>> {
  const response = await withRetry(() =>
    getClient().models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction: system,
        temperature,
        responseMimeType: 'application/json',
        responseJsonSchema: toResponseSchema(schema),
      },
    }),
  );

  const text = response.text;
  if (!text) {
    const reason = response.candidates?.[0]?.finishReason ?? 'unknown';
    throw new Error(`Gemini returned no text (finish reason: ${reason})`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`Gemini returned invalid JSON: ${text.slice(0, 200)}`);
  }
  return schema.parse(parsed);
}
