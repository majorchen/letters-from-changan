'use client';

import { useState, useEffect } from 'react';
import StartScreen from '@/components/StartScreen';
import GameScreen from '@/components/GameScreen';
import ErrorBoundary from '@/components/ErrorBoundary';
import IntroSplash from '@/components/IntroSplash';
import { PlayerState } from '@/lib/prompts';
import { activateSave, createNewGame, listSaveSummaries, SaveSummary } from '@/lib/gameState';

export default function Home() {
  const [gameState, setGameState] = useState<PlayerState | null>(null);
  const [screen, setScreen] = useState<'loading' | 'start' | 'game'>('loading');
  const [saves, setSaves] = useState<SaveSummary[]>([]);

  useEffect(() => {
    setSaves(listSaveSummaries());
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
    return <IntroSplash onComplete={() => setScreen('start')} />;
  }

  if (screen === 'start') {
    return <StartScreen onStart={handleStart} saves={saves} onContinue={handleContinue} onSavesChanged={() => setSaves(listSaveSummaries())} />;
  }

  if (screen === 'game' && gameState) {
    return (
      <ErrorBoundary>
        <GameScreen
          gameState={gameState}
          onStateChange={setGameState}
          onExit={handleExit}
        />
      </ErrorBoundary>
    );
  }

  return null;
}
