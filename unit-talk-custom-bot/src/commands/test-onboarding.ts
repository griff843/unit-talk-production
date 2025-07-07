import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { OnboardingService } from '../services/onboardingService';
import { UserTier } from '../types/index';

export const data = new SlashCommandBuilder()
  .setName('test-onboarding')
  .setDescription('🧪 Test onboarding sequences for all tiers (Admin only)')
  .addStringOption(option =>
    option.setName('tier')
      .setDescription('Select tier to test (or "all" for all tiers)')
      .setRequired(true)
      .addChoices(
        { name: '🌟 VIP+ (Premium)', value: 'vip_plus' },
        { name: '👑 VIP', value: 'vip' },
        { name: '🏆 Capper', value: 'capper' },
        { name: '🛡️ Staff', value: 'staff' },
        { name: '⚡ Admin', value: 'admin' },
        { name: '👑 Owner', value: 'owner' },
        { name: '👋 Free', value: 'free' },
        { name: '🎯 ALL TIERS', value: 'all' }
      )
  )
  .addBooleanOption(option =>
    option.setName('send-to-channel')
      .setDescription('Send test messages to this channel instead of DM (for easier viewing)')
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction, services: any) {
  try {
    // Check if user has admin permissions
    const member = interaction.member;
    if (!member || !('roles' in member)) {
      await interaction.reply({ content: '❌ This command can only be used in a server.', ephemeral: true });
      return;
    }

    // Check if user has admin permissions (comprehensive check)
    const userId = interaction.user.id;
    const guild = interaction.guild;

    // Check if user is Discord server owner
    const isServerOwner = guild?.ownerId === userId;

    // Check if user has admin role by name (case-insensitive)
    const hasAdminRole = member.roles instanceof Map
      ? Array.from(member.roles.values()).some((role: any) =>
          ['admin', 'owner', 'staff', 'moderator'].includes(role.name.toLowerCase())
        )
      : Array.isArray(member.roles)
        ? member.roles.some((roleId: string) => {
            const role = interaction.guild?.roles.cache.get(roleId);
            return role && ['admin', 'owner', 'staff', 'moderator'].includes(role.name.toLowerCase());
          })
        : member.roles.cache.some((role: any) =>
            ['admin', 'owner', 'staff', 'moderator'].includes(role.name.toLowerCase())
          );

    // Check if user has configured owner role ID (your specific role)
    const ownerRoleId = '1287971921832710276'; // Your owner role ID
    const hasOwnerRole = member.roles instanceof Map
      ? Array.from(member.roles.values()).some((role: any) => role.id === ownerRoleId)
      : Array.isArray(member.roles)
        ? member.roles.includes(ownerRoleId)
        : member.roles.cache.has(ownerRoleId);

    // Debug info (remove this after testing)
    console.log(`Permission check for ${interaction.user.tag}:`, {
      userId,
      isServerOwner,
      hasAdminRole,
      hasOwnerRole,
      guildOwnerId: guild?.ownerId,
      userRoles: member.roles instanceof Map
        ? Array.from(member.roles.values()).map((r: any) => ({ id: r.id, name: r.name }))
        : Array.isArray(member.roles)
          ? member.roles
          : member.roles.cache.map((r: any) => ({ id: r.id, name: r.name }))
    });

    if (!isServerOwner && !hasAdminRole && !hasOwnerRole) {
      await interaction.reply({
        content: '❌ You need admin permissions to use this command. (Server Owner, Admin, Owner, Staff, or Moderator role required)',
        ephemeral: true
      });
      return;
    }

    const selectedTier = interaction.options.getString('tier', true);
    const sendToChannel = interaction.options.getBoolean('send-to-channel') || false;

    await interaction.deferReply({ ephemeral: !sendToChannel });

    const onboardingService = new OnboardingService();

    if (selectedTier === 'all') {
      // Test all tiers
      const allTiers: UserTier[] = ['free' as UserTier, 'vip', 'vip_plus', 'capper', 'staff', 'admin', 'owner'];
      
      const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('🧪 Testing All Onboarding Sequences')
        .setDescription('Starting comprehensive onboarding test for all tiers...')
        .addFields(
          {
            name: '📋 Test Plan',
            value: allTiers.map(tier => `• ${getTierEmoji(tier)} ${tier.toUpperCase()}`).join('\n'),
            inline: false
          },
          {
            name: '⏱️ Timing',
            value: 'All messages will be sent with 2-second intervals for easy review',
            inline: false
          },
          {
            name: '📍 Delivery',
            value: sendToChannel ? 'Messages will appear in this channel' : 'Check your DMs for the test messages',
            inline: false
          }
        )
        .setFooter({ text: 'Test initiated by ' + interaction.user.username })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

      // Test each tier with a delay between tiers
      for (let i = 0; i < allTiers.length; i++) {
        const tier = allTiers[i];
        
        if (sendToChannel) {
          // Send tier header to channel
          const tierHeader = new EmbedBuilder()
            .setColor(getTierColor(tier) as any)
            .setTitle(`${getTierEmoji(tier)} Testing ${tier.toUpperCase()} Tier`)
            .setDescription(`Starting ${tier} onboarding sequence...`)
            .setTimestamp();

          await interaction.followUp({ embeds: [tierHeader] });

          // Simulate onboarding by sending messages to channel
          await testTierInChannel(interaction, tier, onboardingService);

          // If testing Free, VIP, or VIP+ tier, also test the welcome message system
          if (tier === 'free' as any || tier === 'vip' || tier === 'vip_plus') {
            await testWelcomeMessageInChannel(interaction, tier);
          }
        } else {
          // Send to user's DM
          await onboardingService.handleUserOnboarding(interaction.user, tier, true);

          // If testing Free, VIP, or VIP+ tier, also test the welcome message system via DM
          if (tier === 'free' as any || tier === 'vip' || tier === 'vip_plus') {
            await testWelcomeMessageDM(interaction, tier);
          }
        }
        
        // Wait between tiers to avoid spam
        if (i < allTiers.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }

      const completionEmbed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('✅ All Onboarding Tests Complete!')
        .setDescription('All tier onboarding sequences have been tested successfully.')
        .addFields(
          {
            name: '📊 Summary',
            value: `Tested ${allTiers.length} different tiers`,
            inline: false
          },
          {
            name: '🔍 Review',
            value: sendToChannel ? 'All test messages are visible above' : 'Check your DMs for all test sequences',
            inline: false
          }
        )
        .setTimestamp();

      await interaction.followUp({ embeds: [completionEmbed] });

    } else {
      // Test single tier
      const tier = selectedTier as UserTier;
      
      const embed = new EmbedBuilder()
        .setColor('#FF6B6B' as any)
        .setTitle(`🧪 Testing ${tier.toUpperCase()} Onboarding`)
        .setDescription(`Starting onboarding test for ${tier} tier...`)
        .addFields(
          {
            name: '🎯 Target Tier',
            value: `${getTierEmoji(tier)} ${tier.toUpperCase()}`,
            inline: true
          },
          {
            name: '📍 Delivery',
            value: sendToChannel ? 'This channel' : 'Your DMs',
            inline: true
          },
          {
            name: '⏱️ Timing',
            value: 'Instant (test mode)',
            inline: true
          }
        )
        .setFooter({ text: 'Test initiated by ' + interaction.user.username })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

      if (sendToChannel) {
        await testTierInChannel(interaction, tier, onboardingService);

        // If testing Free, VIP, or VIP+ tier, also test the welcome message system
        if (tier === 'free' as any || tier === 'vip' || tier === 'vip_plus') {
          await testWelcomeMessageInChannel(interaction, tier);
        }
      } else {
        await onboardingService.handleUserOnboarding(interaction.user, tier, true);

        // If testing Free, VIP, or VIP+ tier, also test the welcome message system via DM
        if (tier === 'free' as any || tier === 'vip' || tier === 'vip_plus') {
          await testWelcomeMessageDM(interaction, tier);
        }
      }

      const completionEmbed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('✅ Onboarding Test Complete!')
        .setDescription(`${tier.toUpperCase()} onboarding sequence has been tested successfully.`)
        .setTimestamp();

      await interaction.followUp({ embeds: [completionEmbed] });
    }

  } catch (error) {
    console.error('Error in test-onboarding command:', error);
    
    const errorEmbed = new EmbedBuilder()
      .setColor('#FF0000')
      .setTitle('❌ Test Failed')
      .setDescription('An error occurred while testing the onboarding sequence.')
      .addFields({
        name: 'Error Details',
        value: error instanceof Error ? error.message : 'Unknown error',
        inline: false
      })
      .setTimestamp();

    if (interaction.deferred) {
      await interaction.editReply({ embeds: [errorEmbed] });
    } else {
      await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  }
}

/**
 * Test a specific tier by sending messages to the channel
 */
async function testTierInChannel(interaction: ChatInputCommandInteraction, tier: UserTier, onboardingService: OnboardingService) {
  // Create a mock sequence to get the messages
  const sequence = (onboardingService as any).createOnboardingSequence(interaction.user, tier);
  
  if (!sequence || sequence.messages.length === 0) {
    await interaction.followUp({ 
      content: `⚠️ No onboarding sequence found for tier: ${tier}`,
      ephemeral: true 
    });
    return;
  }

  // Send each message to the channel with short delays
  for (let i = 0; i < sequence.messages.length; i++) {
    const message = sequence.messages[i];
    
    // Add test header to distinguish messages
    const testEmbed = new EmbedBuilder()
      .setColor('#FFA500')
      .setTitle(`📧 Message ${i + 1}/${sequence.messages.length} - ${tier.toUpperCase()}`)
      .setDescription(`Original delay: ${formatDelay(message.delay)}`)
      .setTimestamp();

    await interaction.followUp({ 
      embeds: [testEmbed, message.embed],
      components: message.components || []
    });
    
    // Short delay between messages
    if (i < sequence.messages.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

/**
 * Get emoji for tier
 */
function getTierEmoji(tier: UserTier): string {
  const emojis: Record<string, string> = {
    free: '🆓',
    member: '👤',
    vip: '💎',
    vip_plus: '🌟',
    capper: '🎯',
    staff: '👨‍💼',
    admin: '🛡️',
    owner: '👑'
  };

  return emojis[tier] || '❓';
}

/**
 * Get color for tier
 */
function getTierColor(tier: UserTier): string {
  const tierColors: Record<string, string> = {
    free: '#95A5A6',
    member: '#95A5A6', // Add member tier mapping
    vip: '#9B59B6',
    vip_plus: '#FFD700',
    capper: '#E67E22',
    staff: '#3498DB',
    admin: '#E74C3C',
    owner: '#F39C12'
  };

  return tierColors[tier] || '#95A5A6';
}

function getTierName(tier: UserTier): string {
  const tierNames: Record<string, string> = {
    free: 'Free Member',
    member: 'Member', // Add member tier mapping
    vip: 'VIP Member',
    vip_plus: 'VIP+ Member',
    capper: 'Capper',
    staff: 'Staff Member',
    admin: 'Administrator',
    owner: 'Server Owner'
  };

  return tierNames[tier] || 'Member';
}

/**
 * Format delay time for display
 */

/**
 * Format delay time for display
 */
function formatDelay(delay: number): string {
  if (delay === 0) return 'Immediate';

  const minutes = Math.floor(delay / (1000 * 60));
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else {
    return `${minutes}m`;
  }
}

/**
 * Test welcome message system in channel
 */
async function testWelcomeMessageInChannel(interaction: ChatInputCommandInteraction, tier: string = 'free') {
  try {
    // Import WelcomeService dynamically
    const { WelcomeService } = await import('../services/welcomeService');
    const welcomeService = new WelcomeService();

    // Create a header for the welcome test
    const welcomeTestHeader = new EmbedBuilder()
      .setColor('#00FF7F')
      .setTitle('🎉 Testing Welcome Message System')
      .setDescription(`Simulating new ${tier.toUpperCase()} member welcome flow...`)
      .setTimestamp();

    await interaction.followUp({ embeds: [welcomeTestHeader] });

    // Get the member who ran the command to simulate welcome
    const member = interaction.guild?.members.cache.get(interaction.user.id);
    if (!member) {
      await interaction.followUp({
        content: '❌ Could not find member data for welcome test',
        ephemeral: true
      });
      return;
    }

    // Create welcome embed and buttons based on tier
    let welcomeEmbed: any;
    let welcomeButtons: any;

    switch (tier) {
      case 'vip':
        welcomeEmbed = (welcomeService as any).createVIPWelcomeEmbed(member);
        welcomeButtons = (welcomeService as any).createVIPWelcomeButtons();
        break;
      case 'vip_plus':
        welcomeEmbed = (welcomeService as any).createVIPPlusWelcomeEmbed(member);
        welcomeButtons = (welcomeService as any).createVIPPlusWelcomeButtons();
        break;
      default: // free
        welcomeEmbed = (welcomeService as any).createFreeWelcomeEmbed(member);
        welcomeButtons = (welcomeService as any).createFreeWelcomeButtons();
    }

    await interaction.followUp({
      content: `**🧪 WELCOME TEST:** This is what ${member.user.username} would receive as a new ${tier.toUpperCase()} member:`,
      embeds: [welcomeEmbed],
      components: [welcomeButtons]
    });

    // For VIP+, also show the second tech message
    if (tier === 'vip_plus') {
      const techEmbed = (welcomeService as any).createVIPPlusTechEmbed(member);

      setTimeout(async () => {
        await interaction.followUp({
          content: `**🧪 VIP+ TECH MESSAGE:** This second message would be sent 3 seconds later:`,
          embeds: [techEmbed]
        });
      }, 2000); // Shorter delay for testing
    }

  } catch (error) {
    console.error('Error testing welcome message in channel:', error);
    await interaction.followUp({
      content: '❌ Error testing welcome message system',
      ephemeral: true
    });
  }
}

/**
 * Test welcome message system via DM
 */
async function testWelcomeMessageDM(interaction: ChatInputCommandInteraction, tier: string = 'free') {
  try {
    // Import WelcomeService dynamically
    const { WelcomeService } = await import('../services/welcomeService');
    const welcomeService = new WelcomeService();

    // Get the member who ran the command
    const member = interaction.guild?.members.cache.get(interaction.user.id);
    if (!member) {
      await interaction.followUp({
        content: '❌ Could not find member data for welcome test',
        ephemeral: true
      });
      return;
    }

    // Temporarily modify member roles to simulate the tier for testing
    const originalRoles = member.roles.cache.clone();

    // Add a temporary role name that matches the tier for testing
    const mockRole = { name: tier, toLowerCase: () => tier.toLowerCase() };
    (member.roles.cache as any).set('test-role', mockRole);

    // Test the actual welcome flow based on tier
    switch (tier) {
      case 'vip':
        await (welcomeService as any).sendVIPWelcome(member);
        break;
      case 'vip_plus':
        await (welcomeService as any).sendVIPPlusWelcome(member);
        break;
      default: // free
        await (welcomeService as any).sendFreeWelcome(member);
    }

    // Restore original roles
    member.roles.cache.clear();
    originalRoles.forEach((role, id) => {
      member.roles.cache.set(id, role);
    });

    await interaction.followUp({
      content: `🎉 ${tier.toUpperCase()} welcome message test sent! Check your DMs for the welcome message.`,
      ephemeral: true
    });

  } catch (error) {
    console.error('Error testing welcome message DM:', error);
    await interaction.followUp({
      content: '❌ Error testing welcome message system',
      ephemeral: true
    });
  }
}