import {
  ButtonInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  GuildMember,
  TextChannel,
  ThreadAutoArchiveDuration,
  ChannelType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  Colors
} from 'discord.js';
import { getUserTier, getTierDisplayName } from '../utils/roleUtils';
import { logger } from '../utils/logger';

/**
 * Onboarding Button Handler
 * Handles all button interactions from onboarding messages
 */
export class OnboardingButtonHandler {
  
  /**
   * Handle onboarding button interactions
   */
  async handleOnboardingButton(interaction: ButtonInteraction): Promise<void> {
    const { customId, user } = interaction;

    // Add debug logging
    logger.info(`🔘 Button interaction received: ${customId} from user ${user.tag} (${user.id})`);

    try {
      // Get user's current tier
      const member = interaction.guild?.members.cache.get(user.id) || null;

      // Enhanced debug logging for roles
      if (member && member.roles) {
        const roleNames = member.roles.cache.map(role => role.name).join(', ');
        logger.info(`👤 User ${user.tag} has roles: [${roleNames}]`);
      } else {
        logger.warn(`👤 User ${user.tag} - no member object or roles found`);
      }

      const currentTier = getUserTier(member);
      logger.info(`👤 User ${user.tag} detected tier: ${currentTier}`);

      // Validate button access with detailed logging
      const hasAccess = this.validateButtonAccess(customId, currentTier);
      logger.info(`🔍 Access check for button ${customId} with tier ${currentTier}: ${hasAccess ? 'GRANTED' : 'DENIED'}`);

      if (!hasAccess) {
        logger.warn(`❌ Access denied for button ${customId} - user tier: ${currentTier}`);
        await interaction.reply({
          content: `❌ You don't have access to this feature. Your current tier: ${getTierDisplayName(currentTier)}`,
          ephemeral: true
        });
        return;
      }

      logger.info(`✅ Access granted for button ${customId} - user tier: ${currentTier}`);

      // Handle the specific button
      // Handle the specific button
      switch (customId) {
        // Capper buttons
        case 'capper_onboard_start':
          await this.handleCapperOnboardingStart(interaction);
          break;

        case 'capper_guide':
          await this.handleCapperGuide(interaction);
          break;

        case 'create_capper_thread':
          await this.handleCreateCapperThread(interaction);
          break;

        case 'capper_practice_pick':
          await this.handleCapperPracticePick(interaction);
          break;

        case 'view_leaderboard':
          await this.handleViewLeaderboard(interaction);
          break;

        case 'capper_support':
          await this.handleCapperSupport(interaction);
          break;

        // VIP buttons
        case 'view_vip_guide':
          await this.handleViewVipGuide(interaction);
          break;

        case 'setup_notifications':
          await this.handleSetupNotifications(interaction);
          break;

        case 'start_vip_tour':
          await this.handleStartVipTour(interaction);
          break;

        // VIP+ buttons
        case 'view_vip_plus_guide':
          await this.handleViewVipPlusGuide(interaction);
          break;

        case 'access_elite_features':
          await this.handleAccessEliteFeatures(interaction);
          break;

        case 'vip_plus_tour':
          await this.handleVipPlusTour(interaction);
          break;

        case 'setup_vip_plus_notifications':
          await this.handleSetupVipPlusNotifications(interaction);
          break;

        // Trial/Upgrade buttons
        case 'view_trial_features':
          await this.handleViewTrialFeatures(interaction);
          break;

        case 'upgrade_to_vip':
          await this.handleUpgradeToVip(interaction);
          break;

        case 'upgrade_to_vip_plus':
          await this.handleUpgradeToVipPlus(interaction);
          break;

        // Basic buttons
        case 'view_faq':
          await this.handleViewFaq(interaction);
          break;

        case 'start_vip_trial':
          await this.handleStartVipTrial(interaction);
          break;

        // Secondary buttons
        case 'setup_notifications_now':
          await this.handleSetupNotificationsNow(interaction);
          break;

        case 'notification_help':
          await this.handleNotificationHelp(interaction);
          break;

        // Staff buttons
        case 'staff_guide':
          await this.handleStaffGuide(interaction);
          break;

        default:
          logger.warn(`❓ Unknown onboarding button: ${customId}`);
          await this.handleUnknownButton(interaction);
      }

      logger.info(`✅ Successfully handled button ${customId} for user ${user.tag}`);

    } catch (error) {
      logger.error(`❌ Error handling onboarding button ${customId}:`, error);
      await this.handleButtonError(interaction, error);
    }
  }
  
  /**
   * CAPPER ONBOARDING HANDLERS
   */
  
  private async handleCapperOnboardingStart(interaction: ButtonInteraction): Promise<void> {
    // Create onboarding modal
    const modal = new ModalBuilder()
      .setCustomId('capper_onboarding_modal')
      .setTitle('🎯 Capper Onboarding - Step 1');
    
    const nameInput = new TextInputBuilder()
      .setCustomId('capper_name')
      .setLabel('Preferred Capper Name')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Enter your capper display name')
      .setRequired(true)
      .setMaxLength(50);
    
    const experienceInput = new TextInputBuilder()
      .setCustomId('capper_experience')
      .setLabel('Experience Level')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Beginner, Intermediate, or Expert')
      .setRequired(true)
      .setMaxLength(20);
    
    const sportsInput = new TextInputBuilder()
      .setCustomId('capper_sports')
      .setLabel('Sports Specialization')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('NFL, NBA, MLB, NHL, etc. (separate with commas)')
      .setRequired(true)
      .setMaxLength(100);
    
    const bioInput = new TextInputBuilder()
      .setCustomId('capper_bio')
      .setLabel('Brief Bio/Introduction')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Tell us about your betting background and approach...')
      .setRequired(false)
      .setMaxLength(500);
    
    const actionRow1 = new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput);
    const actionRow2 = new ActionRowBuilder<TextInputBuilder>().addComponents(experienceInput);
    const actionRow3 = new ActionRowBuilder<TextInputBuilder>().addComponents(sportsInput);
    const actionRow4 = new ActionRowBuilder<TextInputBuilder>().addComponents(bioInput);
    
    modal.addComponents(actionRow1, actionRow2, actionRow3, actionRow4);
    
    await interaction.showModal(modal);
  }
  
  private async handleCapperGuide(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('📖 UT Capper Guide')
      .setDescription('Everything you need to know about being a successful capper on Unit Talk!')
      .setColor(0xE67E22)
      .addFields(
        {
          name: '🎯 How to Submit Picks',
          value: '• Use `/submit-pick` command\n• Include game details, pick type, and confidence\n• Add reasoning for your pick\n• Set proper units (1-5 scale)',
          inline: false
        },
        {
          name: '📊 Performance Tracking',
          value: '• All picks automatically tracked\n• Win/Loss record maintained\n• ROI calculated in real-time\n• Leaderboard rankings updated daily',
          inline: false
        },
        {
          name: '🏆 Leaderboard System',
          value: '• Ranked by ROI and win percentage\n• Monthly and all-time rankings\n• Special badges for top performers\n• Bonus rewards for consistency',
          inline: false
        },
        {
          name: '📋 Community Guidelines',
          value: '• Be respectful and professional\n• Provide reasoning for picks\n• No spam or excessive posting\n• Help other cappers improve',
          inline: false
        },
        {
          name: '🔗 Quick Links',
          value: '• <#1291911913361375372> - Submit picks here\n• `/capper-stats` - View your performance\n• `/leaderboard` - See rankings\n• Contact <@griff843> for help',
          inline: false
        }
      )
      .setFooter({ text: 'Good luck with your picks! 🍀' })
      .setTimestamp();
    
    const actionRow = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('capper_practice_pick')
          .setLabel('Practice Pick')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🎯'),
        new ButtonBuilder()
          .setCustomId('view_leaderboard')
          .setLabel('View Leaderboard')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🏆'),
        new ButtonBuilder()
          .setCustomId('create_capper_thread')
          .setLabel('Create My Threads')
          .setStyle(ButtonStyle.Success)
          .setEmoji('📝'),
        new ButtonBuilder()
          .setCustomId('capper_support')
          .setLabel('Get Help')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('💬')
      );
    
    await interaction.reply({
      embeds: [embed],
      components: [actionRow],
      ephemeral: true
    });
  }

  private async handleCreateCapperThread(interaction: ButtonInteraction): Promise<void> {
    try {
      const capperChannel = interaction.guild?.channels.cache.get('1291911913361375372') as TextChannel;
      
      if (!capperChannel) {
        await interaction.reply({
          content: '❌ Could not find the Capper Corner channel. Please contact support.',
          ephemeral: true
        });
        return;
      }

      // Create Official Picks Thread
      const officialThread = await capperChannel.threads.create({
        name: `🔥 ${interaction.user.username} Official Picks`,
        autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
        reason: 'Capper official picks thread creation'
      });

      // Create Q&A Discussion Thread
      const qaThread = await capperChannel.threads.create({
        name: `💬 ${interaction.user.username} Q&A & Discussion`,
        autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
        reason: 'Capper Q&A discussion thread creation'
      });

      // Send pinned message to Official Picks thread
      const officialPinnedMessage = await officialThread.send({
        embeds: [
          new EmbedBuilder()
            .setTitle(`📌 Welcome to ${interaction.user.username}'s Official Picks!`)
            .setDescription(
              `Only ${interaction.user.username} (or the bot) will post here. No chat—just official, time-stamped plays.\n\n` +
              `For Q&A, feedback, or breakdowns, visit the ${qaThread} thread.\n\n` +
              `Picks are posted daily by 10/11am ET. Subscribe for alerts so you never miss a play!\n\n` +
              `🍀 Good luck and let's cash!`
            )
            .setColor(Colors.Green)
            .setTimestamp()
        ]
      });

      // Send pinned message to Q&A thread
      const qaPinnedMessage = await qaThread.send({
        embeds: [
          new EmbedBuilder()
            .setTitle(`📌 Welcome to ${interaction.user.username}'s Q&A & Discussion!`)
            .setDescription(
              `Use this thread for questions, reactions, analysis, and postgame breakdowns about ${interaction.user.username}'s picks.\n\n` +
              `Please keep conversations focused and respectful.\n\n` +
              `For all official picks, see the ${officialThread} thread above.\n\n` +
              `💬 Let's help each other win!`
            )
            .setColor(Colors.Blue)
            .setTimestamp()
        ]
      });

      // Pin both messages
      await officialPinnedMessage.pin();
      await qaPinnedMessage.pin();

      // Send bio template to official thread
      await officialThread.send({
        embeds: [
          new EmbedBuilder()
            .setTitle('🎯 Capper Profile Template')
            .setDescription('Please fill out your capper profile below:')
            .setColor(Colors.Orange)
            .addFields(
              { name: '📊 Experience Level', value: 'Beginner/Intermediate/Expert', inline: true },
              { name: '🏈 Sports Specialization', value: 'NFL, NBA, MLB, etc.', inline: true },
              { name: '📈 Betting Style', value: 'Conservative/Aggressive/Balanced', inline: true },
              { name: '🎯 Strengths', value: 'What types of bets do you excel at?', inline: false },
              { name: '📋 Bio/Background', value: 'Tell us about your betting journey and approach...', inline: false },
              { name: '🎲 Fun Fact', value: 'Something interesting about you!', inline: false }
            )
            .setFooter({ text: 'Edit this message with your information!' })
        ]
      });

      // Notify griff843
      try {
        const griff = await interaction.client.users.fetch('griff843');
        await griff.send({
          embeds: [
            new EmbedBuilder()
              .setTitle('🎯 New Capper Threads Created!')
              .setDescription(`**${interaction.user.username}** just created their capper threads`)
              .setColor(Colors.Green)
              .addFields(
                { name: '👤 User', value: `${interaction.user.tag} (${interaction.user.id})`, inline: true },
                { name: '🔥 Official Picks', value: `${officialThread}`, inline: false },
                { name: '💬 Q&A Discussion', value: `${qaThread}`, inline: false }
              )
              .setTimestamp()
          ]
        });
      } catch (error) {
        logger.error('Failed to notify griff843 about new capper threads:', error);
      }

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('🎉 Your Capper Threads Have Been Created!')
            .setDescription('You now have two dedicated threads in Capper Corner:')
            .setColor(Colors.Green)
            .addFields(
              { 
                name: '🔥 Official Picks Thread', 
                value: `${officialThread}\n*For your official picks only - read-only for public*`, 
                inline: false 
              },
              { 
                name: '💬 Q&A & Discussion Thread', 
                value: `${qaThread}\n*For community interaction, questions, and analysis*`, 
                inline: false 
              },
              {
                name: '📝 Next Steps',
                value: '1. Fill out your profile in the Official Picks thread\n2. Start posting your picks using `/submit-pick`\n3. Engage with the community in your Q&A thread',
                inline: false
              }
            )
            .setFooter({ text: 'Welcome to the Unit Talk capper community!' })
        ],
        ephemeral: true
      });

    } catch (error) {
      logger.error('Error creating capper threads:', error);
      await interaction.reply({
        content: '❌ There was an error creating your threads. Please contact <@griff843> for assistance.',
        ephemeral: true
      });
    }
  }

  private async handleCapperPracticePick(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('🎯 Practice Pick Tutorial')
      .setDescription('Learn how to submit your first pick!')
      .setColor(0x3498DB)
      .addFields(
        {
          name: '1️⃣ Use the Command',
          value: 'Type `/submit-pick` in <#1291911913361375372>',
          inline: false
        },
        {
          name: '2️⃣ Fill Out Details',
          value: '• **Game**: Team vs Team\n• **Pick**: Your selection\n• **Units**: 1-5 scale\n• **Reasoning**: Why you like this pick',
          inline: false
        },
        {
          name: '3️⃣ Example Pick',
          value: '```Game: Lakers vs Warriors\nPick: Lakers -3.5\nUnits: 3\nReasoning: Lakers at home, Warriors missing key players```',
          inline: false
        }
      )
      .setFooter({ text: 'Ready to make your first pick?' });

    const actionRow = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('create_capper_thread')
          .setLabel('Create My Threads First')
          .setStyle(ButtonStyle.Success)
          .setEmoji('📝'),
        new ButtonBuilder()
          .setCustomId('view_leaderboard')
          .setLabel('View Leaderboard')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🏆')
      );

    await interaction.reply({
      embeds: [embed],
      components: [actionRow],
      ephemeral: true
    });
  }

  private async handleViewLeaderboard(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('🏆 Capper Leaderboard')
      .setDescription('Top performing cappers on Unit Talk')
      .setColor(0xFFD700)
      .addFields(
        {
          name: '📊 Rankings Based On',
          value: '• ROI (Return on Investment)\n• Win Percentage\n• Total Units Won\n• Pick Volume & Consistency',
          inline: false
        },
        {
          name: '🎯 How to Climb',
          value: '• Submit quality picks daily\n• Provide detailed reasoning\n• Maintain consistency\n• Engage with community',
          inline: false
        },
        {
          name: '🏅 Rewards',
          value: '• Monthly leaderboard prizes\n• Special badges and roles\n• Featured capper spotlights\n• Bonus perks and recognition',
          inline: false
        }
      )
      .setFooter({ text: 'Use /leaderboard to see current rankings!' });

    await interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  }

  private async handleCapperSupport(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('💬 Capper Support')
      .setDescription('Need help with your capper journey?')
      .setColor(0x9B59B6)
      .addFields(
        {
          name: '🆘 Quick Help',
          value: '• **Commands**: `/submit-pick`, `/capper-stats`, `/leaderboard`\n• **Channels**: <#1291911913361375372> for picks\n• **Guidelines**: Be respectful and provide reasoning',
          inline: false
        },
        {
          name: '📞 Contact Support',
          value: 'For personalized help, contact <@griff843>\n\n*Response time: Usually within 2-4 hours*',
          inline: false
        }
      );

    const actionRow = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('capper_guide')
          .setLabel('View Full Guide')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('📖'),
        new ButtonBuilder()
          .setCustomId('create_capper_thread')
          .setLabel('Create My Threads')
          .setStyle(ButtonStyle.Success)
          .setEmoji('📝')
      );

    await interaction.reply({
      embeds: [embed],
      components: [actionRow],
      ephemeral: true
    });
  }

  /**
   * VIP HANDLERS
   */

  private async handleVipGuide(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('⭐ VIP Member Guide')
      .setDescription('Welcome to your VIP experience!')
      .setColor(0xFFD700)
      .addFields(
        {
          name: '🎯 VIP Features',
          value: '• Access to <#1288610443723538584>\n• Premium pick alerts\n• Advanced analytics\n• Priority support\n• Exclusive content',
          inline: false
        },
        {
          name: '📊 VIP Insights',
          value: '• Daily market analysis in <#1288611956575703120>\n• Expert breakdowns\n• Trend analysis\n• Sharp money tracking',
          inline: false
        },
        {
          name: '🔔 Notifications',
          value: '• Real-time pick alerts\n• Market movement notifications\n• Injury updates\n• Line movement alerts',
          inline: false
        }
      );

    const actionRow = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('setup_notifications')
          .setLabel('Setup Notifications')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🔔'),
        new ButtonBuilder()
          .setCustomId('start_vip_tour')
          .setLabel('Take VIP Tour')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🎯'),
        new ButtonBuilder()
          .setCustomId('upgrade_to_vip_plus')
          .setLabel('Upgrade to VIP+')
          .setStyle(ButtonStyle.Success)
          .setEmoji('⚡')
      );

    await interaction.reply({
      embeds: [embed],
      components: [actionRow],
      ephemeral: true
    });
  }

  private async handleNotificationSetup(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('🔔 Notification Setup')
      .setDescription('Configure your alert preferences')
      .setColor(0x3498DB)
      .addFields(
        {
          name: '📱 Available Alerts',
          value: '• **Pick Alerts**: New picks from top cappers\n• **Line Movement**: Significant odds changes\n• **Injury News**: Player status updates\n• **Market Analysis**: Daily insights',
          inline: false
        },
        {
          name: '⚙️ How to Setup',
          value: '1. Enable Discord notifications\n2. Join notification channels\n3. Set your preferences\n4. Test alerts',
          inline: false
        },
        {
          name: '🎯 Pro Tips',
          value: '• Enable mobile notifications\n• Set quiet hours\n• Choose your sports\n• Follow top cappers',
          inline: false
        }
      );

    const actionRow = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('notification_help')
          .setLabel('Need Help?')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('❓'),
        new ButtonBuilder()
          .setCustomId('start_vip_tour')
          .setLabel('Continue VIP Tour')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('▶️')
      );

    await interaction.reply({
      embeds: [embed],
      components: [actionRow],
      ephemeral: true
    });
  }

  private async handleStartVipTour(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('🎯 VIP Tour - Welcome!')
      .setDescription('Let me show you around your VIP features')
      .setColor(0xFFD700)
      .addFields(
        {
          name: '🏠 VIP Lounge',
          value: `<#1288610443723538584>\n*Your exclusive VIP community space*`,
          inline: false
        },
        {
          name: '📊 VIP Insights',
          value: `<#1288611956575703120>\n*Daily market analysis and expert breakdowns*`,
          inline: false
        },
        {
          name: '🎯 Capper Corner',
          value: `<#1291911913361375372>\n*Follow top cappers and their picks*`,
          inline: false
        },
        {
          name: '⚡ Want More?',
          value: 'VIP+ members get elite features like steam alerts, hedge opportunities, and personalized advice!',
          inline: false
        }
      );

    const actionRow = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('setup_notifications')
          .setLabel('Setup Alerts')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🔔'),
        new ButtonBuilder()
          .setCustomId('upgrade_to_vip_plus')
          .setLabel('Upgrade to VIP+')
          .setStyle(ButtonStyle.Success)
          .setEmoji('⚡'),
        new ButtonBuilder()
          .setCustomId('view_faq')
          .setLabel('FAQ')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('❓')
      );

    await interaction.reply({
      embeds: [embed],
      components: [actionRow],
      ephemeral: true
    });
  }

  /**
   * VIP+ HANDLERS
   */

  private async handleVipPlusGuide(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('⚡ VIP+ Elite Guide')
      .setDescription('Welcome to the ultimate betting experience!')
      .setColor(0x8A2BE2)
      .addFields(
        {
          name: '🔥 Elite Features',
          value: '• Steam Alerts - Sharp money movement\n• Injury Alerts - Real-time updates\n• Hedge Alerts - Profit protection\n• Middling Alerts - Guaranteed profits',
          inline: false
        },
        {
          name: '🤖 AI-Powered Tools',
          value: '• Custom Personal Advice\n• Personalized Bet Tracking\n• Advanced ROI Analytics\n• Proprietary Data Models',
          inline: false
        },
        {
          name: '👑 Exclusive Perks',
          value: '• VIP+ Only Giveaways\n• Priority Support\n• Early Access Features\n• Personalized Recaps',
          inline: false
        }
      );

    const actionRow = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('access_elite_features')
          .setLabel('Access Elite Features')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🔥'),
        new ButtonBuilder()
          .setCustomId('vip_plus_tour')
          .setLabel('Take VIP+ Tour')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🎯'),
        new ButtonBuilder()
          .setCustomId('setup_vip_plus_notifications')
          .setLabel('Elite Alerts')
          .setStyle(ButtonStyle.Success)
          .setEmoji('⚡')
      );

    await interaction.reply({
      embeds: [embed],
      components: [actionRow],
      ephemeral: true
    });
  }

  private async handleEliteFeatures(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('🔥 VIP+ Elite Features')
      .setDescription('Your complete arsenal of advanced betting tools')
      .setColor(0x8A2BE2)
      .addFields(
        {
          name: '💨 Steam Alerts',
          value: 'Real-time notifications when sharp money moves lines significantly',
          inline: true
        },
        {
          name: '🏥 Injury Alerts',
          value: 'Instant updates on player injuries that affect betting lines',
          inline: true
        },
        {
          name: '🛡️ Hedge Alerts',
          value: 'Opportunities to protect profits with strategic hedge bets',
          inline: true
        },
        {
          name: '🎯 Middling Alerts',
          value: 'Guaranteed profit opportunities through line movement',
          inline: true
        },
        {
          name: '🤖 Personal AI Advice',
          value: 'Custom betting guidance based on your history and preferences',
          inline: true
        },
        {
          name: '📊 Advanced Analytics',
          value: 'Proprietary data models and personalized ROI tracking',
          inline: true
        },
        {
          name: '🏆 Hot/Cold Tracking',
          value: 'Dynamic leaderboards showing current form and streaks',
          inline: true
        },
        {
          name: '🎁 Exclusive Contests',
          value: 'VIP+ only giveaways and competitions with premium prizes',
          inline: true
        },
        {
          name: '⚡ Priority Support',
          value: 'Fastest response times and dedicated VIP+ assistance',
          inline: true
        }
      );

    await interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  }

  private async handleVipPlusTour(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('🎯 VIP+ Elite Tour')
      .setDescription('Experience the pinnacle of betting intelligence')
      .setColor(0x8A2BE2)
      .addFields(
        {
          name: '🔥 Step 1: Elite Alerts',
          value: 'Setup steam, injury, hedge, and middling alerts for maximum edge',
          inline: false
        },
        {
          name: '🤖 Step 2: AI Advisor',
          value: 'Configure your personal AI betting assistant for custom advice',
          inline: false
        },
        {
          name: '📊 Step 3: Analytics Vault',
          value: 'Access proprietary data models and advanced tracking tools',
          inline: false
        },
        {
          name: '👑 Step 4: Elite Community',
          value: 'Join exclusive VIP+ channels and contests',
          inline: false
        }
      );

    const actionRow = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('setup_vip_plus_notifications')
          .setLabel('Setup Elite Alerts')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('⚡'),
        new ButtonBuilder()
          .setCustomId('access_elite_features')
          .setLabel('Access All Features')
          .setStyle(ButtonStyle.Success)
          .setEmoji('🔥')
      );

    await interaction.reply({
      embeds: [embed],
      components: [actionRow],
      ephemeral: true
    });
  }

  private async handleVipPlusNotifications(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('⚡ VIP+ Elite Alert Setup')
      .setDescription('Configure your advanced notification system')
      .setColor(0x8A2BE2)
      .addFields(
        {
          name: '💨 Steam Alerts',
          value: '✅ Sharp money movement notifications\n⚙️ Threshold: 2+ point moves\n📱 Delivery: Instant DM + Channel',
          inline: false
        },
        {
          name: '🏥 Injury Alerts',
          value: '✅ Real-time player status updates\n⚙️ Filter: Impact players only\n📱 Delivery: Instant notifications',
          inline: false
        },
        {
          name: '🛡️ Hedge Opportunities',
          value: '✅ Profit protection signals\n⚙️ Minimum: 10% guaranteed profit\n📱 Delivery: Priority alerts',
          inline: false
        },
        {
          name: '🎯 Middling Alerts',
          value: '✅ Guaranteed profit opportunities\n⚙️ Threshold: 5% minimum edge\n📱 Delivery: Immediate notification',
          inline: false
        }
      );

    await interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  }

  /**
   * TRIAL & UPGRADE HANDLERS
   */

  private async handleTrialFeatures(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('🎁 Trial Features Preview')
      .setDescription('See what you get with VIP and VIP+ memberships')
      .setColor(0x00FF00)
      .addFields(
        {
          name: '⭐ VIP Features',
          value: '• Access to VIP Lounge\n• Premium pick alerts\n• Daily market insights\n• Priority support',
          inline: true
        },
        {
          name: '⚡ VIP+ Features',
          value: '• Steam & injury alerts\n• Hedge opportunities\n• AI personal advice\n• Elite analytics',
          inline: true
        },
        {
          name: '🎯 Trial Benefits',
          value: '• 7-day free access\n• All VIP features included\n• No commitment required\n• Easy upgrade path',
          inline: false
        }
      );

    const actionRow = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('upgrade_to_vip')
          .setLabel('Upgrade to VIP')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('⭐'),
        new ButtonBuilder()
          .setCustomId('upgrade_to_vip_plus')
          .setLabel('Upgrade to VIP+')
          .setStyle(ButtonStyle.Success)
          .setEmoji('⚡'),
        new ButtonBuilder()
          .setCustomId('view_faq')
          .setLabel('FAQ')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('❓')
      );

    await interaction.reply({
      embeds: [embed],
      components: [actionRow],
      ephemeral: true
    });
  }

  private async handleUpgradeToVip(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('⭐ Upgrade to VIP')
      .setDescription('Ready to unlock premium features?')
      .setColor(0xFFD700)
      .addFields(
        {
          name: '🎯 VIP Benefits',
          value: '• Exclusive VIP Lounge access\n• Premium pick notifications\n• Daily market analysis\n• Priority support response',
          inline: false
        },
        {
          name: '💰 Pricing',
          value: '**$29.99/month** or **$299/year** (save 17%)',
          inline: false
        },
        {
          name: '📞 Ready to Upgrade?',
          value: 'Contact <@griff843> to process your VIP upgrade\n\n*Mention this message for fastest processing*',
          inline: false
        }
      );

    await interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  }

  private async handleUpgradeToVipPlus(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('⚡ Upgrade to VIP+')
      .setDescription('Unlock the ultimate betting experience!')
      .setColor(0x8A2BE2)
      .addFields(
        {
          name: '🔥 VIP+ Elite Features',
          value: '• Steam & injury alerts\n• Hedge & middling opportunities\n• AI personal betting advice\n• Advanced analytics vault\n• Exclusive contests & giveaways',
          inline: false
        },
        {
          name: '💎 Premium Value',
          value: '**$79.99/month** or **$799/year** (save 17%)\n\n*Includes all VIP features plus elite tools*',
          inline: false
        },
        {
          name: '📞 Ready for Elite Status?',
          value: 'Contact <@griff843> to upgrade to VIP+\n\n*Mention this message for priority processing*',
          inline: false
        }
      );

    await interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  }

  /**
   * BASIC & SUPPORT HANDLERS
   */

  private async handleViewFaq(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('❓ Frequently Asked Questions')
      .setDescription('Quick answers to common questions')
      .setColor(0x3498DB)
      .addFields(
        {
          name: '🎯 How do I submit picks?',
          value: 'Use `/submit-pick` command in <#1291911913361375372>',
          inline: false
        },
        {
          name: '📊 How is ROI calculated?',
          value: 'ROI = (Total Winnings - Total Wagered) / Total Wagered × 100',
          inline: false
        },
        {
          name: '🏆 How does the leaderboard work?',
          value: 'Rankings based on ROI, win %, and consistency over time',
          inline: false
        },
        {
          name: '💰 What are the membership tiers?',
          value: '• **Basic**: Free access\n• **VIP**: $29.99/month\n• **VIP+**: $79.99/month',
          inline: false
        },
        {
          name: '📞 Need more help?',
          value: 'Contact <@griff843> for personalized assistance',
          inline: false
        }
      );

    await interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  }

  private async handleStartVipTrial(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('🎁 Start Your VIP Trial')
      .setDescription('7 days of premium features, completely free!')
      .setColor(0x00FF00)
      .addFields(
        {
          name: '🎯 Trial Includes',
          value: '• Full VIP Lounge access\n• Premium pick alerts\n• Daily market insights\n• Priority support',
          inline: false
        },
        {
          name: '⏰ Trial Details',
          value: '• **Duration**: 7 days\n• **Cost**: Completely free\n• **Auto-renewal**: No\n• **Upgrade anytime**: Yes',
          inline: false
        },
        {
          name: '🚀 Start Your Trial',
          value: 'Contact <@griff843> to activate your free VIP trial\n\n*Mention "VIP Trial" for instant activation*',
          inline: false
        }
      );

    await interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  }

  private async handleStaffGuide(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('👨‍💼 Staff Guide')
      .setDescription('Welcome to the Unit Talk staff team!')
      .setColor(0x9B59B6)
      .addFields(
        {
          name: '🎯 Staff Responsibilities',
          value: '• Monitor community guidelines\n• Assist members with questions\n• Moderate discussions\n• Report issues to management',
          inline: false
        },
        {
          name: '🔧 Staff Tools',
          value: '• Moderation commands\n• Member management\n• Analytics access\n• Direct admin contact',
          inline: false
        },
        {
          name: '📞 Staff Support',
          value: 'For staff-specific questions, contact <@griff843>',
          inline: false
        }
      );

    await interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  }

  private async handleNotificationHelp(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('🔔 Notification Help')
      .setDescription('Troubleshooting your alert settings')
      .setColor(0x3498DB)
      .addFields(
        {
          name: '📱 Not Getting Alerts?',
          value: '1. Check Discord notification settings\n2. Ensure you\'re in the right channels\n3. Verify your role permissions\n4. Test with a sample alert',
          inline: false
        },
        {
          name: '🔧 Common Fixes',
          value: '• Enable mobile notifications\n• Check "Do Not Disturb" mode\n• Verify channel permissions\n• Update Discord app',
          inline: false
        },
        {
          name: '📞 Still Need Help?',
          value: 'Contact <@griff843> with your specific issue',
          inline: false
        }
      );

    await interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  }

  /**
   * UTILITY METHODS
   */

  private validateButtonAccess(customId: string, userTier: string): boolean {
    const capperButtons = ['capper_onboard_start', 'capper_guide', 'capper_practice_pick', 'view_leaderboard', 'capper_support', 'create_capper_thread'];
    const vipButtons = ['view_vip_guide', 'setup_notifications', 'start_vip_tour'];
    const vipPlusButtons = ['view_vip_plus_guide', 'access_elite_features', 'vip_plus_tour', 'setup_vip_plus_notifications'];
    const trialButtons = ['view_trial_features', 'upgrade_to_vip', 'upgrade_to_vip_plus'];
    const basicButtons = ['view_faq', 'start_vip_trial'];
    const staffButtons = ['staff_guide'];
    const secondaryButtons = ['setup_notifications_now', 'notification_help'];

    logger.info(`🔍 Validating access: customId=${customId}, userTier=${userTier}`);

    // More permissive access control - allow access based on user tier
    switch (userTier) {
      case 'owner':
      case 'admin':
      case 'staff':
        // Staff can access staff buttons plus all lower tier buttons
        const staffAccess = staffButtons.includes(customId) ||
               vipPlusButtons.includes(customId) ||
               vipButtons.includes(customId) ||
               trialButtons.includes(customId) ||
               basicButtons.includes(customId) ||
               secondaryButtons.includes(customId);
        logger.info(`🔍 Staff access check for ${customId}: ${staffAccess}`);
        return staffAccess;

      case 'vip_plus':
        // VIP+ can access VIP+, VIP, trial, basic, and secondary buttons
        const vipPlusAccess = vipPlusButtons.includes(customId) ||
               vipButtons.includes(customId) ||
               trialButtons.includes(customId) ||
               basicButtons.includes(customId) ||
               secondaryButtons.includes(customId);
        logger.info(`🔍 VIP+ access check for ${customId}: ${vipPlusAccess}`);
        return vipPlusAccess;

      case 'vip':
        // VIP can access VIP, trial, basic, and secondary buttons
        const vipAccess = vipButtons.includes(customId) ||
               trialButtons.includes(customId) ||
               basicButtons.includes(customId) ||
               secondaryButtons.includes(customId);
        logger.info(`🔍 VIP access check for ${customId}: ${vipAccess}`);
        return vipAccess;

      case 'trial':
        // Trial can access trial, basic, and secondary buttons
        const trialAccess = trialButtons.includes(customId) ||
               basicButtons.includes(customId) ||
               secondaryButtons.includes(customId);
        logger.info(`🔍 Trial access check for ${customId}: ${trialAccess}`);
        return trialAccess;

      case 'capper':
        // Cappers can access capper, basic, and secondary buttons
        const capperAccess = capperButtons.includes(customId) ||
               basicButtons.includes(customId) ||
               secondaryButtons.includes(customId);
        logger.info(`🔍 Capper access check for ${customId}: ${capperAccess}`);
        return capperAccess;

      case 'member':
      case 'basic':
      default:
        // Basic members can access basic and secondary buttons
        const basicAccess = basicButtons.includes(customId) ||
               secondaryButtons.includes(customId);
        logger.info(`🔍 Basic/Member access check for ${customId}: ${basicAccess}`);
        return basicAccess;
    }
  }

  private async handleUnknownButton(interaction: ButtonInteraction): Promise<void> {
    await interaction.reply({
      content: '❌ Unknown button interaction. Please contact support if this continues.',
      ephemeral: true
    });
  }

  private async handleButtonError(interaction: ButtonInteraction, _error: any): Promise<void> {
    try {
      await interaction.reply({
        content: '❌ An error occurred processing your request. Please try again or contact support.',
        ephemeral: true
      });
    } catch (replyError) {
      logger.error('Failed to send error reply:', replyError);
    }
  }

  /**
   * Check if a button ID is an onboarding button
   */
  static isOnboardingButton(customId: string): boolean {
    const onboardingButtons = [
      // Capper buttons
      'capper_onboard_start', 'capper_guide', 'capper_practice_pick', 'view_leaderboard', 'capper_support', 'create_capper_thread',
      // VIP buttons
      'view_vip_guide', 'setup_notifications', 'start_vip_tour',
      // VIP+ buttons
      'view_vip_plus_guide', 'access_elite_features', 'vip_plus_tour', 'setup_vip_plus_notifications',
      // Trial buttons
      'view_trial_features', 'upgrade_to_vip', 'upgrade_to_vip_plus',
      // Basic buttons
      'view_faq', 'start_vip_trial',
      // Staff buttons
      'staff_guide',
      // Secondary buttons
      'setup_notifications_now', 'notification_help'
    ];
    
    return onboardingButtons.includes(customId);
  }

  /**
   * VIP BUTTON HANDLERS
   */

  private async handleViewVipGuide(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('🌟 VIP Member Guide')
      .setDescription('Welcome to VIP! Here\'s everything you need to know about your premium features.')
      .setColor(0x3498DB)
      .addFields(
        {
          name: '🎯 VIP Features',
          value: '• Early access to picks\n• VIP exclusive channels\n• Basic analytics\n• Premium content',
          inline: false
        },
        {
          name: '📊 Getting Started',
          value: '• Check #vip-picks for exclusive content\n• Use analytics to track performance\n• Join VIP discussions',
          inline: false
        }
      );

    await interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  }

  private async handleSetupNotifications(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('🔔 Notification Settings')
      .setDescription('Configure your notification preferences to stay updated with the latest picks and alerts.')
      .setColor(0x9B59B6)
      .addFields(
        {
          name: '📱 Available Notifications',
          value: '• New pick alerts\n• Performance updates\n• VIP announcements\n• Contest notifications',
          inline: false
        },
        {
          name: '⚙️ How to Setup',
          value: 'Use Discord\'s notification settings or contact support for custom preferences.',
          inline: false
        }
      );

    await interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  }

  private async handleStartVipTour(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('🎯 VIP Tour - Welcome!')
      .setDescription('Let\'s take a tour of your VIP features and exclusive areas.')
      .setColor(0x3498DB)
      .addFields(
        {
          name: '🏠 Step 1: VIP Channels',
          value: 'Access exclusive VIP channels for premium content and discussions.',
          inline: false
        },
        {
          name: '📊 Step 2: Analytics',
          value: 'Track your betting performance with detailed analytics.',
          inline: false
        },
        {
          name: '🎯 Step 3: Early Access',
          value: 'Get picks before they\'re released to general members.',
          inline: false
        }
      );

    await interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  }

  /**
   * VIP+ BUTTON HANDLERS
   */

  private async handleViewVipPlusGuide(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('💎 VIP+ Elite Guide')
      .setDescription('Welcome to the highest tier! Access all premium features and exclusive VIP+ content.')
      .setColor(0x9932CC)
      .addFields(
        {
          name: '⭐ VIP+ Features',
          value: '• All VIP benefits\n• Advanced analytics\n• Priority support\n• Exclusive VIP+ channels\n• Early access to new features',
          inline: false
        },
        {
          name: '🚀 Elite Access',
          value: '• VIP+ exclusive picks\n• Advanced market insights\n• Direct capper access\n• Custom notifications',
          inline: false
        }
      );

    await interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  }

  private async handleAccessEliteFeatures(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('⭐ Elite Features Access')
      .setDescription('Explore your exclusive VIP+ features and advanced tools.')
      .setColor(0x9932CC)
      .addFields(
        {
          name: '🔬 Advanced Analytics',
          value: 'Deep dive into performance metrics and market analysis.',
          inline: false
        },
        {
          name: '🎯 Exclusive Content',
          value: 'Access VIP+ only picks and premium market insights.',
          inline: false
        },
        {
          name: '💬 Priority Support',
          value: 'Get priority assistance from our support team.',
          inline: false
        }
      );

    await interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  }

  private async handleVipPlusTour(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('💎 VIP+ Elite Tour')
      .setDescription('Discover all the exclusive features available to VIP+ members.')
      .setColor(0x9932CC)
      .addFields(
        {
          name: '🏆 Elite Channels',
          value: 'Access VIP+ exclusive channels with premium content.',
          inline: false
        },
        {
          name: '📈 Advanced Tools',
          value: 'Use sophisticated analytics and market analysis tools.',
          inline: false
        },
        {
          name: '🎯 Priority Access',
          value: 'Get first access to new features and exclusive content.',
          inline: false
        }
      );

    await interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  }

  private async handleSetupVipPlusNotifications(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('🔔 VIP+ Notification Setup')
      .setDescription('Configure your premium notification preferences for VIP+ exclusive content.')
      .setColor(0x9932CC)
      .addFields(
        {
          name: '⭐ VIP+ Notifications',
          value: '• Exclusive pick alerts\n• Advanced analytics updates\n• Priority announcements\n• Elite feature updates',
          inline: false
        },
        {
          name: '⚙️ Custom Settings',
          value: 'Contact support for personalized notification preferences.',
          inline: false
        }
      );

    await interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  }

  /**
   * TRIAL/UPGRADE BUTTON HANDLERS
   */

  private async handleViewTrialFeatures(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('🎯 Trial Features Guide')
      .setDescription('Explore what\'s available during your trial period and what you can unlock with upgrades.')
      .setColor(0xF39C12)
      .addFields(
        {
          name: '✅ Trial Features',
          value: '• Free daily picks\n• Community discussions\n• Basic support\n• Limited analytics',
          inline: false
        },
        {
          name: '⭐ Upgrade Benefits',
          value: '• Early access to picks\n• VIP channels\n• Advanced analytics\n• Premium content',
          inline: false
        }
      );

    await interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  }

  private async handleUpgradeToVip(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('⭐ Upgrade to VIP')
      .setDescription('Ready to unlock premium features? Here\'s how to upgrade to VIP membership.')
      .setColor(0x3498DB)
      .addFields(
        {
          name: '🌟 VIP Benefits',
          value: '• Early access to picks\n• VIP exclusive channels\n• Basic analytics\n• Premium content\n• Priority support',
          inline: false
        },
        {
          name: '💳 How to Upgrade',
          value: 'Contact our support team or visit our website to upgrade your membership.',
          inline: false
        },
        {
          name: '📞 Support',
          value: 'Need help? Contact support for assistance with upgrading.',
          inline: false
        }
      );

    await interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  }

  private async handleUpgradeToVipPlus(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('💎 Upgrade to VIP+')
      .setDescription('Experience the ultimate premium tier with VIP+ membership.')
      .setColor(0x9932CC)
      .addFields(
        {
          name: '💎 VIP+ Benefits',
          value: '• All VIP features\n• Advanced analytics\n• Priority support\n• Exclusive VIP+ channels\n• Early access to new features\n• Direct capper access',
          inline: false
        },
        {
          name: '💳 How to Upgrade',
          value: 'Contact our support team or visit our website to upgrade to VIP+.',
          inline: false
        },
        {
          name: '🏆 Elite Experience',
          value: 'Join the elite tier and get the best Unit Talk has to offer.',
          inline: false
        }
      );

    await interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  }

  /**
   * CAPPER ADDITIONAL HANDLERS
   */

  private async handleCapperPracticePick(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('🎯 Practice Pick')
      .setDescription('Practice making picks to get familiar with the system before going live.')
      .setColor(0xE67E22)
      .addFields(
        {
          name: '🏋️ Practice Mode',
          value: 'Make practice picks without affecting your stats or leaderboard position.',
          inline: false
        },
        {
          name: '📊 Learn the System',
          value: 'Get familiar with pick formatting, reasoning, and submission process.',
          inline: false
        },
        {
          name: '🎯 Ready to Go Live?',
          value: 'Once comfortable, start making real picks that count toward your record.',
          inline: false
        }
      );

    await interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  }

  private async handleViewLeaderboard(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('🏆 Capper Leaderboard')
      .setDescription('View the current leaderboard rankings and see how you stack up against other cappers.')
      .setColor(0xF1C40F)
      .addFields(
        {
          name: '📊 Rankings',
          value: 'See top performers by win rate, ROI, and total picks.',
          inline: false
        },
        {
          name: '🎯 Your Stats',
          value: 'Track your progress and see where you rank among other cappers.',
          inline: false
        },
        {
          name: '🏆 Compete',
          value: 'Climb the leaderboard by making accurate, profitable picks.',
          inline: false
        }
      );

    await interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  }

  private async handleCapperSupport(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('💬 Capper Support')
      .setDescription('Get help with capper-specific questions and technical support.')
      .setColor(0xE67E22)
      .addFields(
        {
          name: '🎯 Capper Help',
          value: 'Get assistance with pick submissions, formatting, and best practices.',
          inline: false
        },
        {
          name: '📊 Technical Support',
          value: 'Help with leaderboard issues, stats tracking, and system problems.',
          inline: false
        },
        {
          name: '📞 Contact Support',
          value: 'Reach out to our support team for personalized assistance.',
          inline: false
        }
      );

    await interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  }

  /**
   * BASIC/SECONDARY BUTTON HANDLERS
   */

  private async handleViewFaq(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('❓ Frequently Asked Questions')
      .setDescription('Find answers to common questions about Unit Talk.')
      .setColor(0x95A5A6)
      .addFields(
        {
          name: '🎯 Getting Started',
          value: 'Learn the basics of using Unit Talk and understanding picks.',
          inline: false
        },
        {
          name: '💰 Membership',
          value: 'Information about different membership tiers and benefits.',
          inline: false
        },
        {
          name: '📊 Analytics',
          value: 'How to read and understand performance metrics.',
          inline: false
        }
      );

    await interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  }

  private async handleStartVipTrial(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('🎯 Start VIP Trial')
      .setDescription('Begin your VIP trial and experience premium features.')
      .setColor(0x3498DB)
      .addFields(
        {
          name: '⭐ Trial Benefits',
          value: '• Access VIP channels\n• Early pick access\n• Basic analytics\n• Premium content',
          inline: false
        },
        {
          name: '⏰ Trial Period',
          value: 'Enjoy VIP features for the trial duration.',
          inline: false
        },
        {
          name: '💳 After Trial',
          value: 'Upgrade to continue enjoying VIP benefits.',
          inline: false
        }
      );

    await interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  }

  private async handleSetupNotificationsNow(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('🔔 Setup Notifications Now')
      .setDescription('Configure your notification preferences immediately.')
      .setColor(0x9B59B6)
      .addFields(
        {
          name: '📱 Quick Setup',
          value: 'Enable notifications for picks, updates, and important announcements.',
          inline: false
        },
        {
          name: '⚙️ Customize',
          value: 'Choose which types of notifications you want to receive.',
          inline: false
        }
      );

    await interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  }

  private async handleNotificationHelp(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('❓ Notification Help')
      .setDescription('Get help with setting up and managing your notifications.')
      .setColor(0x9B59B6)
      .addFields(
        {
          name: '🔧 Troubleshooting',
          value: 'Common issues and solutions for notification problems.',
          inline: false
        },
        {
          name: '📞 Support',
          value: 'Contact support if you need additional help with notifications.',
          inline: false
        }
      );

    await interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  }

  private async handleStaffGuide(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('👨‍💼 Staff Guide')
      .setDescription('Staff-specific information and tools.')
      .setColor(0xE74C3C)
      .addFields(
        {
          name: '🛠️ Staff Tools',
          value: 'Access to administrative functions and staff-only features.',
          inline: false
        },
        {
          name: '📋 Responsibilities',
          value: 'Guidelines and responsibilities for staff members.',
          inline: false
        }
      );

    await interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  }
}