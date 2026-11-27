import { create } from 'zustand';
import {
  readLocalCacheItem,
  subscribeLocalCacheChange,
  writeLocalCacheItem,
} from '../lib/indexeddb-storage';
import { getDefaultProductCatalog } from '../lib/product-catalog';
import { useSiteContentStore } from '../store/site-content-store';
import { INITIAL_CONVERSATION_CONTEXT } from './conversation-context';
import type { FloatingPoint } from './drag-bounds';
import {
  createInitialSainAiGreeting,
  generateSainAiTurn,
} from './engine';
import { buildKnowledgeBase } from './knowledge-base';
import { computeSainAiSequenceDelaysMs } from './typing-delay';
import type { SainAiConversationContext, SainAiMessage } from './types';

export const SAIN_AI_FLOATING_STORAGE_KEY = 'shansusdzar-sain-ai-floating-v1';

let pendingReplyTimers: number[] = [];
let pendingTurnToken = 0;

function clearPendingReplyTimers(): void {
  pendingTurnToken += 1;
  if (typeof window !== 'undefined') {
    pendingReplyTimers.forEach((timerId) => window.clearTimeout(timerId));
  }
  pendingReplyTimers = [];
}

function loadFloatingBubbleEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const raw = readLocalCacheItem(SAIN_AI_FLOATING_STORAGE_KEY);
    if (raw === 'false') return false;
    if (raw === 'true') return true;
    return true;
  } catch {
    return true;
  }
}

function saveFloatingBubbleEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    writeLocalCacheItem(
      SAIN_AI_FLOATING_STORAGE_KEY,
      enabled ? 'true' : 'false'
    );
  } catch {
    // Abaikan kegagalan penyimpanan
  }
}

function createUserMessage(text: string): SainAiMessage {
  return {
    id: `sain-user-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    sender: 'user',
    text: text.trim(),
    createdAt: new Date().toISOString(),
  };
}

function getLiveKnowledgeBase() {
  const siteState = useSiteContentStore.getState();
  const activeCatalog = siteState.getActiveCatalog() ?? getDefaultProductCatalog();
  return buildKnowledgeBase(siteState, activeCatalog.daftarProduk);
}

interface SainAiStoreState {
  isOpen: boolean;
  isTyping: boolean;
  isFloatingBubbleEnabled: boolean;
  messages: SainAiMessage[];
  context: SainAiConversationContext;
  desktopPosition: FloatingPoint | null;
  isDesktopExpanded: boolean;
  openChat: (initialPrompt?: string) => void;
  closeChat: () => void;
  toggleChat: () => void;
  setFloatingBubbleEnabled: (enabled: boolean) => void;
  resetSainAiPreferences: () => void;
  toggleDesktopExpanded: () => void;
  setDesktopPosition: (pos: FloatingPoint | null) => void;
  sendMessage: (rawText: string) => void;
  clearContextMemory: () => void;
  resetConversation: () => void;
}

export const useSainAiStore = create<SainAiStoreState>((set, get) => ({
  isOpen: false,
  isTyping: false,
  isFloatingBubbleEnabled: loadFloatingBubbleEnabled(),
  messages: [createInitialSainAiGreeting(getLiveKnowledgeBase())],
  context: INITIAL_CONVERSATION_CONTEXT,
  desktopPosition: null,
  isDesktopExpanded: false,

  openChat: (initialPrompt) => {
    const state = get();
    if (
      state.messages.length === 1 &&
      state.messages[0]?.id === 'sain-welcome' &&
      !state.isTyping
    ) {
      set({
        isOpen: true,
        messages: [createInitialSainAiGreeting(getLiveKnowledgeBase())],
      });
    } else {
      set({ isOpen: true });
    }
    if (initialPrompt && initialPrompt.trim().length > 0 && !get().isTyping) {
      get().sendMessage(initialPrompt);
    }
  },

  closeChat: () => set({ isOpen: false }),

  toggleChat: () => set((state) => ({ isOpen: !state.isOpen })),

  setFloatingBubbleEnabled: (enabled) => {
    saveFloatingBubbleEnabled(enabled);
    set({ isFloatingBubbleEnabled: enabled });
  },

  resetSainAiPreferences: () => {
    saveFloatingBubbleEnabled(true);
    set({ isFloatingBubbleEnabled: true });
  },

  toggleDesktopExpanded: () =>
    set((state) => ({ isDesktopExpanded: !state.isDesktopExpanded })),

  setDesktopPosition: (pos) => set({ desktopPosition: pos }),

  sendMessage: (rawText) => {
    if (get().isTyping) return;
    const trimmed = rawText.trim();
    if (!trimmed) return;

    clearPendingReplyTimers();
    const activeToken = pendingTurnToken;

    const kb = getLiveKnowledgeBase();
    const currentContext = get().context;
    const userMsg = createUserMessage(trimmed);
    const { messages: replyMessages, nextContext } = generateSainAiTurn({
      query: trimmed,
      kb,
      context: currentContext,
    });
    const delaysMs = computeSainAiSequenceDelaysMs(replyMessages);

    set((state) => ({
      messages: [...state.messages, userMsg],
      isTyping: true,
    }));

    if (typeof window === 'undefined') {
      set((state) => ({
        messages: [...state.messages, ...replyMessages],
        context: nextContext,
        isTyping: false,
      }));
      return;
    }

    const scheduleBubble = (index: number) => {
      const bubbleMsg = replyMessages[index];
      if (!bubbleMsg || activeToken !== pendingTurnToken) return;
      const delayMs = delaysMs[index] ?? 1400;
      const isFinalBubble = index === replyMessages.length - 1;

      const timerId = window.setTimeout(() => {
        if (activeToken !== pendingTurnToken) return;
        set((state) => ({
          messages: [
            ...state.messages,
            {
              ...bubbleMsg,
              createdAt: new Date().toISOString(),
            },
          ],
          context: isFinalBubble ? nextContext : state.context,
          isTyping: !isFinalBubble,
        }));
        if (isFinalBubble) {
          pendingReplyTimers = [];
        } else {
          scheduleBubble(index + 1);
        }
      }, delayMs);

      pendingReplyTimers.push(timerId);
    };

    scheduleBubble(0);
  },

  clearContextMemory: () => {
    clearPendingReplyTimers();
    set({ context: INITIAL_CONVERSATION_CONTEXT, isTyping: false });
  },

  resetConversation: () => {
    clearPendingReplyTimers();
    const kb = getLiveKnowledgeBase();
    set({
      messages: [createInitialSainAiGreeting(kb)],
      context: INITIAL_CONVERSATION_CONTEXT,
      isTyping: false,
    });
  },
}));

if (typeof window !== 'undefined') {
  subscribeLocalCacheChange(SAIN_AI_FLOATING_STORAGE_KEY, () => {
    useSainAiStore.setState({ isFloatingBubbleEnabled: loadFloatingBubbleEnabled() });
  });
}
