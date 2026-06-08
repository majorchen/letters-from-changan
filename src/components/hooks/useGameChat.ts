import { useEffect, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { ChatMessage } from '@/lib/gameState';
import { saveChatHistory, saveGameState, updateChapter } from '@/lib/gameState';
import { ensureMailboxOption, hasDiscoveredMailbox, NEW_LETTER_OPTION, shouldForceFirstMailbox, shouldPrepareActiveLetter } from '@/lib/game/mailboxLogic';
import { recoverNarrativeText } from '@/lib/game/narrativeParsing';
import { dedupeOptions, fallbackOptions, getContradictionOption, withContradictionOption } from '@/lib/game/optionLogic';
import { sanitizeOptions, sanitizeResponse, sanitizeState, stripScenePromptLeak } from '@/lib/game/responseSanitizers';
import { buildImagePrompt, fallbackSceneFromNarrative, LOCATION_KEYWORDS } from '@/lib/game/sceneHelpers';
import { streamChat } from '@/lib/game/chatStream';
import type { PlayerState } from '@/lib/prompts';
import { parseAiTurn } from '@/lib/game/aiTurnParser';

const ENDING_GATE_TURN = 220;
const ENDING_OPTION = '面对这条线最后的问题';

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
  const [earlyOptions, setEarlyOptions] = useState<string[]>([]);
  const [sceneImage, setSceneImage] = useState<string | null>(null);
  const [ending, setEnding] = useState<{ title: string; scenes: string[] } | null>(null);
  const lastGoodImageRef = useRef<string | null>(null);
  const endingRef = useRef<typeof ending>(null);
  const queuedOptionRef = useRef<string | null>(null);
  const activeRequestRef = useRef(false);

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

  function logOptionFallbackDiagnostics(rawContent: string, parsedOptions: string[], extractedOptions: string[], warnings: string[]) {
    console.warn('[chat-options-fallback]', {
      hasOptionsOpenTag: /\[\s*OPTIONS_JSON\s*\]/i.test(rawContent),
      hasOptionsCloseTag: /\[\s*\/\s*OPTIONS_JSON\s*\]/i.test(rawContent),
      hasRawJsonArray: /(?:^|\n)\s*\[\s*"[^"\n]{1,80}"/m.test(rawContent),
      hasStateBlock: /\[\s*STATE\s*\]/i.test(rawContent),
      parsedOptions,
      extractedOptions,
      warnings,
      rawExcerpt: rawContent.slice(0, 800),
    });
  }

  function uniqueOptions(options: string[]): string[] {
    return Array.from(new Set(options.map((option) => option.trim()).filter(Boolean))).slice(0, 4);
  }

  async function sendMessage(text: string, options: { visibleUser?: boolean } = {}) {
    if (activeRequestRef.current) return;
    activeRequestRef.current = true;

    const gs = gameStateRef.current;
    const msgs = messagesRef.current;
    const visibleUser = options.visibleUser !== false;

    const userMsg: ChatMessage = { role: 'user', content: text, timestamp: Date.now(), hidden: !visibleUser };
    const newMessages = visibleUser ? [...msgs, userMsg] : msgs;
    setMessages(newMessages);
    setInput('');
    setEarlyOptions([]);
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
      let suppressEarlyOptions = false;
      const fullContent = await streamChat(
        { messages: apiMessages, playerState: playerStateForApi },
        (event) => {
          if (event.type === 'narrative') {
            assistantMsg.content = sanitizeResponse(event.content, gs);
            setMessages([...newMessages, { ...assistantMsg }]);
            return;
          }

          if (event.type === 'options') {
            if (suppressEarlyOptions) return;
            if (!hasDiscoveredMailbox(gs) && /(陶罐|陶器|信匣|邮箱|金光|发光)/.test(assistantMsg.content)) {
              suppressEarlyOptions = true;
              setEarlyOptions([]);
              return;
            }
            const modelOptions = dedupeOptions(sanitizeOptions(event.options, msgs), msgs, 'model');
            if (modelOptions.length > 0) setEarlyOptions(modelOptions);
            return;
          }

          if (event.type === 'mailbox') {
            suppressEarlyOptions = true;
            setEarlyOptions([]);
            return;
          }

          if (event.type === 'scene' && !sceneImageRequested) {
            sceneImageRequested = true;
            void generateSceneImage(buildImagePrompt(event.scene, gs, assistantMsg.content));
          }
        },
      );

      const rawContent = fullContent;
      const parsedTurn = parseAiTurn(rawContent);
      let cleanContent = sanitizeResponse(parsedTurn.narrative, gs);
      if (!cleanContent) {
        cleanContent = sanitizeResponse(recoverNarrativeText(rawContent), gs);
      }
      if (!cleanContent) {
        cleanContent = '你一时没有说话，周围的喧声重新涌了上来。';
      }
      const narrativeState = parsedTurn.state;
      if (narrativeState) sanitizeState(narrativeState, gs);
      if (narrativeState?.visualCue === 'ending' && !endingRef.current) {
        void prepareEnding();
      }
      const mailboxTriggered = parsedTurn.mailboxTriggered;
      const updated = updateChapter(gs, rawContent, narrativeState);

      const sceneDesc = parsedTurn.scenePrompt;
      if (sceneDesc) {
        if (!sceneImageRequested) {
          sceneImageRequested = true;
          void generateSceneImage(buildImagePrompt(sceneDesc, updated, rawContent));
        }
      } else {
        let generatedFromKeyword = false;
        for (const loc of LOCATION_KEYWORDS) {
          if (rawContent.includes(loc.keyword)) {
            generatedFromKeyword = true;
            if (!sceneImageRequested) {
              sceneImageRequested = true;
              void generateSceneImage(buildImagePrompt(loc.scene, updated, rawContent));
            }
            break;
          }
        }
        if (!generatedFromKeyword && !sceneImageRequested) {
          sceneImageRequested = true;
          void generateSceneImage(buildImagePrompt(fallbackSceneFromNarrative(updated.location, cleanContent), updated, rawContent));
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
        queuedOptionRef.current = null;
        setEarlyOptions([]);
        activeRequestRef.current = false;
        setIsStreaming(false);
        setShowMailbox(true);
        return;
      }

      const extractedOptions = sanitizeOptions(parsedTurn.options, msgs);
      const contextualFallback = fallbackOptions(updated, rawContent, msgs, text);
      const modelOptions = dedupeOptions(extractedOptions, msgs, 'model');
      const usingFallbackOptions = modelOptions.length === 0;
      if (usingFallbackOptions && !updated.awaitingFreeInput) {
        logOptionFallbackDiagnostics(rawContent, parsedTurn.options, extractedOptions, parsedTurn.warnings);
      }
      const optionsWithFallback = modelOptions.length > 0 ? modelOptions : contextualFallback;
      const shouldOfferEnding = updated.storyPhase === 'act3'
        && updated.turnCount >= ENDING_GATE_TURN
        && !endingRef.current
        && narrativeState?.visualCue !== 'ending';
      let opts = updated.awaitingFreeInput
        ? []
        : (() => {
          const baseOptions = ensureMailboxOption(
            shouldOfferEnding
              ? [ENDING_OPTION, ...withContradictionOption(optionsWithFallback, getContradictionOption(updated))]
              : withContradictionOption(optionsWithFallback, getContradictionOption(updated)),
            updated,
          );
          return usingFallbackOptions
            ? uniqueOptions(baseOptions).slice(0, 3)
            : dedupeOptions(baseOptions, msgs, 'final');
        })();
      if (!updated.awaitingFreeInput && opts.length < 2) {
        const supplementedOptions = [...opts, ...optionsWithFallback, ...contextualFallback];
        opts = usingFallbackOptions
          ? uniqueOptions(supplementedOptions).slice(0, 3)
          : dedupeOptions(supplementedOptions, msgs, 'final').slice(0, 3);
      }
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
      if (text === ENDING_OPTION && !endingRef.current) {
        void prepareEnding();
      }
      if (shouldPrepareActiveLetter(updated)) {
        window.setTimeout(() => prepareIncomingLetter(null), 500);
      }
      const queuedOption = queuedOptionRef.current;
      queuedOptionRef.current = null;
      setEarlyOptions([]);
      setIsStreaming(false);
      if (queuedOption) {
        window.setTimeout(() => {
          activeRequestRef.current = false;
          void sendMessage(queuedOption);
        }, 0);
        return;
      }
      activeRequestRef.current = false;
    } catch (err) {
      assistantMsg.content = '（长安城的喧嚣声突然安静了一瞬...请再试一次）';
      setMessages([...newMessages, assistantMsg]);
      queuedOptionRef.current = null;
      setEarlyOptions([]);
      activeRequestRef.current = false;
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
    earlyOptions,
    queueStreamingOption: (option: string) => {
      if (queuedOptionRef.current === option) return;
      queuedOptionRef.current = option;
      setEarlyOptions([]);
    },
    sendMessage,
  };
}
