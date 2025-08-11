import { logger } from '../shared/logger';

/**
 * Playwright Discord Screenshot Script
 * 
 * This script will:
 * 1. Navigate to each VIP+ Discord channel
 * 2. Take screenshots of the test posts
 * 3. Save screenshots with descriptive names
 */

interface ChannelConfig {
  name: string;
  id: string;
  description: string;
}

const VIP_PLUS_CHANNELS: ChannelConfig[] = [
  {
    name: 'exclusive-insights',
    id: '1288613114815840466',
    description: 'Advanced pick analysis for S/A-tier picks'
  },
  {
    name: 'trader-insights', 
    id: '1356613995175481405',
    description: 'Market movement and sharp money tracking'
  },
  {
    name: 'best-bets',
    id: '1288613037539852329', 
    description: 'Daily curated top picks compilation'
  },
  {
    name: 'game-threads',
    id: '1291234713213734912',
    description: 'Live game discussion and betting opportunities'
  },
  {
    name: 'strategy-room',
    id: '1356624758485287105',
    description: 'AI coaching and advanced strategies'
  }
];

const DISCORD_GUILD_ID = '1284478946171293736';

/**
 * Instructions for using Playwright MCP to capture Discord screenshots
 */
export function getPlaywrightInstructions(): string {
  const instructions = [
    '🎯 PLAYWRIGHT DISCORD SCREENSHOT INSTRUCTIONS',
    '=' .repeat(60),
    '',
    '1. **Navigate to Discord Web**:',
    '   - URL: https://discord.com/channels/' + DISCORD_GUILD_ID,
    '   - Login if prompted',
    '',
    '2. **For Each Channel, Navigate and Screenshot**:',
    ''
  ];

  VIP_PLUS_CHANNELS.forEach((channel, index) => {
    instructions.push(
      `**${index + 1}. ${channel.name.toUpperCase()} CHANNEL**`,
      `   - Navigate to: https://discord.com/channels/${DISCORD_GUILD_ID}/${channel.id}`,
      `   - Purpose: ${channel.description}`,
      `   - Screenshot filename: "${channel.name}-test-post.png"`,
      `   - Wait 3 seconds for messages to load`,
      `   - Take full channel screenshot`,
      ''
    );
  });

  instructions.push(
    '3. **Additional Screenshots**:',
    '   - Take overview screenshot of channel list (left sidebar)',
    '   - Capture any error messages or failed posts',
    '   - Screenshot mobile view if possible',
    '',
    '4. **Verification Checklist**:',
    '   ✅ All 5 VIP+ channels captured',
    '   ✅ Test posts visible and formatted correctly', 
    '   ✅ Embeds displaying with proper colors and formatting',
    '   ✅ No error messages in any channels',
    '   ✅ Channel permissions working (VIP+ only access)',
    '',
    '🚀 Ready to execute Playwright navigation and screenshots!'
  );

  return instructions.join('\n');
}

/**
 * Generate Playwright navigation commands
 */
export function generatePlaywrightCommands(): string[] {
  const commands = [
    '// Navigate to Discord',
    `await page.goto('https://discord.com/channels/${DISCORD_GUILD_ID}');`,
    '// Wait for page load',
    'await page.waitForTimeout(3000);',
    ''
  ];

  VIP_PLUS_CHANNELS.forEach(channel => {
    commands.push(
      `// Navigate to ${channel.name}`,
      `await page.goto('https://discord.com/channels/${DISCORD_GUILD_ID}/${channel.id}');`,
      'await page.waitForTimeout(3000);',
      `await page.screenshot({ path: '${channel.name}-test-post.png', fullPage: true });`,
      `console.log('📸 Screenshot saved: ${channel.name}-test-post.png');`,
      ''
    );
  });

  return commands;
}

/**
 * Log the test execution plan
 */
export function logTestPlan(): void {
  const correlationId = `playwright-plan-${Date.now()}`;
  const planLogger = logger.child({ correlationId });
  
  planLogger.info('Playwright Discord screenshot plan generated', {
    totalChannels: VIP_PLUS_CHANNELS.length,
    channels: VIP_PLUS_CHANNELS.map(c => c.name),
    guildId: DISCORD_GUILD_ID
  });

  console.log('\n🎬 PLAYWRIGHT EXECUTION PLAN:');
  console.log('═'.repeat(50));
  console.log(`📍 Discord Server: ${DISCORD_GUILD_ID}`);
  console.log(`📊 Total Channels: ${VIP_PLUS_CHANNELS.length}`);
  console.log('');
  console.log('📋 Channels to Screenshot:');
  
  VIP_PLUS_CHANNELS.forEach((channel, index) => {
    console.log(`${index + 1}. 💎 ${channel.name} (${channel.id})`);
    console.log(`   └── ${channel.description}`);
  });
  
  console.log('\n🎯 Expected Screenshots:');
  VIP_PLUS_CHANNELS.forEach(channel => {
    console.log(`├── ${channel.name}-test-post.png`);
  });
  
  console.log('\n✅ Ready for Playwright MCP execution!');
}

// Execute if run directly
if (require.main === module) {
  console.log(getPlaywrightInstructions());
  console.log('\n' + '='.repeat(80));
  console.log('PLAYWRIGHT COMMANDS:');
  console.log('='.repeat(80));
  console.log(generatePlaywrightCommands().join('\n'));
  
  logTestPlan();
}

export { VIP_PLUS_CHANNELS, DISCORD_GUILD_ID };