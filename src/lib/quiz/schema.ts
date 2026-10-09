import { z } from 'zod';

export const QUESTION_COUNT = 5;
export const OPTION_COUNT = 4;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');
const httpsUrl = z.url({ protocol: /^https$/ });
const wikipediaUrl = httpsUrl.refine(
  (u) => new URL(u).hostname === 'en.wikipedia.org',
  'Expected an en.wikipedia.org URL',
);

export const QuizQuestionSchema = z
  .object({
    id: z.string().min(1),
    category: z.string().min(1),
    question: z.string().min(10).max(300),
    options: z.array(z.string().min(1).max(120)).length(OPTION_COUNT),
    answerIndex: z
      .number()
      .int()
      .min(0)
      .max(OPTION_COUNT - 1),
    explanation: z.string().min(10).max(400),
    /** The Wikipedia current-events entry the question was written from. */
    context: z.string().min(10),
    /** Daily Wikipedia current-events page (attribution). */
    sourceUrl: wikipediaUrl,
    /** Wikipedia article for the wider story, if the entry linked one. */
    topicUrl: wikipediaUrl.optional(),
    /** A news report cited by the Wikipedia entry — link only. */
    readMore: z.object({ publisher: z.string().min(1), url: httpsUrl }),
  })
  .refine(
    (q) =>
      new Set(q.options.map((o) => o.trim().toLowerCase())).size ===
      OPTION_COUNT,
    { message: 'Options must be distinct', path: ['options'] },
  );

export const QuizFileSchema = z.object({
  version: z.literal(1),
  /** Date the quiz is for (Europe/London). */
  date: isoDate,
  /** Date of the news it covers (Wikipedia page date, UTC). */
  newsDate: isoDate,
  generatedAt: z.iso.datetime(),
  model: z.string().min(1),
  source: z.object({
    name: z.string().min(1),
    url: wikipediaUrl,
    revisionIds: z.array(z.number().int().positive()).min(1),
    license: z.literal('CC BY-SA 4.0'),
    licenseUrl: httpsUrl,
  }),
  questions: z
    .array(QuizQuestionSchema)
    .length(QUESTION_COUNT)
    .refine((qs) => new Set(qs.map((q) => q.id)).size === qs.length, {
      message: 'Question ids must be unique',
    }),
});

export type QuizQuestion = z.infer<typeof QuizQuestionSchema>;
export type QuizFile = z.infer<typeof QuizFileSchema>;
