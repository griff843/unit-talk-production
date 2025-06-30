import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  PermissionFlagsBits,
  EmbedBuilder 
} from 'discord.js';
import { FAQService, FAQItem } from '../services/faqService';
import { logger } from '../utils/logger';

// The FAQ data to initialize
const FAQ_DATA: FAQItem[] = [
  {
    "title": "What is Unit Talk?",
    "icon": "🏆",
    "description": "Unit Talk is the premier Discord for sports bettors, blending expert analysis, daily picks, and education from pro handicappers. Whether you're learning or looking for a sharp edge, you'll find elite insights and a winning community here.",
    "button_label": null,
    "button_url": null
  },
  {
    "title": "What does my subscription include?",
    "icon": "💎",
    "description": "Subscribing unlocks all VIP channels—live picks, in-depth strategies, private analytics, and daily breakdowns direct from the pros. You'll get real-time alerts, member-only contests, and access to our premium tools and support.",
    "button_label": "Upgrade to VIP",
    "button_url": "https://your-upgrade-link.com"
  },
  {
    "title": "Is there a trial period for the subscription?",
    "icon": "🕒",
    "description": "Yes! Try VIP for just $1 for your first week. Get full access to every premium channel and tool—no risk, cancel anytime.",
    "button_label": "Start $1 Trial",
    "button_url": "https://your-trial-link.com"
  },
  {
    "title": "What payment methods do you accept?",
    "icon": "💳",
    "description": "We process all payments securely via Whop.com, supporting major credit/debit cards and several digital wallets. All details are encrypted and never stored by us.",
    "button_label": null,
    "button_url": null
  },
  {
    "title": "Are there any free channels available?",
    "icon": "🔓",
    "description": "Yes! Free members get access to general chat, community picks, and educational resources. Explore, learn, and connect—upgrade only when you're ready for full VIP.",
    "button_label": "See Free Channels",
    "button_url": "https://discord.com/channels/your-server-id/free-channels"
  },
  {
    "title": "Can I cancel my subscription at any time?",
    "icon": "❌",
    "description": "Absolutely—cancel anytime, no questions asked. Go to 'Manage Subscriptions' in your account, or open a support ticket for instant help.",
    "button_label": "Manage Subscription",
    "button_url": "https://your-manage-link.com"
  },
  {
    "title": "How often are tips provided?",
    "icon": "📅",
    "description": "You'll receive daily tips during all active sports seasons, and as soon as our cappers find value. Never miss a pick—enable thread notifications!",
    "button_label": "How to Get Alerts",
    "button_url": "https://discord.com/channels/your-server-id/capper-corner"
  },
  {
    "title": "What sports do you cover?",
    "icon": "🏈",
    "description": "Unit Talk covers football, basketball, baseball, hockey, and more. Our team includes specialists for each sport, so you always get the sharpest picks where it matters most.",
    "button_label": null,
    "button_url": null
  },
  {
    "title": "What if I have questions or need support?",
    "icon": "🛠️",
    "description": "We offer 24/7 support—open a ticket anytime, and our team will help fast. For common questions, check this FAQ or DM @Staff.",
    "button_label": "Open Support Ticket",
    "button_url": "https://your-support-link.com"
  },
  {
    "title": "How do I get notified for new picks?",
    "icon": "🔔",
    "description": "Follow your favorite capper's thread in Capper Corner and enable notifications. Get every pick as it drops—never miss a win.",
    "button_label": "Go to Capper Corner",
    "button_url": "https://discord.com/channels/your-server-id/capper-corner"
  },
  {
    "title": "Is my data secure?",
    "icon": "🛡️",
    "description": "Yes. We never store your payment info, and all chats are private within Discord. For details, see our Privacy Policy.",
    "button_label": "Privacy Policy",
    "button_url": "https://your-privacy-link.com"
  },
  {
    "title": "How do you promote responsible gambling?",
    "icon": "🧠",
    "description": "We encourage responsible betting and provide resources for support. Know your limits and always play for fun. For help, visit our Responsible Gaming page.",
    "button_label": "Responsible Gaming",
    "button_url": "https://your-responsible-link.com"
  }
];

export const data = new SlashCommandBuilder()
  .setName('faq-init')
  .setDescription('Initialize all FAQ threads in the forum (Admin only)')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    // Check if user has permission
    const member = interaction.member;
    if (!member || !interaction.guild) {
      await interaction.reply({ 
        content: '❌ This command can only be used in a server.', 
        ephemeral: true 
      });
      return;
    }

    // Defer reply as this will take some time
    await interaction.deferReply({ ephemeral: true });

    const initialEmbed = new EmbedBuilder()
      .setTitle('🚀 Initializing FAQ System')
      .setDescription(`Starting bulk creation of ${FAQ_DATA.length} FAQ threads...`)
      .setColor('#1EF763')
      .setTimestamp();

    await interaction.editReply({ embeds: [initialEmbed] });

    // Initialize FAQ service and bulk create FAQs
    const faqService = new FAQService(interaction.client);
    
    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < FAQ_DATA.length; i++) {
      const faq = FAQ_DATA[i];
      
      try {
        const thread = await faqService.createOrUpdateFAQThread(faq);
        
        if (thread) {
          successCount++;
          logger.info(`FAQ initialized: ${faq.title}`);
        } else {
          errorCount++;
          errors.push(faq.title);
          logger.error(`Failed to initialize FAQ: ${faq.title}`);
        }

        // Update progress every 3 FAQs
        if ((i + 1) % 3 === 0 || i === FAQ_DATA.length - 1) {
          const progressEmbed = new EmbedBuilder()
            .setTitle('🚀 FAQ Initialization Progress')
            .setDescription(`Progress: ${i + 1}/${FAQ_DATA.length} FAQs processed`)
            .addFields(
              { name: '✅ Successful', value: successCount.toString(), inline: true },
              { name: '❌ Failed', value: errorCount.toString(), inline: true },
              { name: '📊 Progress', value: `${Math.round(((i + 1) / FAQ_DATA.length) * 100)}%`, inline: true }
            )
            .setColor('#1EF763')
            .setTimestamp();

          await interaction.editReply({ embeds: [progressEmbed] });
        }

        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        errorCount++;
        errors.push(faq.title);
        logger.error(`Error initializing FAQ "${faq.title}":`, error);
      }
    }

    // Final summary
    const summaryEmbed = new EmbedBuilder()
      .setTitle('✅ FAQ Initialization Complete')
      .setDescription('FAQ system initialization has finished.')
      .addFields(
        { name: '✅ Successfully Created/Updated', value: successCount.toString(), inline: true },
        { name: '❌ Failed', value: errorCount.toString(), inline: true },
        { name: '📊 Total Processed', value: FAQ_DATA.length.toString(), inline: true }
      )
      .setColor(errorCount === 0 ? '#00FF00' : '#FFA500')
      .setTimestamp();

    if (errors.length > 0) {
      summaryEmbed.addFields({
        name: '❌ Failed FAQs',
        value: errors.join('\n') || 'None',
        inline: false
      });
    }

    await interaction.editReply({ embeds: [summaryEmbed] });
    
    logger.info(`FAQ initialization completed by ${interaction.user.tag}: ${successCount} success, ${errorCount} errors`);

  } catch (error) {
    logger.error('Error in faq-init command:', error);
    
    const errorMessage = '❌ An error occurred during FAQ initialization. Please check the logs and try again.';
    
    if (interaction.deferred) {
      await interaction.editReply({ content: errorMessage });
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
}