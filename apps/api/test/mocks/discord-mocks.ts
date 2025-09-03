import { jest } from '@jest/globals';
import { Collection, PermissionsBitField } from 'discord.js';

export function createMockInteraction() {
  return {
    reply: jest.fn(),
    followUp: jest.fn(),
    editReply: jest.fn(),
    deferReply: jest.fn(),
    options: {
      get: jest.fn(),
      getString: jest.fn(),
      getNumber: jest.fn(),
      getBoolean: jest.fn(),
      client: {} as any,
      data: {} as any,
      resolved: {} as any,
      getSubcommand: jest.fn(),
      getSubcommandGroup: jest.fn(),
      getChannel: jest.fn(),
      getMentionable: jest.fn(),
      getRole: jest.fn(),
      getUser: jest.fn(),
      getMember: jest.fn(),
      getInteger: jest.fn(),
      getAttachment: jest.fn()
    },
    member: createMockGuildMember(),
    guild: createMockGuild(),
    user: createMockUser()
  };
}

export function createMockGuildMember() {
  return {
    _roles: [],
    roles: {
      cache: new Collection(),
      add: jest.fn(),
      remove: jest.fn()
    },
    guild: createMockGuild(),
    user: createMockUser()
  };
}

export function createMockUser() {
  return {
    id: 'test-user-id',
    username: 'test-user',
    discriminator: '1234',
    avatar: null,
    bot: false,
    system: false,
    flags: null,
    equals: jest.fn(),
    _equals: jest.fn(),
    toString: () => '<@test-user-id>'
  };
}

export function createMockGuild() {
  return {
    _sortedRoles: [],
    _sortedChannels: [],
    roles: {
      cache: new Collection(),
      create: jest.fn(),
      delete: jest.fn(),
      edit: jest.fn()
    },
    channels: {
      cache: new Collection(),
      create: jest.fn(),
      delete: jest.fn(),
      edit: jest.fn()
    },
    members: {
      cache: new Collection(),
      fetch: jest.fn(),
      add: jest.fn(),
      remove: jest.fn()
    },
    messages: {
      fetch: jest.fn(),
      channel: {} as any,
      crosspost: jest.fn(),
      delete: jest.fn(),
      edit: jest.fn(),
      pin: jest.fn(),
      unpin: jest.fn(),
      react: jest.fn(),
      reply: jest.fn(),
      startThread: jest.fn(),
      removeAttachments: jest.fn(),
      resolveComponent: jest.fn(),
      awaitMessageComponent: jest.fn(),
      createMessageComponentCollector: jest.fn(),
      awaitReactions: jest.fn(),
      createReactionCollector: jest.fn(),
      fetchReference: jest.fn(),
      equals: jest.fn(),
      suppressEmbeds: jest.fn()
    }
  };
}

export function createMockMessage() {
  return {
    id: 'test-message-id',
    content: 'test message content',
    author: createMockUser(),
    member: createMockGuildMember(),
    guild: createMockGuild(),
    channel: createMockChannel(),
    reply: jest.fn(),
    edit: jest.fn(),
    delete: jest.fn()
  };
}

export function createMockRole() {
  return {
    id: 'test-role-id',
    name: 'test-role',
    color: 0,
    hoist: false,
    position: 0,
    permissions: new PermissionsBitField(),
    managed: false,
    mentionable: false,
    guild: createMockGuild()
  };
}

export function createMockChannel() {
  return {
    id: 'test-channel-id',
    name: 'test-channel',
    type: 0,
    guild: createMockGuild(),
    send: jest.fn(),
    messages: {
      fetch: jest.fn()
    }
  };
}

export function createMockClient() {
  return {
    guilds: {
      cache: new Collection(),
      fetch: jest.fn(),
      create: jest.fn()
    },
    channels: {
      cache: new Collection(),
      fetch: jest.fn(),
      create: jest.fn()
    },
    users: {
      cache: new Collection(),
      fetch: jest.fn(),
      create: jest.fn()
    },
    user: {
      id: 'test-client-id',
      username: 'test-client',
      discriminator: '0000',
      avatar: null,
      bot: true,
      system: false,
      flags: null,
      mfaEnabled: false,
      presence: null,
      verified: true,
      edit: jest.fn(),
      equals: jest.fn(),
      _equals: jest.fn(),
      toString: () => '<@test-client-id>'
    }
  };
} 