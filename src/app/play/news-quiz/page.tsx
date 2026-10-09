import type { Metadata } from 'next';
import quizData from '@/data/quiz/today.json';
import { formatLongDate } from '@/lib/quiz/dates';
import { QuizFileSchema } from '@/lib/quiz/schema';
import DailyQuiz from '../_components/DailyQuiz';

export const metadata: Metadata = {
  title: 'News Quiz — Ciarán Ryan',
  description: "Five multiple-choice questions on yesterday's news.",
};

// Parsed at build time; an invalid file fails the build rather than shipping.
const quiz = QuizFileSchema.parse(quizData);

export default function NewsQuizPage() {
  return (
    <DailyQuiz
      quiz={quiz}
      title="News Quiz"
      subtitle={`Five questions on the news from ${formatLongDate(quiz.newsDate)}`}
      storageKey="news-quiz-history"
      epoch="2026-10-09"
      path="/play/news-quiz"
      sourceName="Wikipedia's Current events portal"
    />
  );
}
