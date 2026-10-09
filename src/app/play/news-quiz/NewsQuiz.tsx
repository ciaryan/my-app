'use client';

import { useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { formatLongDate, londonDate } from '@/lib/quiz/dates';
import type { QuizFile, QuizQuestion } from '@/lib/quiz/schema';

// ── Types ──────────────────────────────────────────────────────────

interface QuizHistory {
  /** Chosen option index per question, keyed by quiz date. */
  answers: Record<string, number[]>;
}

// ── Constants ──────────────────────────────────────────────────────

const STORAGE_KEY = 'news-quiz-history';
const EPOCH = '2026-10-09';

// ── Helpers ────────────────────────────────────────────────────────

const STORAGE_EVENT = 'news-quiz-history-change';

function readStorage(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange);
  window.addEventListener(STORAGE_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(STORAGE_EVENT, onChange);
  };
}

function parseHistory(raw: string): QuizHistory {
  try {
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed.answers === 'object') return parsed;
  } catch {
    // corrupt storage
  }
  return { answers: {} };
}

function saveAnswers(date: string, answers: number[]) {
  try {
    const history = parseHistory(readStorage());
    history.answers[date] = answers;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    window.dispatchEvent(new Event(STORAGE_EVENT));
  } catch {
    // storage unavailable
  }
}

function quizNumber(date: string): number {
  const days =
    (new Date(`${date}T00:00:00Z`).getTime() -
      new Date(`${EPOCH}T00:00:00Z`).getTime()) /
    86_400_000;
  return Math.round(days) + 1;
}

// ── Components ─────────────────────────────────────────────────────

function SourceLinks({ question }: { question: QuizQuestion }) {
  return (
    <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      <a
        href={question.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2 hover:text-foreground"
      >
        Source: Wikipedia
      </a>
      <a
        href={question.readMore.url}
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2 hover:text-foreground"
      >
        Read more: {question.readMore.publisher} &#8599;
      </a>
    </p>
  );
}

function optionClass(
  index: number,
  question: QuizQuestion,
  chosen: number | undefined,
): string {
  const base =
    'w-full rounded-lg border px-4 py-3 text-left text-sm font-medium transition-colors';
  if (chosen === undefined) {
    return `${base} border-border bg-background text-foreground hover:border-foreground/30`;
  }
  if (index === question.answerIndex) {
    return `${base} border-success bg-success/15 text-foreground`;
  }
  if (index === chosen) {
    return `${base} border-error bg-error/15 text-foreground`;
  }
  return `${base} border-border bg-background text-muted`;
}

export default function NewsQuiz({ quiz }: { quiz: QuizFile }) {
  // null during SSR and hydration; localStorage contents ('' if empty) after.
  const stored = useSyncExternalStore(subscribe, readStorage, () => null);
  const today = useSyncExternalStore(subscribe, londonDate, () => quiz.date);
  // True between answering a question and moving on to the next one.
  const [revealing, setRevealing] = useState(false);
  const [copied, setCopied] = useState(false);

  const total = quiz.questions.length;
  const ready = stored !== null;
  const answers = (
    ready ? (parseHistory(stored).answers[quiz.date] ?? []) : []
  ).slice(0, total);
  const current = revealing ? answers.length - 1 : answers.length;
  const finished = current >= total;
  const isStale = quiz.date !== today;
  const score = answers.filter(
    (a, i) => a === quiz.questions[i].answerIndex,
  ).length;
  const number = quizNumber(quiz.date);

  function choose(index: number) {
    if (revealing) return;
    saveAnswers(quiz.date, [...answers, index]);
    setRevealing(true);
  }

  const shareText = [
    `Ciaryan's News Quiz #${number}`,
    answers
      .map((a, i) => (a === quiz.questions[i].answerIndex ? '🟩' : '🟥'))
      .join('') + ` ${score}/${total}`,
    'ciaryan.com/play/news-quiz',
  ].join('\n');

  async function handleShare() {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard not available
    }
  }

  const question = quiz.questions[current];
  const chosen = answers[current];

  return (
    <div className="flex flex-1 items-start justify-center px-6 py-12 md:py-24">
      <main className="w-full max-w-xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="text-sm text-muted transition-colors hover:text-foreground"
          >
            &larr; Home
          </Link>
        </div>

        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            News Quiz
          </h1>
          <p className="font-mono text-xs text-muted">
            #{number} &middot; {quiz.date}
          </p>
          <p className="text-sm text-muted">
            Five questions on the news from {formatLongDate(quiz.newsDate)}
          </p>
          {isStale && (
            <p className="text-xs text-muted">
              Today&apos;s quiz isn&apos;t ready yet &mdash; this is the quiz
              from {formatLongDate(quiz.date)}.
            </p>
          )}
        </div>

        {/* Progress */}
        <div className="flex items-center justify-center gap-1.5">
          {quiz.questions.map((q, i) => (
            <span
              key={q.id}
              className={`inline-block h-3 w-3 rounded-full ${
                answers[i] === undefined
                  ? i === current
                    ? 'bg-foreground'
                    : 'bg-border'
                  : answers[i] === q.answerIndex
                    ? 'bg-success'
                    : 'bg-error'
              }`}
            />
          ))}
        </div>

        {!ready ? (
          <p className="text-center text-muted">Loading...</p>
        ) : finished ? (
          /* Results */
          <div className="space-y-6">
            <div className="space-y-4 text-center">
              <p className="text-lg font-bold text-foreground">
                {score}/{total}
                {score === total ? ' — perfect!' : ''}
              </p>
              <button
                onClick={handleShare}
                className="rounded-full border border-foreground bg-foreground px-5 py-2 text-sm font-medium text-background transition-colors hover:bg-foreground/90"
              >
                {copied ? 'Copied!' : 'Share result'}
              </button>
            </div>

            <ol className="space-y-4">
              {quiz.questions.map((q, i) => (
                <li
                  key={q.id}
                  className="space-y-2 rounded-lg border border-border p-4"
                >
                  <p className="text-sm font-medium text-foreground">
                    {answers[i] === q.answerIndex ? '✓' : '✗'} {q.question}
                  </p>
                  <p className="text-sm text-muted">
                    {answers[i] !== q.answerIndex && (
                      <>You said {q.options[answers[i]]}. </>
                    )}
                    Answer: {q.options[q.answerIndex]}
                  </p>
                  <SourceLinks question={q} />
                </li>
              ))}
            </ol>
          </div>
        ) : (
          /* Current question */
          <div className="space-y-4">
            <p className="text-xs font-bold uppercase tracking-wide text-muted">
              {current + 1} of {total} &middot; {question.category}
            </p>
            <h2 className="text-lg font-medium text-foreground">
              {question.question}
            </h2>
            <div className="space-y-2">
              {question.options.map((option, i) => (
                <button
                  key={option}
                  onClick={() => choose(i)}
                  disabled={chosen !== undefined}
                  className={optionClass(i, question, chosen)}
                >
                  {option}
                </button>
              ))}
            </div>

            {chosen !== undefined && (
              <div className="space-y-3">
                <p className="text-sm text-foreground">
                  <span className="font-bold">
                    {chosen === question.answerIndex
                      ? 'Correct. '
                      : 'Not quite. '}
                  </span>
                  {question.explanation}
                </p>
                <SourceLinks question={question} />
                <div className="flex justify-center pt-2">
                  <button
                    onClick={() => setRevealing(false)}
                    className="rounded-full border border-foreground bg-foreground px-5 py-2 text-sm font-medium text-background transition-colors hover:bg-foreground/90"
                  >
                    {current + 1 === total ? 'See results' : 'Next question'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Attribution */}
        <p className="border-t border-border pt-4 text-center text-xs text-muted">
          Questions are written by AI from{' '}
          <a
            href={quiz.source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            Wikipedia&apos;s Current events portal
          </a>{' '}
          and checked automatically, so mistakes are possible &mdash; follow the
          source links. Text adapted under{' '}
          <a
            href={quiz.source.licenseUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            {quiz.source.license}
          </a>
          .
        </p>
      </main>
    </div>
  );
}
