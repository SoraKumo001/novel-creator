import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { ChatFloatingButton } from './ChatFloatingButton';
import { ChatContext } from '@/context/ChatContext.js';
import type { ChatContextValue } from '@/context/ChatContext.js';

function makeChatValue(overrides: Partial<ChatContextValue>): ChatContextValue {
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
    messages: [],
    isStreaming: false,
    streamingContent: '',
    streamingParts: null,
    error: null,
    sendMessage: fn(),
    abortStream: fn(),
    clearMessages: fn(),
    ...overrides,
  };
}

const meta = {
  component: ChatFloatingButton,
  tags: ['autodocs'],
  decorators: [
    (Story, { parameters }) => (
      <ChatContext.Provider value={parameters.chatValue}>
        <Story />
      </ChatContext.Provider>
    ),
  ],
} satisfies Meta<typeof ChatFloatingButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: {
    chatValue: makeChatValue({ isOpen: false, isStreaming: false }),
  },
};

export const Streaming: Story = {
  parameters: {
    chatValue: makeChatValue({ isOpen: false, isStreaming: true }),
  },
};
