import type { Metadata } from 'next';
import triviaData from '@/data/trivia/today.json';
import { TriviaFileSchema } from '@/lib/quiz/schema';
import DailyQuiz from '../_components/DailyQuiz';

export const metadata: Metadata = {
  title: 'Daily Trivia — Ciarán Ryan',
  description: 'Five daily pub quiz questions from five different rounds.',
};

// Parsed at build time; an invalid file fails the build rather than shipping.
const quiz = TriviaFileSchema.parse(triviaData);

export default function TriviaPage() {
  return (
    <DailyQuiz
      quiz={quiz}
      title="Daily Trivia"
      subtitle="Five pub quiz rounds, from what people are reading and what happened on this day"
      storageKey="trivia-history"
      epoch="2026-10-09"
      path="/play/trivia"
      sourceName="Wikipedia's most-read articles and On this day pages"
    />
  );
}
