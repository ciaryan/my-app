'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { getDailyPuzzle } from '@/lib/connections/daily';
import type { DailyPuzzle } from '@/lib/connections/daily';
import type { PuzzleGroup } from '@/data/connections/puzzles';

// ── Types ──────────────────────────────────────────────────────────

interface GameResult {
  puzzleNumber: number;
  date: string;
  solved: boolean;
  mistakes: number;
  solveOrder: number[];
}

interface ConnectionsHistory {
  results: GameResult[];
  stats: {
    played: number;
    won: number;
    currentStreak: number;
    maxStreak: number;
  };
}

type GameStatus = 'playing' | 'won' | 'lost';

// ── Constants ──────────────────────────────────────────────────────

const MAX_MISTAKES = 4;
const STORAGE_KEY = 'connections-history';

const DIFFICULTY_COLORS: Record<number, string> = {
  1: 'bg-difficulty-1 text-difficulty-1-fg',
  2: 'bg-difficulty-2 text-difficulty-2-fg',
  3: 'bg-difficulty-3 text-difficulty-3-fg',
  4: 'bg-difficulty-4 text-difficulty-4-fg',
};

const DIFFICULTY_EMOJI: Record<number, string> = {
  1: '🟨',
  2: '🟩',
  3: '🟦',
  4: '🟪',
};

// ── Helpers ────────────────────────────────────────────────────────

function loadHistory(): ConnectionsHistory {
  if (typeof window === 'undefined') {
    return {
      results: [],
      stats: { played: 0, won: 0, currentStreak: 0, maxStreak: 0 },
    };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // corrupt data
  }
  return {
    results: [],
    stats: { played: 0, won: 0, currentStreak: 0, maxStreak: 0 },
  };
}

function saveHistory(history: ConnectionsHistory) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch {
    // full storage
  }
}

function getExistingResult(
  history: ConnectionsHistory,
  puzzleNumber: number,
): GameResult | undefined {
  return history.results.find((r) => r.puzzleNumber === puzzleNumber);
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Component ──────────────────────────────────────────────────────

function initGameState() {
  const daily = getDailyPuzzle();
  const hist = loadHistory();
  const existing = getExistingResult(hist, daily.number);

  if (existing) {
    return {
      puzzle: daily,
      board: [] as string[],
      solved: [...daily.groups],
      mistakes: existing.mistakes,
      status: (existing.solved ? 'won' : 'lost') as GameStatus,
      guessHistory: existing.solveOrder,
      showCompleted: true,
      history: hist,
    };
  }

  return {
    puzzle: daily,
    board: daily.shuffledWords,
    solved: [] as PuzzleGroup[],
    mistakes: 0,
    status: 'playing' as GameStatus,
    guessHistory: [] as number[],
    showCompleted: false,
    history: hist,
  };
}

export default function ConnectionsPage() {
  // Only computed client-side (via effect below) since it reads localStorage;
  // starting as null keeps the first client render identical to the SSR output.
  const [puzzle, setPuzzle] = useState<DailyPuzzle | null>(null);
  const [board, setBoard] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [solved, setSolved] = useState<PuzzleGroup[]>([]);
  const [mistakes, setMistakes] = useState(0);
  const [status, setStatus] = useState<GameStatus>('playing');
  const [shakeWords, setShakeWords] = useState<Set<string>>(() => new Set());
  const [feedback, setFeedback] = useState<string | null>(null);
  const [guessHistory, setGuessHistory] = useState<number[]>([]);
  const [history, setHistory] = useState<ConnectionsHistory>(() => ({
    results: [],
    stats: { played: 0, won: 0, currentStreak: 0, maxStreak: 0 },
  }));
  const [showStats, setShowStats] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);

  useEffect(() => {
    const init = initGameState();
    setPuzzle(init.puzzle);
    setBoard(init.board);
    setSolved(init.solved);
    setMistakes(init.mistakes);
    setStatus(init.status);
    setGuessHistory(init.guessHistory);
    setHistory(init.history);
    setShowCompleted(init.showCompleted);
  }, []);

  const unsolvedGroups = useMemo(() => {
    if (!puzzle) return [];
    const solvedIds = new Set(solved.map((g) => g.id));
    return puzzle.groups.filter((g) => !solvedIds.has(g.id));
  }, [puzzle, solved]);

  const toggleSelect = useCallback(
    (word: string) => {
      if (status !== 'playing') return;
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(word)) {
          next.delete(word);
        } else if (next.size < 4) {
          next.add(word);
        }
        return next;
      });
      setFeedback(null);
    },
    [status],
  );

  const handleShuffle = useCallback(() => {
    setBoard((prev) => shuffleArray(prev));
  }, []);

  const handleDeselectAll = useCallback(() => {
    setSelected(new Set());
    setFeedback(null);
  }, []);

  const handleSubmit = useCallback(() => {
    if (selected.size !== 4 || status !== 'playing' || !puzzle) return;

    const selectedWords = Array.from(selected);
    const matchedGroup = unsolvedGroups.find((g) =>
      g.words.every((w) => selected.has(w)),
    );

    if (matchedGroup) {
      const newSolved = [...solved, matchedGroup];
      setSolved(newSolved);
      setBoard((prev) => prev.filter((w) => !selected.has(w)));
      setSelected(new Set());
      setFeedback(null);
      setGuessHistory((prev) => [...prev, matchedGroup.difficulty]);

      if (newSolved.length === 4) {
        setStatus('won');
        const h = loadHistory();
        const result: GameResult = {
          puzzleNumber: puzzle.number,
          date: puzzle.date,
          solved: true,
          mistakes,
          solveOrder: [...guessHistory, matchedGroup.difficulty],
        };
        h.results.push(result);
        h.stats.played++;
        h.stats.won++;
        h.stats.currentStreak++;
        h.stats.maxStreak = Math.max(h.stats.maxStreak, h.stats.currentStreak);
        saveHistory(h);
        setHistory(h);
      }
    } else {
      const oneAway = unsolvedGroups.some((g) => {
        const overlap = g.words.filter((w) => selected.has(w)).length;
        return overlap === 3;
      });

      const newMistakes = mistakes + 1;
      setMistakes(newMistakes);
      setFeedback(oneAway ? 'One away...' : 'Not quite!');
      setShakeWords(new Set(selectedWords));
      setTimeout(() => setShakeWords(new Set()), 500);

      if (newMistakes >= MAX_MISTAKES) {
        setStatus('lost');
        const remaining = unsolvedGroups;
        setSolved([...solved, ...remaining]);
        setBoard([]);
        setGuessHistory((prev) => [
          ...prev,
          ...remaining.map((g) => g.difficulty),
        ]);

        const h = loadHistory();
        const result: GameResult = {
          puzzleNumber: puzzle.number,
          date: puzzle.date,
          solved: false,
          mistakes: newMistakes,
          solveOrder: [...guessHistory, ...remaining.map((g) => g.difficulty)],
        };
        h.results.push(result);
        h.stats.played++;
        h.stats.currentStreak = 0;
        saveHistory(h);
        setHistory(h);
      }

      setSelected(new Set());
    }
  }, [
    selected,
    status,
    puzzle,
    unsolvedGroups,
    solved,
    mistakes,
    guessHistory,
  ]);

  const shareText = useMemo(() => {
    if (!puzzle || status === 'playing') return '';
    const lines = [`Connections #${puzzle.number}`];
    const solveOrder = showCompleted
      ? (getExistingResult(history, puzzle.number)?.solveOrder ?? guessHistory)
      : guessHistory;
    for (const diff of solveOrder) {
      lines.push((DIFFICULTY_EMOJI[diff] ?? '').repeat(4));
    }
    if (status === 'lost') {
      lines.push(`${mistakes}/${MAX_MISTAKES} mistakes`);
    }
    return lines.join('\n');
  }, [puzzle, status, guessHistory, mistakes, history, showCompleted]);

  const handleShare = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard not available
    }
  }, [shareText]);

  if (!puzzle) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 py-12 md:py-24">
        <p className="text-muted">Loading...</p>
      </div>
    );
  }

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
          <button
            onClick={() => setShowStats(true)}
            className="text-sm text-muted transition-colors hover:text-foreground"
          >
            Stats
          </button>
        </div>

        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Connections
          </h1>
          <p className="font-mono text-xs text-muted">
            #{puzzle.number} &middot; {puzzle.date}
          </p>
          <p className="text-sm text-muted">Find four groups of four</p>
        </div>

        {/* Solved groups */}
        {solved.length > 0 && (
          <div className="space-y-2">
            {solved.map((group) => (
              <div
                key={group.id}
                className={`rounded-lg px-4 py-3 text-center ${DIFFICULTY_COLORS[group.difficulty]}`}
              >
                <p className="text-sm font-bold uppercase tracking-wide">
                  {group.category}
                </p>
                <p className="text-sm">{group.words.join(', ')}</p>
              </div>
            ))}
          </div>
        )}

        {/* Board */}
        {board.length > 0 && (
          <div className="grid grid-cols-4 gap-2">
            {board.map((word) => {
              const isSelected = selected.has(word);
              const isShaking = shakeWords.has(word);
              return (
                <button
                  key={word}
                  onClick={() => toggleSelect(word)}
                  className={`flex items-center justify-center rounded-lg border px-2 py-4 text-center text-sm font-medium transition-all ${
                    isSelected
                      ? 'border-foreground bg-foreground text-background'
                      : 'border-border bg-background text-foreground hover:border-foreground/30'
                  } ${isShaking ? 'animate-shake' : ''}`}
                >
                  <span className="leading-tight">{word}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Feedback */}
        {feedback && (
          <p className="text-center text-sm font-medium text-foreground">
            {feedback}
          </p>
        )}

        {/* Mistake dots */}
        {status === 'playing' && (
          <div className="flex items-center justify-center gap-1.5">
            <span className="text-xs text-muted mr-2">Mistakes remaining:</span>
            {Array.from({ length: MAX_MISTAKES }).map((_, i) => (
              <span
                key={i}
                className={`inline-block h-3 w-3 rounded-full ${
                  i < MAX_MISTAKES - mistakes ? 'bg-foreground' : 'bg-border'
                }`}
              />
            ))}
          </div>
        )}

        {/* Action buttons */}
        {status === 'playing' && (
          <div className="flex justify-center gap-3">
            <button
              onClick={handleShuffle}
              className="rounded-full border border-border px-5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-foreground/5"
            >
              Shuffle
            </button>
            <button
              onClick={handleDeselectAll}
              disabled={selected.size === 0}
              className="rounded-full border border-border px-5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-foreground/5 disabled:opacity-40"
            >
              Deselect All
            </button>
            <button
              onClick={handleSubmit}
              disabled={selected.size !== 4}
              className="rounded-full border border-foreground bg-foreground px-5 py-2 text-sm font-medium text-background transition-colors hover:bg-foreground/90 disabled:opacity-40"
            >
              Submit
            </button>
          </div>
        )}

        {/* Win / Lose banner */}
        {status !== 'playing' && (
          <div className="space-y-4 text-center">
            <p className="text-lg font-bold text-foreground">
              {status === 'won' ? 'Well done!' : 'Better luck tomorrow!'}
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={handleShare}
                className="rounded-full border border-foreground bg-foreground px-5 py-2 text-sm font-medium text-background transition-colors hover:bg-foreground/90"
              >
                {copied ? 'Copied!' : 'Share'}
              </button>
              <button
                onClick={() => setShowStats(true)}
                className="rounded-full border border-border px-5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-foreground/5"
              >
                Stats
              </button>
            </div>
          </div>
        )}

        {/* Stats Modal */}
        {showStats && (
          <StatsModal history={history} onClose={() => setShowStats(false)} />
        )}
      </main>
    </div>
  );
}

// ── Stats Modal ────────────────────────────────────────────────────

function StatsModal({
  history,
  onClose,
}: {
  history: ConnectionsHistory;
  onClose: () => void;
}) {
  const { stats, results } = history;
  const winPct =
    stats.played > 0 ? Math.round((stats.won / stats.played) * 100) : 0;

  const last30 = useMemo(() => {
    const days: { date: string; result?: GameResult }[] = [];
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const result = results.find((r) => r.date === dateStr);
      days.push({ date: dateStr, result });
    }
    return days;
  }, [results]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-xl border border-border bg-background p-6 shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-foreground">Statistics</h2>
          <button
            onClick={onClose}
            className="text-muted transition-colors hover:text-foreground"
          >
            &times;
          </button>
        </div>

        <div className="grid grid-cols-4 gap-4 text-center mb-6">
          <div>
            <p className="text-2xl font-bold text-foreground">{stats.played}</p>
            <p className="text-xs text-muted">Played</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{winPct}</p>
            <p className="text-xs text-muted">Win %</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">
              {stats.currentStreak}
            </p>
            <p className="text-xs text-muted">Current</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">
              {stats.maxStreak}
            </p>
            <p className="text-xs text-muted">Max</p>
          </div>
        </div>

        <div className="mb-2">
          <p className="text-xs font-medium uppercase tracking-widest text-muted mb-2">
            Last 30 days
          </p>
          <div className="grid grid-cols-10 gap-1">
            {last30.map(({ date, result }) => (
              <div
                key={date}
                title={`${date}${result ? (result.solved ? ` — Won (${result.mistakes} mistakes)` : ' — Lost') : ''}`}
                className={`h-5 w-full rounded-sm ${
                  result
                    ? result.solved
                      ? result.mistakes === 0
                        ? 'bg-success'
                        : result.mistakes <= 2
                          ? 'bg-difficulty-1'
                          : 'bg-difficulty-2'
                      : 'bg-error'
                    : 'bg-border/50'
                }`}
              />
            ))}
          </div>
        </div>

        <button
          onClick={onClose}
          className="mt-4 w-full rounded-full border border-border py-2 text-sm font-medium text-foreground transition-colors hover:bg-foreground/5"
        >
          Close
        </button>
      </div>
    </div>
  );
}
