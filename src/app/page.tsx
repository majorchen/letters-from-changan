'use client';

import { useState, useEffect } from 'react';
import StartScreen from '@/components/StartScreen';
import GameScreen from '@/components/GameScreen';
import { PlayerState } from '@/lib/prompts';
import { loadGameState, createNewGame, clearGame } from '@/lib/gameState';

export default function Home() {
  const [gameState, setGameState] = useState<PlayerState | null>(null);
  const [screen, setScreen] = useState<'loading' | 'start' | 'game'>('loading');
  const [hasSave, setHasSave] = useState(false);

  useEffect(() => {
    const saved = loadGameState();
    if (saved) {
      setHasSave(true);
    }
    setScreen('start');
  }, []);

  function handleStart(role: string) {
    clearGame();
    const state = createNewGame(role);
    setGameState(state);
    setScreen('game');
  }

  function handleContinue() {
    const saved = loadGameState();
    if (saved) {
      setGameState(saved);
      setScreen('game');
    }
  }

  function handleExit() {
    setScreen('start');
    setHasSave(true);
  }

  if (screen === 'loading') {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-amber-600/50 font-handwriting text-xl">长安...</div>
      </div>
    );
  }

  if (screen === 'start') {
    return <StartScreen onStart={handleStart} hasSave={hasSave} onContinue={handleContinue} />;
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
