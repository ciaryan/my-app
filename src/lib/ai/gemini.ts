// Shared Gemini client for build-time scripts (news quiz generator, planned
// Connections agent). Never import this from src/app — the API key must not
// reach the browser bundle. ESLint enforces this.

import { ApiError, GoogleGenAI, ThinkingLevel } from '@google/genai';
import { z } from 'zod';

// The SDK also sends this to Google as X-Server-Timeout, so it is the
// server's deadline too: too short and slow responses come back as 504.
const DEFAULT_TIMEOUT_MS = 300_000;
// Every attempt counts against the free-tier daily quota, even failed ones,
// and the workflows' later scheduled runs already act as retries. So each
// model gets at most this many requests per call, one per pass over the
// chain. Overload (503) spikes pass within minutes, so the passes are spaced
// out rather than retrying the same model straight away.
const MAX_PASSES = 2;
const PASS_DELAY_MS = 90_000;
/** Longest server-requested wait we'll honour before giving up. */
const MAX_RETRY_DELAY_MS = 60_000;

let client: GoogleGenAI | undefined;
/** Models that reported daily-quota exhaustion; skipped for this process. */
const exhausted = new Set<string>();
/**
 * Models that were overloaded or timed out earlier in this process. Later
 * calls try them last, so the verify call doesn't spend a request on a model
 * that just failed the generate call.
 */
const struggling = new Set<string>();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
}

/**
 * Primary model, then any GEMINI_FALLBACK_MODEL models (comma-separated, in
 * order). Each model has its own quota and load, so a chain survives more.
 */
export function getGeminiModels(): string[] {
  const models = [
    requireEnv('GEMINI_MODEL'),
    ...(process.env.GEMINI_FALLBACK_MODEL ?? '').split(','),
  ]
    .map((m) => m.trim())
    .filter(Boolean);
  return [...new Set(models)];
}

function getClient(): GoogleGenAI {
  client ??= new GoogleGenAI({
    apiKey: requireEnv('GEMINI_API_KEY'),
    httpOptions: {
      timeout: DEFAULT_TIMEOUT_MS,
      // Retries are handled in generateJson so daily-quota errors fail fast.
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

/** Errors worth trying again or on another model: 429, 5xx, network/timeout. */
function isUnavailable(err: unknown): boolean {
  return !(err instanceof ApiError) || err.status === 429 || err.status >= 500;
}

/**
 * Honours one short server-requested rate-limit wait (429 with a retryDelay
 * of up to a minute). Daily quota exhaustion asks for a wait of hours, so
 * that and every other error is rethrown for generateJson to handle.
 */
async function withRateLimitRetry<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 429) throw err;
    const requested = retryDelayMs(err);
    if (requested === undefined || requested > MAX_RETRY_DELAY_MS) throw err;
    await new Promise((resolve) => setTimeout(resolve, requested + 1_000));
    return call();
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface GenerateJsonOptions<T extends z.ZodType> {
  system: string;
  prompt: string;
  schema: T;
  temperature?: number;
  /** Models to try in order. Defaults to getGeminiModels(). */
  models?: string[];
}

export interface GenerateJsonResult<T> {
  data: T;
  /** The model that produced the response. */
  model: string;
}

/**
 * Calls Gemini with structured JSON output and validates the response against
 * the given Zod schema. If a model is unavailable (quota exhausted, overloaded,
 * timing out), the next model is tried; if all are, the chain is tried once
 * more after a pause (skipping models out of quota). Throws if that fails too,
 * or if the response is invalid JSON or doesn't match the schema.
 */
export async function generateJson<T extends z.ZodType>({
  system,
  prompt,
  schema,
  temperature = 0.4,
  models = getGeminiModels(),
}: GenerateJsonOptions<T>): Promise<GenerateJsonResult<z.infer<T>>> {
  let lastError: unknown;
  for (let pass = 1; pass <= MAX_PASSES; pass++) {
    // Healthy models first; ones that struggled earlier keep their order.
    const available = models.filter((m) => !exhausted.has(m));
    const ordered = [
      ...available.filter((m) => !struggling.has(m)),
      ...available.filter((m) => struggling.has(m)),
    ];
    if (ordered.length === 0) {
      if (lastError) throw lastError;
      throw new Error(`Daily quota exhausted for ${models.join(', ')}`);
    }
    if (pass > 1) {
      console.warn(
        `[gemini] all models unavailable; waiting ${PASS_DELAY_MS / 1000}s before pass ${pass}`,
      );
      await sleep(PASS_DELAY_MS);
    }
    for (const model of ordered) {
      try {
        const data = await generateWithModel(
          model,
          system,
          prompt,
          schema,
          temperature,
        );
        struggling.delete(model);
        return { data, model };
      } catch (err) {
        if (!isUnavailable(err)) throw err;
        if (err instanceof ApiError && err.status === 429) {
          exhausted.add(model);
        } else {
          struggling.add(model);
        }
        lastError = err;
        console.warn(
          `[gemini] ${model} unavailable (pass ${pass}): ${err instanceof Error ? err.message.slice(0, 200) : err}`,
        );
      }
    }
  }
  throw lastError;
}

async function generateWithModel<T extends z.ZodType>(
  model: string,
  system: string,
  prompt: string,
  schema: T,
  temperature: number,
): Promise<z.infer<T>> {
  const request = (thinking: boolean) =>
    withRateLimitRetry(() =>
      getClient().models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction: system,
          temperature,
          responseMimeType: 'application/json',
          responseJsonSchema: toResponseSchema(schema),
          // Low thinking keeps responses well inside the deadline; these
          // tasks don't need deep reasoning.
          ...(thinking
            ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
            : {}),
        },
      }),
    );
  let response;
  try {
    response = await request(true);
  } catch (err) {
    // Models without thinking-level support reject the option; retry plain.
    if (!(
      err instanceof ApiError &&
      err.status === 400 &&
      /thinking/i.test(err.message)
    )) {
      throw err;
    }
    console.warn(`[gemini] ${model} rejected thinkingLevel; retrying without`);
    response = await request(false);
  }

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
