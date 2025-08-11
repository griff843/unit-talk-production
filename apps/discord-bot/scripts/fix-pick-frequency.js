#!/usr/bin/env node

/**
 * Fix Pick Frequency FAQ - Remove Specific Numbers
 */

require('dotenv').config();
const { Client, GatewayIntentBits, ChannelType, EmbedBuilder } = require('discord.js');

async function fixPickFrequencyFAQ() {
  console.log('🔧 Fixing pick frequency FAQ...');

  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
  });

  try {
    await client.login(process.env.DISCORD_TOKEN);
    await new Promise(resolve => client.once('ready', resolve));
    console.log(`✅ Connected as ${client.user?.tag}`);

    const FAQ_FORUM_ID = '1387837517298139267';
    const forumChannel = await client.channels.fetch(FAQ_FORUM_ID);

    if (!forumChannel || forumChannel.type !== ChannelType.GuildForum) {
      throw new Error('FAQ forum channel not found');
    }

    // Get all existing threads
    const threads = await forumChannel.threads.fetchActive();
    const archivedThreads = await forumChannel.threads.fetchArchived();
    const allThreads = [...threads.threads.values(), ...archivedThreads.threads.values()];

    // Find the pick frequency thread
    const pickFrequencyThread = allThreads.find(t => t.name === '📅 How often are tips provided?');

    if (pickFrequencyThread) {
      console.log('🗑️ Deleting old pick frequency thread...');
      await pickFrequencyThread.delete();
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Create updated embed with realistic expectations
    const updatedEmbed = new EmbedBuilder()
      .setTitle('📅 How often are tips provided?')
      .setDescription(
        `**Quality Over Quantity - Picks When Value Exists**

**Our Philosophy:**
We only post picks when we identify genuine value and edge. Some days we may have multiple quality plays, other days we might not post anything at all if we don't see profitable opportunities.

**What to Expect:**
• **Value-Based Approach** - Picks only when we see real edge
• **Multiple Sports Coverage** - Opportunities across different leagues
• **Seasonal Variation** - More picks during peak sports seasons
• **Quality Focus** - Better to miss a day than force bad bets
• **No Filler Picks** - Every pick must meet our standards

**Typical Patterns:**
• **Busy Sports Days** - Multiple quality opportunities
• **Slow Sports Days** - May have few or no picks
• **Peak Seasons** - More frequent opportunities (NFL, NBA, MLB seasons)
• **Off-Seasons** - Fewer picks, focus on available value
• **Special Events** - Increased coverage for playoffs, tournaments

**Alert System:**
• Real-time Discord notifications for every new pick
• Mobile push notifications through Discord app
• Never miss a pick when we do find value
• Follow specific cappers for personalized notifications

**Why This Approach Works:**
• Higher win rates by being selective
• Better long-term ROI for members
• Builds trust through disciplined approach
• Focuses on sustainable betting practices

**Remember:** The best cappers know when NOT to bet. We'd rather have you miss a day of betting than lose money on forced picks with no edge.

Enable Discord notifications and you'll be alerted the moment we find value!`
      )
      .setColor(0x1e90ff)
      .setFooter({ text: 'Quality picks when value exists' });

    // Create the new thread
    const newThread = await forumChannel.threads.create({
      name: '📅 How often are tips provided?',
      message: {
        embeds: [updatedEmbed],
        components: [
          {
            type: 1,
            components: [
              {
                type: 2,
                style: 5,
                label: 'Go to Capper Corner',
                url: 'https://discord.com/channels/1284478946171293736/1387837517298139270',
              },
            ],
          },
        ],
      },
    });

    console.log('✅ Created updated pick frequency FAQ');
    console.log('🎉 Pick frequency FAQ fixed!');
  } catch (error) {
    console.error('❌ Fix failed:', error);
  } finally {
    await client.destroy();
    console.log('✅ Disconnected');
    process.exit(0);
  }
}

fixPickFrequencyFAQ();
