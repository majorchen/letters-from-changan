'use client';

import { useState, useEffect } from 'react';
import StartScreen from '@/components/StartScreen';
import GameScreen from '@/components/GameScreen';
import { PlayerState } from '@/lib/prompts';
import { activateSave, createNewGame, listSaveSummaries, SaveSummary } from '@/lib/gameState';

export default function Home() {
  const [gameState, setGameState] = useState<PlayerState | null>(null);
  const [screen, setScreen] = useState<'loading' | 'start' | 'game'>('loading');
  const [saves, setSaves] = useState<SaveSummary[]>([]);

  useEffect(() => {
    setSaves(listSaveSummaries());
    setScreen('start');
  }, []);

  function handleStart(role: string) {
    const state = createNewGame(role);
    setSaves(listSaveSummaries());
    setGameState(state);
    setScreen('game');
  }

  function handleContinue(saveId: string) {
    const saved = activateSave(saveId);
    if (saved) {
      setGameState(saved);
      setScreen('game');
    }
  }

  function handleExit() {
    setScreen('start');
    setSaves(listSaveSummaries());
  }

  if (screen === 'loading') {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-amber-600/50 font-handwriting text-xl">长安...</div>
      </div>
    );
  }

  if (screen === 'start') {
    return <StartScreen onStart={handleStart} saves={saves} onContinue={handleContinue} />;
  }

  if (screen === 'game' && gameState) {
    return (
      <GameScreen
        gameState={gameState}
        onStateChange={setGameState}
        onExit={handleExit}
      />
    );
  }

  return null;
}
