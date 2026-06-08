import { useEffect, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { ChatMessage } from '@/lib/gameState';
import { saveChatHistory, saveGameState, updateChapter } from '@/lib/gameState';
import { ensureMailboxOption, hasDiscoveredMailbox, NEW_LETTER_OPTION, shouldForceFirstMailbox, shouldPrepareActiveLetter } from '@/lib/game/mailboxLogic';
import { cleanNarrative, cleanStreamingNarrative, extractOptions, parseNarrativeState, recoverNarrativeText } from '@/lib/game/narrativeParsing';
import { dedupeOptions, fallbackOptions, getContradictionOption, withContradictionOption } from '@/lib/game/optionLogic';
import { sanitizeOptions, sanitizeResponse, sanitizeState, stripScenePromptLeak } from '@/lib/game/responseSanitizers';
import { extractScenePrompt, fallbackSceneFromNarrative, LOCATION_KEYWORDS, visualProfilesForScene } from '@/lib/game/sceneHelpers';
import { streamChat } from '@/lib/game/chatStream';
import type { PlayerState } from '@/lib/prompts';
import { IMAGE_CONSTRAINT_SUFFIX, IMAGE_STYLE_PREFIX } from '@/lib/prompts';

interface UseGameChatOptions {
  gameStateRef: MutableRefObject<PlayerState>;
  messagesRef: MutableRefObject<ChatMessage[]>;
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  setInput: Dispatch<SetStateAction<string>>;
  onStateChange: (state: PlayerState) => void;
  prepareIncomingLetter: (playerReply: string | null) => void;
  setShowMailbox: Dispatch<SetStateAction<boolean>>;
}

export function useGameChat({
  gameStateRef,
  messagesRef,
  setMessages,
  setInput,
  onStateChange,
  prepareIncomingLetter,
  setShowMailbox,
}: UseGameChatOptions) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [sceneImage, setSceneImage] = useState<string | null>(null);
  const [ending, setEnding] = useState<{ title: string; scenes: string[] } | null>(null);
  const lastGoodImageRef = useRef<string | null>(null);
  const endingRef = useRef<typeof ending>(null);

  useEffect(() => {
    endingRef.current = ending;
  }, [ending]);

  async function prepareEnding() {
    if (endingRef.current) return;
    try {
      const res = await fetch('/api/ending', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerState: gameStateRef.current,
          recentMessages: messagesRef.current.filter((message) => !message.hidden).slice(-12),
        }),
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.scenes) && data.scenes.length >= 4) {
        setEnding({ title: data.title || '故事落幕', scenes: data.scenes.slice(0, 6) });
      }
    } catch (error) {
      console.error('[ending]', error);
    }
  }

  function persistLatestSceneImage(url: string) {
    const currentMessages = messagesRef.current;
    for (let i = currentMessages.length - 1; i >= 0; i--) {
      if (currentMessages[i].role === 'assistant') {
        const updatedMessages = [...currentMessages];
        updatedMessages[i] = { ...updatedMessages[i], sceneImage: url };
        messagesRef.current = updatedMessages;
        setMessages(updatedMessages);
        saveChatHistory(updatedMessages);
        return;
      }
    }
  }

  async function generateSceneImage(scene: string) {
    try {
      const res = await fetch('/api/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scene }),
      });
      const data = await res.json();
      if (data.url) {
        setSceneImage(data.url);
        persistLatestSceneImage(data.url);
      }
    } catch { /* silently fail - keep current image */ }
  }

  async function sendMessage(text: string, options: { visibleUser?: boolean } = {}) {
    const gs = gameStateRef.current;
    const msgs = messagesRef.current;
    const visibleUser = options.visibleUser !== false;

    const userMsg: ChatMessage = { role: 'user', content: text, timestamp: Date.now(), hidden: !visibleUser };
    const newMessages = visibleUser ? [...msgs, userMsg] : msgs;
    setMessages(newMessages);
    setInput('');
    setIsStreaming(true);

    const assistantMsg: ChatMessage = { role: 'assistant', content: '', timestamp: Date.now() };
    const playerStateForApi = {
      ...gs,
      events: (gs.events || []).filter((event) => !event.startsWith('contradiction_asked:')),
      crossLineEchoes: [],
    };
    const apiMessages = [...msgs, userMsg]
      .filter(m => m.role !== 'system')
      .slice(-20)
      .map(m => ({ role: m.role, content: stripScenePromptLeak(m.content) }));

    try {
      let sceneImageRequested = false;
      const fullContent = await streamChat(
        { messages: apiMessages, playerState: playerStateForApi },
        (streamedContent) => {
          assistantMsg.content = sanitizeResponse(cleanStreamingNarrative(stripScenePromptLeak(streamedContent)), gs);
          setMessages([...newMessages, { ...assistantMsg }]);
          const streamedSceneDesc = !sceneImageRequested ? extractScenePrompt(streamedContent) : null;
          if (streamedSceneDesc) {
            sceneImageRequested = true;
            void generateSceneImage(
              IMAGE_STYLE_PREFIX + ' ' + streamedSceneDesc + visualProfilesForScene(gs, streamedContent) + ' ' + IMAGE_CONSTRAINT_SUFFIX,
            );
          }
        },
      );

      const rawContent = fullContent;
      let cleanContent = sanitizeResponse(cleanNarrative(rawContent), gs);
      if (!cleanContent) {
        cleanContent = sanitizeResponse(recoverNarrativeText(rawContent), gs);
      }
      if (!cleanContent) {
        cleanContent = '你一时没有说话，周围的喧声重新涌了上来。';
      }
      const narrativeState = parseNarrativeState(rawContent);
      if (narrativeState) sanitizeState(narrativeState, gs);
      if (narrativeState?.visualCue === 'ending' && !endingRef.current) {
        void prepareEnding();
      }
      const mailboxTriggered = rawContent.includes('[MAILBOX]');
      const updated = updateChapter(gs, rawContent, narrativeState);

      const sceneDesc = extractScenePrompt(rawContent);
      if (sceneDesc) {
        if (!sceneImageRequested) {
          sceneImageRequested = true;
          void generateSceneImage(
            IMAGE_STYLE_PREFIX + ' ' + sceneDesc + visualProfilesForScene(updated, rawContent) + ' ' + IMAGE_CONSTRAINT_SUFFIX,
          );
        }
      } else {
        let generatedFromKeyword = false;
        for (const loc of LOCATION_KEYWORDS) {
          if (rawContent.includes(loc.keyword)) {
            generatedFromKeyword = true;
            if (!sceneImageRequested) {
              sceneImageRequested = true;
              void generateSceneImage(
                IMAGE_STYLE_PREFIX + ' ' + loc.scene + visualProfilesForScene(updated, rawContent) + ' ' + IMAGE_CONSTRAINT_SUFFIX,
              );
            }
            break;
          }
        }
        if (!generatedFromKeyword && !sceneImageRequested) {
          sceneImageRequested = true;
          void generateSceneImage(
            IMAGE_STYLE_PREFIX + ' ' + fallbackSceneFromNarrative(updated.location, cleanContent) + visualProfilesForScene(updated, rawContent) + ' ' + IMAGE_CONSTRAINT_SUFFIX,
          );
        }
      }

      const forcedFirstMailbox = shouldForceFirstMailbox(updated, rawContent);
      const pendingFirstMailbox = mailboxTriggered
        || narrativeState?.mailbox === 'pending_first_open'
        || forcedFirstMailbox;

      if (pendingFirstMailbox && !hasDiscoveredMailbox(gs)) {
        updated.chapter = 'mailbox_found';
        updated.mailbox = {
          ...updated.mailbox,
          discovered: true,
          pendingFirstOpen: true,
          unread: [],
        };
        if (!updated.events.includes('发现邮箱')) {
          updated.events = [...updated.events, '发现邮箱'];
        }
        assistantMsg.content = /(陶器|陶罐|信匣|邮箱|金色光|金光)/.test(cleanContent)
          ? cleanContent
          : `${cleanContent}\n\n你刚把行李放稳，客房角落那只唐三彩陶器忽然泛起一层很轻的金光。`;
        assistantMsg.options = [NEW_LETTER_OPTION];
        onStateChange(updated);
        saveGameState(updated);
        gameStateRef.current = updated;
        const finalMsgs = [...newMessages, { ...assistantMsg }];
        saveChatHistory(finalMsgs);
        setMessages(finalMsgs);
        prepareIncomingLetter(null);
        setIsStreaming(false);
        setShowMailbox(true);
        return;
      }

      const extractedOptions = sanitizeOptions(extractOptions(rawContent), msgs);
      const contextualFallback = fallbackOptions(updated, rawContent, msgs, text);
      const modelOptions = dedupeOptions(extractedOptions, msgs, 'model');
      const optionsWithFallback = modelOptions.length > 0 ? modelOptions : contextualFallback;
      const opts = updated.awaitingFreeInput
        ? []
        : dedupeOptions(
          ensureMailboxOption(withContradictionOption(optionsWithFallback, getContradictionOption(updated)), updated),
          msgs,
          'final',
        );
      if (opts.includes(NEW_LETTER_OPTION)) {
        updated.mailbox = {
          ...updated.mailbox,
          unread: updated.mailbox.unread.map((notice) => ({ ...notice, noticeShown: true })),
        };
      }

      assistantMsg.content = cleanContent;
      assistantMsg.options = opts;
      onStateChange(updated);
      saveGameState(updated);
      gameStateRef.current = updated;
      const finalMessages = [...newMessages, { ...assistantMsg, content: cleanContent, options: opts }];
      saveChatHistory(finalMessages);
      setMessages(finalMessages);
      if (shouldPrepareActiveLetter(updated)) {
        window.setTimeout(() => prepareIncomingLetter(null), 500);
      }
      setIsStreaming(false);
    } catch (err) {
      assistantMsg.content = '（长安城的喧嚣声突然安静了一瞬...请再试一次）';
      setMessages([...newMessages, assistantMsg]);
      setIsStreaming(false);
      console.error(err);
    }
  }

  return {
    isStreaming,
    sceneImage,
    setSceneImage,
    ending,
    lastGoodImageRef,
    sendMessage,
  };
}
