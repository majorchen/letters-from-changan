import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '@/lib/gameState';
import { loadChatHistory, saveChatHistory } from '@/lib/gameState';
import { buildOpeningMessage, getRoleScene } from '@/lib/game/openingFlow';
import { latestSceneFromMessages } from '@/lib/game/sceneHelpers';

type GamePhase = 'prologue' | 'typewriter' | 'playing';

interface UseOpeningFlowOptions {
  role: string;
  setMessages: (messages: ChatMessage[]) => void;
  setSceneImage: (imageUrl: string | null) => void;
}

export function useOpeningFlow({ role, setMessages, setSceneImage }: UseOpeningFlowOptions) {
  const [gamePhase, setGamePhase] = useState<GamePhase>('prologue');
  const [typewriterText, setTypewriterText] = useState('');
  const initRef = useRef(false);

  useEffect(() => {
    const history = loadChatHistory();
    if (history.length > 0) {
      setMessages(history);
      const latestScene = latestSceneFromMessages(history);
      if (latestScene) setSceneImage(latestScene);
    }
  }, [setMessages, setSceneImage]);

  useEffect(() => {
    if (initRef.current) return;
    const history = loadChatHistory();
    initRef.current = true;
    if (history.length > 0) {
      setSceneImage(latestSceneFromMessages(history) || getRoleScene(role));
      setGamePhase('playing');
    }
  }, [role, setSceneImage]);

  useEffect(() => {
    if (gamePhase !== 'typewriter') return;
    const openingMsg = buildOpeningMessage(role);
    let i = 0;
    setTypewriterText('');
    const interval = window.setInterval(() => {
      i++;
      setTypewriterText(openingMsg.content.slice(0, i));
      if (i >= openingMsg.content.length) {
        window.clearInterval(interval);
        setMessages([openingMsg]);
        saveChatHistory([openingMsg]);
        window.setTimeout(() => setGamePhase('playing'), 300);
      }
    }, 35);
    return () => window.clearInterval(interval);
  }, [gamePhase, role, setMessages]);

  const handlePrologueComplete = useCallback((bgUrl: string) => {
    setSceneImage(bgUrl);
    setGamePhase('typewriter');
  }, [setSceneImage]);

  return {
    gamePhase,
    typewriterText,
    handlePrologueComplete,
  };
}
