'use client';

import Image from 'next/image';
import { useState, useRef, useEffect, useCallback } from 'react';
import { ChatMessage, saveGameState } from '@/lib/gameState';
import { PlayerState, ROLES } from '@/lib/prompts';
import { findUnreadLetter, getUnreadLetterCount, isLetterRelatedOption, isMailboxOption, NEW_LETTER_OPTION } from '@/lib/game/mailboxLogic';
import { contradictionAskedMarker, findContradictionEventByOption } from '@/lib/game/optionLogic';
import ChatDisplay from './ChatDisplay';
import GameHeader from './GameHeader';
import LetterModal from './LetterModal';
import LetterBox from './LetterBox';
import OptionPanel from './OptionPanel';
import Prologue from './Prologue';
import ShareModal from './ShareModal';
import TypewriterOpening from './TypewriterOpening';
import EndingSequence from './EndingSequence';
import { useGameChat } from './hooks/useGameChat';
import { useLetterFlow } from './hooks/useLetterFlow';
import { useShareCard } from './hooks/useShareCard';
import { useOpeningFlow } from './hooks/useOpeningFlow';

interface Props {
  gameState: PlayerState;
  onStateChange: (state: PlayerState) => void;
  onExit: () => void;
}

export default function GameScreen({ gameState, onStateChange, onExit }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Always-fresh refs to avoid React closure staleness in async callbacks
  const gameStateRef = useRef(gameState);
  const messagesRef = useRef(messages);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const {
    showLetter,
    letterContent,
    letterLoading,
    isPreparingLetter,
    showMailbox,
    setShowMailbox,
    showLetterBox,
    setShowLetterBox,
    openLetter,
    prepareIncomingLetter,
    handleReply,
    handleLetterClose,
    removeMailboxOptionFromLatestMessage,
  } = useLetterFlow({
    gameState,
    gameStateRef,
    messagesRef,
    setMessages,
    onStateChange,
    setSaveToast: () => {},
    continueNarration: (prompt) => {
      sendMessage(prompt, { visibleUser: false });
    },
  });

  const {
    isStreaming,
    sceneImage,
    setSceneImage,
    ending,
    lastGoodImageRef,
    earlyOptions,
    queueStreamingOption,
    sendMessage,
  } = useGameChat({
    gameStateRef,
    messagesRef,
    setMessages,
    setInput,
    onStateChange,
    prepareIncomingLetter,
    setShowMailbox,
  });

  const { shareImageUrl, setShareImageUrl, handleShareCard } = useShareCard({
    gameState,
    messages,
    activeLetterContent: showLetter ? letterContent : '',
    roleName: ROLES[gameState.role]?.name || '旅人',
  });

  const { gamePhase, typewriterText, handlePrologueComplete } = useOpeningFlow({
    role: gameState.role,
    setMessages,
    setSceneImage,
  });

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, 50);
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    sendMessage(input.trim());
  }

  function handleOptionClick(option: string) {
    if (isStreaming) {
      queueStreamingOption(option);
      return;
    }

    const currentState = gameStateRef.current;
    if (isMailboxOption(option, currentState) || option === NEW_LETTER_OPTION) {
      const unreadLetter = findUnreadLetter(currentState);
      if (unreadLetter) {
        void openLetter(unreadLetter.id);
      } else {
        removeMailboxOptionFromLatestMessage();
        setShowLetterBox(true);
      }
      return;
    }

    if (isLetterRelatedOption(option)) {
      const unreadLetter = findUnreadLetter(currentState);
      if (unreadLetter) {
        void openLetter(unreadLetter.id);
        return;
      }
      if (currentState.mailbox.pendingFirstOpen || currentState.mailbox.pending) {
        setShowLetterBox(true);
        return;
      }
      // 没有未读、没有 pending → 不拦截，当普通选项继续走正常对话
    }

    const contradictionEvent = findContradictionEventByOption(gameStateRef.current, option);
    if (contradictionEvent) {
      const marker = contradictionAskedMarker(contradictionEvent);
      const currentState = gameStateRef.current;
      if (!currentState.events.includes(marker)) {
        const updated = {
          ...currentState,
          events: [...currentState.events, marker],
        };
        gameStateRef.current = updated;
        onStateChange(updated);
        saveGameState(updated);
      }
    }

    sendMessage(option);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  const unreadLetterCount = getUnreadLetterCount(gameState);
  const shouldGlowLetterBox = unreadLetterCount > 0;
  const isWaitingForLetter = Boolean(gameState.mailbox.pending);

  // Prologue
  if (gamePhase === 'prologue') {
    return <Prologue role={gameState.role} onComplete={handlePrologueComplete} />;
  }

  // Typewriter opening
  if (gamePhase === 'typewriter') {
    return <TypewriterOpening sceneImage={sceneImage} typewriterText={typewriterText} />;
  }

  // Main game — scroll-over-image layout
  return (
    <div className="h-full flex flex-col bg-stone-950 relative">
      {/* Scene image — absolute, behind everything */}
      {sceneImage && (
        <div className="absolute inset-x-0 top-0 h-[35vh] z-0 pointer-events-none">
          <Image
            src={sceneImage}
            alt=""
            fill
            sizes="100vw"
            unoptimized
            className="object-cover opacity-50 transition-opacity duration-1000"
            onLoad={() => { lastGoodImageRef.current = sceneImage; }}
            onError={() => setSceneImage(lastGoodImageRef.current)}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-stone-950" />
        </div>
      )}
      <GameHeader
        location={gameState.location}
        roleName={ROLES[gameState.role]?.name || '旅人'}
        shouldGlowLetterBox={shouldGlowLetterBox}
        isWaitingForLetter={isWaitingForLetter}
        onExit={onExit}
        onShare={() => void handleShareCard()}
        onOpenLetterBox={() => setShowLetterBox(true)}
      />

      <ChatDisplay messages={messages} isStreaming={isStreaming} scrollRef={scrollRef} />

      {/* Mailbox notification */}
      {showMailbox && (
        <div className="px-5 pb-2 z-10">
          <button
            onClick={() => void openLetter()}
            className="w-full py-3 rounded-xl bg-amber-700/15 border border-amber-500/20 text-amber-300/80 text-sm animate-pulse-glow flex items-center justify-center gap-2"
          >
            <span className="text-lg">📮</span>
            邮箱在发光...
          </button>
        </div>
      )}

      <OptionPanel
        gameState={gameState}
        messages={messages}
        isStreaming={isStreaming}
        showMailbox={showMailbox}
        earlyOptions={earlyOptions}
        input={input}
        onInputChange={setInput}
        onSubmit={handleSubmit}
        onKeyDown={handleKeyDown}
        onOptionClick={handleOptionClick}
      />

      {/* Modals */}
      {showLetter && (
        <LetterModal content={letterContent} isLoading={letterLoading} onClose={handleLetterClose} onReply={handleReply} canReply={true} />
      )}
      {showLetterBox && (
        <LetterBox
          letters={gameState.letterHistory}
          pending={gameState.mailbox.pending}
          isPreparingLetter={isPreparingLetter}
          onClose={() => setShowLetterBox(false)}
          onOpenLetter={(id) => {
            setShowLetterBox(false);
            void openLetter(id);
          }}
        />
      )}

      {shareImageUrl && <ShareModal imageUrl={shareImageUrl} onClose={() => setShareImageUrl('')} />}
      {ending && (
        <EndingSequence
          title={ending.title}
          scenes={ending.scenes}
          onRestart={onExit}
          onShare={() => void handleShareCard(ending.scenes[0])}
        />
      )}
    </div>
  );
}
