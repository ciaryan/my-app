import type { Metadata } from 'next';
import triviaData from '@/data/trivia/today.json';
import { TriviaFileSchema } from '@/lib/quiz/schema';
import DailyQuiz from '../_components/DailyQuiz';

export const metadata: Metadata = {
  title: 'Daily Trivia — Ciarán Ryan',
  description: 'Five pub quiz questions on what happened on this day.',
};

// Parsed at build time; an invalid file fails the build rather than shipping.
const quiz = TriviaFileSchema.parse(triviaData);

export default function TriviaPage() {
  return (
    <DailyQuiz
      quiz={quiz}
      title="Daily Trivia"
      subtitle="Five pub quiz rounds on what happened on this day"
      storageKey="trivia-history"
      epoch="2026-10-09"
      path="/play/trivia"
      sourceName="Wikipedia's On this day pages"
    />
  );
}
