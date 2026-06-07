import { useEffect, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { getCloudUserEmail } from '@/lib/cloudSaves';
import type { ChatMessage } from '@/lib/gameState';
import { saveChatHistory, saveGameState } from '@/lib/gameState';
import { buildLetterContinuationPrompt } from '@/lib/game/letterHelpers';
import { findUnreadLetter, getUnreadLetterCount, hasDiscoveredMailbox, NEW_LETTER_OPTION } from '@/lib/game/mailboxLogic';
import type { LetterEntry, PlayerState } from '@/lib/prompts';

const GUEST_FIRST_LETTER_TOAST_KEY = 'letters-from-changan-guest-first-letter-toast-v1';

interface UseLetterFlowOptions {
  gameState: PlayerState;
  gameStateRef: MutableRefObject<PlayerState>;
  messagesRef: MutableRefObject<ChatMessage[]>;
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  onStateChange: (state: PlayerState) => void;
  setSaveToast: Dispatch<SetStateAction<string>>;
  continueNarration: (prompt: string) => void;
}

export function useLetterFlow({
  gameState,
  gameStateRef,
  messagesRef,
  setMessages,
  onStateChange,
  setSaveToast,
  continueNarration,
}: UseLetterFlowOptions) {
  const [showLetter, setShowLetter] = useState(false);
  const [letterContent, setLetterContent] = useState('');
  const [letterLoading, setLetterLoading] = useState(false);
  const [activeLetterWasUnread, setActiveLetterWasUnread] = useState(false);
  const [showMailbox, setShowMailbox] = useState(false);
  const [showLetterBox, setShowLetterBox] = useState(false);
  const preparingLetterRef = useRef(false);

  function removeMailboxOptionFromLatestMessage() {
    const currentMessages = messagesRef.current;
    const lastMessage = currentMessages[currentMessages.length - 1];
    if (lastMessage?.role !== 'assistant' || !lastMessage.options?.includes(NEW_LETTER_OPTION)) return;
    const nextMessages = [...currentMessages];
    nextMessages[nextMessages.length - 1] = {
      ...lastMessage,
      options: lastMessage.options.filter((option) => option !== NEW_LETTER_OPTION),
    };
    messagesRef.current = nextMessages;
    setMessages(nextMessages);
    saveChatHistory(nextMessages);
  }

  async function showGuestFirstLetterToast() {
    if (typeof window === 'undefined') return;
    if (localStorage.getItem(GUEST_FIRST_LETTER_TOAST_KEY)) return;
    const email = await getCloudUserEmail();
    if (email) return;
    localStorage.setItem(GUEST_FIRST_LETTER_TOAST_KEY, 'shown');
    setSaveToast('旅程已保存 · 登录可跨设备继续');
    window.setTimeout(() => setSaveToast(''), 3000);
  }

  async function openLetter(letterId?: string) {
    setShowLetter(true);
    setShowMailbox(false);
    setLetterLoading(false);
    const gs = gameStateRef.current;
    const targetId = letterId || gs.mailbox.unread[0]?.id || findUnreadLetter(gs)?.id;
    const letter = gs.letterHistory.find((item) => item.id === targetId && item.from === 'linShen');
    if (!letter) {
      setShowLetter(false);
      return;
    }
    setLetterContent(letter.content);
    const wasUnread = !letter.readAt;
    setActiveLetterWasUnread(wasUnread);
    const updated: PlayerState = {
      ...gs,
      chapter: gs.chapter === 'mailbox_found' ? 'first_letter_read' : gs.chapter,
      mailbox: {
        ...gs.mailbox,
        pendingFirstOpen: false,
        unread: gs.mailbox.unread.filter((notice) => notice.id !== letter.id),
      },
      letterHistory: gs.letterHistory.map((item) => item.id === letter.id ? { ...item, readAt: Date.now() } : item),
    };
    gameStateRef.current = updated;
    onStateChange(updated);
    saveGameState(updated);
    removeMailboxOptionFromLatestMessage();
    if (wasUnread && gs.letterHistory.filter((item) => item.from === 'linShen' && item.readAt).length === 0) {
      void showGuestFirstLetterToast();
    }
  }

  async function finishIncomingLetter(id: string, content: string) {
    const gs = gameStateRef.current;
    if (gs.letterHistory.some((letter) => letter.id === id)) return;
    const letter: LetterEntry = {
      id,
      from: 'linShen',
      content,
      timestamp: Date.now(),
      noticeShown: false,
    };
    const updated: PlayerState = {
      ...gs,
      mailbox: {
        ...gs.mailbox,
        discovered: true,
        pendingFirstOpen: false,
        pending: undefined,
        unread: [...gs.mailbox.unread.filter((notice) => notice.id !== id), {
          id,
          from: 'linShen',
          createdAt: Date.now(),
          noticeShown: false,
        }],
        lastGeneratedAtTurn: gs.turnCount,
      },
      letterHistory: [...gs.letterHistory, letter],
    };
    const currentMessages = messagesRef.current;
    const last = currentMessages[currentMessages.length - 1];
    if (last?.role === 'assistant') {
      const nextMessages = [...currentMessages];
      nextMessages[nextMessages.length - 1] = {
        ...last,
        options: [NEW_LETTER_OPTION, ...(last.options || []).filter((option) => option !== NEW_LETTER_OPTION)].slice(0, 4),
      };
      messagesRef.current = nextMessages;
      setMessages(nextMessages);
      saveChatHistory(nextMessages);
      updated.mailbox.unread = updated.mailbox.unread.map((notice) => ({ ...notice, noticeShown: true }));
    }
    gameStateRef.current = updated;
    onStateChange(updated);
    saveGameState(updated);
  }

  async function prepareIncomingLetter(playerReply: string | null, retryCount = 0) {
    if (preparingLetterRef.current || gameStateRef.current.mailbox.pending) return;
    preparingLetterRef.current = true;
    try {
      const gs = gameStateRef.current;
      const res = await fetch('/api/letter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerReply,
          letterHistory: gs.letterHistory,
          playerState: {
            ...gs,
            events: (gs.events || []).filter((event) => !event.startsWith('contradiction_asked:')),
            crossLineEchoes: [],
          },
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.content) throw new Error(data.error || 'Letter generation failed');
      const id = `letter-${Date.now()}`;
      await finishIncomingLetter(id, data.content);
    } catch (error) {
      console.error('[incoming-letter]', error);
      if (retryCount < 1) {
        preparingLetterRef.current = false;
        await new Promise(r => setTimeout(r, 2000));
        return prepareIncomingLetter(playerReply, retryCount + 1);
      }
      setSaveToast('林深还在写信...请稍后再试');
      setTimeout(() => setSaveToast(''), 4000);
    } finally {
      preparingLetterRef.current = false;
    }
  }

  async function handleReply(reply: string) {
    const gs = gameStateRef.current;
    const updated = {
      ...gs,
      chapter: 'letter_replied',
      mailbox: {
        ...gs.mailbox,
        pendingFirstOpen: false,
        lastGeneratedAtTurn: gs.turnCount || 0,
      },
      letterHistory: [...gs.letterHistory, {
        id: `reply-${Date.now()}`,
        from: 'player' as const,
        content: reply,
        timestamp: Date.now(),
        readAt: Date.now(),
      }],
    };
    gameStateRef.current = updated;
    onStateChange(updated);
    saveGameState(updated);
    void prepareIncomingLetter(reply);

    const replyMsg: ChatMessage = { role: 'system', content: '📮 你将回信投入了邮箱。信纸在金光中消失了。', timestamp: Date.now() };
    const newMessages = [...messagesRef.current, replyMsg];
    messagesRef.current = newMessages;
    setMessages(newMessages);
    saveChatHistory(newMessages);
    setShowLetter(false);

    setTimeout(() => {
      continueNarration(buildLetterContinuationPrompt(updated, 'reply'));
    }, 800);
  }

  function handleLetterClose() {
    setShowLetter(false);
    if (activeLetterWasUnread) {
      setActiveLetterWasUnread(false);
      setTimeout(() => {
        continueNarration(buildLetterContinuationPrompt(gameStateRef.current, 'read'));
      }, 800);
    }
  }

  useEffect(() => {
    const pending = gameState.mailbox?.pending;
    if (!pending || preparingLetterRef.current) return;
    void finishIncomingLetter(pending.id, pending.content);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.mailbox?.pending?.id]);

  useEffect(() => {
    if (hasDiscoveredMailbox(gameState) && getUnreadLetterCount(gameState) === 0) {
      setShowMailbox(false);
    }
  }, [gameState]);

  return {
    showLetter,
    letterContent,
    letterLoading,
    showMailbox,
    setShowMailbox,
    showLetterBox,
    setShowLetterBox,
    openLetter,
    prepareIncomingLetter,
    handleReply,
    handleLetterClose,
    removeMailboxOptionFromLatestMessage,
  };
}
