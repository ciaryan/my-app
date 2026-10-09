// Shared Gemini client for build-time scripts (news quiz generator, planned
// Connections agent). Never import this from src/app — the API key must not
// reach the browser bundle. ESLint enforces this.

import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';

const DEFAULT_TIMEOUT_MS = 90_000;

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
      // Free-tier rate limits are tight; back off and retry on 429/5xx.
      retryOptions: { attempts: 5, initialDelay: 5, maxDelay: 60 },
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
  const response = await getClient().models.generateContent({
    model,
    contents: prompt,
    config: {
      systemInstruction: system,
      temperature,
      responseMimeType: 'application/json',
      responseJsonSchema: toResponseSchema(schema),
    },
  });

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
