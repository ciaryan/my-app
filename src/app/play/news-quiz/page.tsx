import type { Metadata } from 'next';
import quizData from '@/data/quiz/today.json';
import { QuizFileSchema } from '@/lib/quiz/schema';
import NewsQuiz from './NewsQuiz';

export const metadata: Metadata = {
  title: 'News Quiz — Ciarán Ryan',
  description: "Five multiple-choice questions on yesterday's news.",
};

// Parsed at build time; an invalid file fails the build rather than shipping.
const quiz = QuizFileSchema.parse(quizData);

export default function NewsQuizPage() {
  return <NewsQuiz quiz={quiz} />;
}
