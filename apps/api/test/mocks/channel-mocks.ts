// Channel Mocks for Notification Agent Testing

export interface MockChannel {
  id: string;
  name: string;
  type: 'text' | 'voice' | 'dm';
  send: jest.MockedFunction<any>;
  guild?: {
    id: string;
    name: string;
    members: {
      fetch: jest.MockedFunction<any>;
    };
  };
  messages: {
    fetch: jest.MockedFunction<any>;
  };
}

export function createMockChannel(overrides: Partial<MockChannel> = {}): MockChannel {
  return {
    id: 'mock-channel-id',
    name: 'mock-channel',
    type: 'text',
    send: jest.fn().mockResolvedValue({ id: 'message-id' }),
    guild: {
      id: 'mock-guild-id',
      name: 'Mock Guild',
      members: {
        fetch: jest.fn().mockResolvedValue({
          id: 'user-id',
          user: { username: 'testuser' }
        })
      }
    },
    messages: {
      fetch: jest.fn().mockResolvedValue(new Map())
    },
    ...overrides
  };
}

export const mockChannelManager = {
  findChannel: jest.fn().mockImplementation((channelId: string) => 
    createMockChannel({ id: channelId })
  ),
  sendMessage: jest.fn().mockResolvedValue({ id: 'message-id' }),
  updateMessage: jest.fn().mockResolvedValue({ id: 'message-id' }),
  deleteMessage: jest.fn().mockResolvedValue(true)
};