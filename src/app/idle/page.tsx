'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface Upgrade {
  id: string;
  name: string;
  emoji: string;
  description: string;
  baseCost: number;
  tokensPerSecond: number;
  owned: number;
}

const INITIAL_UPGRADES: Upgrade[] = [
  {
    id: 'intern',
    name: 'AI Intern',
    emoji: '🧑‍💻',
    description: 'A keen junior annotating data',
    baseCost: 10,
    tokensPerSecond: 1,
    owned: 0,
  },
  {
    id: 'gpu',
    name: 'GPU',
    emoji: '🖥️',
    description: 'A single NVIDIA card whirring away',
    baseCost: 100,
    tokensPerSecond: 5,
    owned: 0,
  },
  {
    id: 'cluster',
    name: 'GPU Cluster',
    emoji: '🔧',
    description: '8x A100s linked together',
    baseCost: 500,
    tokensPerSecond: 20,
    owned: 0,
  },
  {
    id: 'datacenter',
    name: 'Data Centre',
    emoji: '🏢',
    description: 'A warehouse humming with compute',
    baseCost: 2000,
    tokensPerSecond: 100,
    owned: 0,
  },
  {
    id: 'supercomputer',
    name: 'Supercomputer',
    emoji: '🌐',
    description: 'Nation-scale AI infrastructure',
    baseCost: 10000,
    tokensPerSecond: 500,
    owned: 0,
  },
];

function getCost(upgrade: Upgrade): number {
  return Math.floor(upgrade.baseCost * Math.pow(1.15, upgrade.owned));
}

function formatNumber(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'B';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return Math.floor(n).toString();
}

function getModelTitle(totalTokens: number): string {
  if (totalTokens >= 10_000_000) return 'AGI';
  if (totalTokens >= 1_000_000) return 'GPT-5';
  if (totalTokens >= 100_000) return 'Claude';
  if (totalTokens >= 10_000) return 'LLaMA';
  if (totalTokens >= 1_000) return 'BERT';
  if (totalTokens >= 100) return 'Word2Vec';
  return 'Perceptron';
}

export default function IdlePage() {
  const [tokens, setTokens] = useState(0);
  const [totalTokens, setTotalTokens] = useState(0);
  const [upgrades, setUpgrades] = useState(INITIAL_UPGRADES);
  const [clickPower] = useState(1);
  const [clickFlash, setClickFlash] = useState(false);

  const tokensPerSecond = upgrades.reduce(
    (sum, u) => sum + u.tokensPerSecond * u.owned,
    0,
  );

  const handleClick = useCallback(() => {
    setTokens((t) => t + clickPower);
    setTotalTokens((t) => t + clickPower);
    setClickFlash(true);
    setTimeout(() => setClickFlash(false), 100);
  }, [clickPower]);

  const buyUpgrade = useCallback(
    (id: string) => {
      const upgrade = upgrades.find((u) => u.id === id);
      if (!upgrade) return;
      const cost = getCost(upgrade);
      if (tokens < cost) return;
      setTokens((t) => t - cost);
      setUpgrades((prev) =>
        prev.map((u) => (u.id === id ? { ...u, owned: u.owned + 1 } : u)),
      );
    },
    [tokens, upgrades],
  );

  useEffect(() => {
    const interval = setInterval(() => {
      if (tokensPerSecond > 0) {
        const tick = tokensPerSecond / 20;
        setTokens((t) => t + tick);
        setTotalTokens((t) => t + tick);
      }
    }, 50);
    return () => clearInterval(interval);
  }, [tokensPerSecond]);

  return (
    <div className="flex flex-1 items-start justify-center px-6 py-12 md:py-24">
      <main className="w-full max-w-xl space-y-8">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="text-sm text-muted transition-colors hover:text-foreground"
          >
            &larr; Home
          </Link>
          <span className="rounded-full border border-border px-3 py-1 font-mono text-xs text-muted">
            {getModelTitle(totalTokens)}
          </span>
        </div>

        <div className="space-y-1 text-center">
          <p className="font-mono text-4xl font-bold tracking-tight text-foreground">
            {formatNumber(tokens)}
          </p>
          <p className="text-sm text-muted">tokens processed</p>
          {tokensPerSecond > 0 && (
            <p className="font-mono text-xs text-muted">
              {formatNumber(tokensPerSecond)}/sec
            </p>
          )}
        </div>

        <div className="flex justify-center">
          <button
            onClick={handleClick}
            className={`h-24 w-24 rounded-full border-2 border-border font-mono text-sm font-medium text-foreground transition-all hover:border-foreground hover:bg-foreground/5 active:scale-95 ${
              clickFlash ? 'bg-foreground/10 scale-95' : ''
            }`}
          >
            Train
          </button>
        </div>

        <div className="space-y-2">
          <h2 className="text-xs font-medium uppercase tracking-widest text-muted">
            Upgrades
          </h2>
          {upgrades.map((u) => {
            const cost = getCost(u);
            const canAfford = tokens >= cost;
            return (
              <button
                key={u.id}
                onClick={() => buyUpgrade(u.id)}
                disabled={!canAfford}
                className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors ${
                  canAfford
                    ? 'border-border hover:border-foreground/30 hover:bg-foreground/[0.02]'
                    : 'border-border/50 opacity-40'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{u.emoji}</span>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {u.name}
                      {u.owned > 0 && (
                        <span className="ml-2 font-mono text-xs text-muted">
                          x{u.owned}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted">{u.description}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm text-foreground">
                    {formatNumber(cost)}
                  </p>
                  <p className="font-mono text-xs text-muted">
                    +{u.tokensPerSecond}/s
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        <p className="text-center text-xs text-muted/60">
          Total tokens processed: {formatNumber(totalTokens)}
        </p>
      </main>
    </div>
  );
}
