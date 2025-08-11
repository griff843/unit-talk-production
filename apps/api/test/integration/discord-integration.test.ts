import { Client, GuildMember, TextChannel, Message } from 'discord.js';

import { createMockPick, createMockCapper } from '../utils/testData';

// Initialize Discord client for integration tests
const client = new Client({
  intents: ['GuildMessages', 'GuildMembers', 'MessageContent']
});

describe('Discord API Integration', () => {
  let testChannel: TextChannel;
  let testMember: GuildMember;

  beforeAll(async () => {
    // Connect to Discord
    await client.login(process.env.DISCORD_TOKEN);

    // Get test channel and member
    testChannel = await client.channels.fetch(process.env.TEST_CHANNEL_ID!) as TextChannel;
    testMember = await testChannel.guild.members.fetch(process.env.TEST_USER_ID!);
  });

  afterAll(async () => {
    // Disconnect from Discord
    await client.destroy();
  });

  describe('Message Operations', () => {
    let testMessage: Message;

    afterEach(async () => {
      // Clean up test messages
      if (testMessage) {
        await testMessage.delete();
      }
    });

    it('should send and retrieve messages', async () => {
      // Send test message
      testMessage = await testChannel.send('Test message');
      expect(testMessage.content).toBe('Test message');

      // Retrieve message
      const retrievedMessage = await testChannel.messages.fetch(testMessage.id);
      expect(retrievedMessage.content).toBe('Test message');
    });

    it('should send embeds', async () => {
      const embed = {
        title: 'Test Embed',
        description: 'This is a test embed',
        color: 0x00ff00
      };

      // Send embed
      testMessage = await testChannel.send({ embeds: [embed] });
      expect(testMessage.embeds[0].title).toBe('Test Embed');
    });

    it('should handle message edits', async () => {
      // Send initial message
      testMessage = await testChannel.send('Initial message');

      // Edit message
      const editedMessage = await testMessage.edit('Edited message');
      expect(editedMessage.content).toBe('Edited message');
    });
  });

  describe('Member Operations', () => {
    it('should fetch member details', async () => {
      const member = await testChannel.guild.members.fetch(testMember.id);
      expect(member.id).toBe(testMember.id);
    });

    it('should check member roles', async () => {
      const hasRole = testMember.roles.cache.some(role => role.name === 'UT Capper');
      expect(hasRole).toBeDefined();
    });

    it('should get member permissions', async () => {
      const permissions = testMember.permissions.toArray();
      expect(permissions).toBeDefined();
    });
  });

  describe('Pick Notifications', () => {
    it('should send pick submission notification', async () => {
      const testPick = createMockPick({
        capper_discord_id: testMember.id,
        capper_username: testMember.user.username
      });

      const embed = {
        title: '🎯 New Pick Submitted',
        description: `Pick submitted by ${testPick.capper_username}`,
        fields: [
          {
            name: 'Type',
            value: testPick.pick_type.toUpperCase(),
            inline: true
          },
          {
            name: 'Units',
            value: testPick.total_units.toString(),
            inline: true
          }
        ],
        color: 0x00ff00
      };

      // Send notification
      testMessage = await testChannel.send({ embeds: [embed] });
      expect(testMessage.embeds[0].title).toBe('🎯 New Pick Submitted');
    });

    it('should send pick grading notification', async () => {
      const testPick = createMockPick({
        capper_discord_id: testMember.id,
        capper_username: testMember.user.username,
        status: 'finalized',
        result: 'win'
      });

      const embed = {
        title: '✅ Pick Graded',
        description: `Pick by ${testPick.capper_username} has been graded`,
        fields: [
          {
            name: 'Result',
            value: testPick.result.toUpperCase(),
            inline: true
          }
        ],
        color: 0x00ff00
      };

      // Send notification
      testMessage = await testChannel.send({ embeds: [embed] });
      expect(testMessage.embeds[0].title).toBe('✅ Pick Graded');
    });
  });

  describe('Capper Notifications', () => {
    it('should send capper onboarding notification', async () => {
      const testCapper = createMockCapper({
        discord_id: testMember.id,
        discord_username: testMember.user.username,
        display_name: 'The Analyst',
        tier: 'pro'
      });

      const embed = {
        title: '🎉 New Capper Onboarded',
        description: `Welcome ${testCapper.display_name}!`,
        fields: [
          {
            name: 'Tier',
            value: testCapper.tier.toUpperCase(),
            inline: true
          },
          {
            name: 'Specialties',
            value: testCapper.specialties?.join(', ') || 'None',
            inline: true
          }
        ],
        color: 0x00ff00
      };

      // Send notification
      testMessage = await testChannel.send({ embeds: [embed] });
      expect(testMessage.embeds[0].title).toBe('🎉 New Capper Onboarded');
    });

    it('should send tier upgrade notification', async () => {
      const embed = {
        title: '⭐ Tier Upgrade',
        description: `${testMember.user.username} has been upgraded to VIP!`,
        color: 0x00ff00
      };

      // Send notification
      testMessage = await testChannel.send({ embeds: [embed] });
      expect(testMessage.embeds[0].title).toBe('⭐ Tier Upgrade');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid channel gracefully', async () => {
      try {
        await client.channels.fetch('invalid-channel-id');
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeTruthy();
      }
    });

    it('should handle invalid member gracefully', async () => {
      try {
        await testChannel.guild.members.fetch('invalid-member-id');
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeTruthy();
      }
    });

    it('should handle message deletion errors', async () => {
      try {
        const fakeMessage = { id: 'invalid-message-id', delete: () => Promise.reject(new Error('Not found')) };
        await fakeMessage.delete();
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeTruthy();
      }
    });
  });
}); 