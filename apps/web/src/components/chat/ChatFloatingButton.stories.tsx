import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { ChatFloatingButton } from './ChatFloatingButton';
import {
  ChatStreamingContext,
  ChatUIContext,
  type ChatStreamingContextValue,
  type ChatUIContextValue,
} from '@/context/ChatContext.js';

function makeUIValue(overrides: Partial<ChatUIContextValue>): ChatUIContextValue {
  return {
    isOpen: false,
    openChat: fn(),
    closeChat: fn(),
    toggleChat: fn(),
    chatFocus: null,
    consumeFocus: fn(),
    selectedNovelId: null,
    setSelectedNovelId: fn(),
    selectedModelConfigId: null,
    setSelectedModelConfigId: fn(),
    sessions: [],
    currentSessionId: null,
    currentSession: null,
    loadingSessions: false,
    loadingMessages: false,
    startNewChat: fn(),
    createSession: fn(),
    selectSession: fn(),
    deleteSession: fn(),
    updateSessionTitle: fn(),
    refreshSessions: fn(),
    clearMessages: fn(),
    ...overrides,
  };
}

function makeStreamingValue(
  overrides: Partial<ChatStreamingContextValue>,
): ChatStreamingContextValue {
  return {
    messages: [],
    isStreaming: false,
    streamingContent: '',
    streamingParts: null,
    error: null,
    lastPrompt: null,
    sendMessage: fn(),
    retryLastMessage: fn(),
    clearError: fn(),
    abortStream: fn(),
    ...overrides,
  };
}

const meta = {
  component: ChatFloatingButton,
  tags: ['autodocs'],
  decorators: [
    (Story, { parameters }) => (
      <ChatUIContext.Provider value={parameters.chatUIValue}>
        <ChatStreamingContext.Provider value={parameters.chatStreamingValue}>
          <Story />
        </ChatStreamingContext.Provider>
      </ChatUIContext.Provider>
    ),
  ],
} satisfies Meta<typeof ChatFloatingButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: {
    chatUIValue: makeUIValue({ isOpen: false }),
    chatStreamingValue: makeStreamingValue({ isStreaming: false }),
  },
};

export const Streaming: Story = {
  parameters: {
    chatUIValue: makeUIValue({ isOpen: false }),
    chatStreamingValue: makeStreamingValue({ isStreaming: true }),
  },
};
