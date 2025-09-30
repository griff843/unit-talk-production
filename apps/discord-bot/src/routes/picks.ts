import express, { Request, Response } from 'express';
import { EmbedBuilder, TextChannel } from 'discord.js';
import { logger } from '../utils/logger';
import { getPlayerHeadshotUrl } from '../utils/headshots';

const router = express.Router();

// Store Discord client reference (will be injected)
let discordClient: any = null;

export function setDiscordClient(client: any) {
  discordClient = client;
}

// Interface for pick data from BridgeWorker
interface PickPostRequest {
  capper_name: string;
  sport: string;
  bet_slip_id: string;
  selections: Array<{
    player_name?: string;
    team_name?: string;
    stat_type: string;
    line: number | string;
    selection: string;
    leg_odds?: number;
  }>;
  selection_count: number;
  total_units: number;
  notes?: string;
  source?: string;
}

// POST endpoint for posting picks to Discord
router.post('/post', async (req: Request, res: Response) => {
  try {
    logger.info('Received pick post request', {
      body: req.body,
      timestamp: new Date().toISOString()
    });

    // Validate Discord client
    if (!discordClient || !discordClient.isReady()) {
      logger.error('Discord client not available or not ready');
      return res.status(503).json({
        success: false,
        error: 'Discord client not available'
      });
    }

    const pickData: PickPostRequest = req.body;

    // Validate required fields
    if (!pickData.capper_name || !pickData.sport || !pickData.selections || !Array.isArray(pickData.selections)) {
      logger.error('Invalid pick data provided', { pickData });
      return res.status(400).json({
        success: false,
        error: 'Invalid pick data: missing required fields'
      });
    }

    // Get the alerts channel from environment
    const alertsChannelId = process.env.ALERTS_CHANNEL_ID || process.env.DISCORD_CHANNEL_ID;

    if (!alertsChannelId) {
      logger.error('No alerts channel ID configured');
      return res.status(500).json({
        success: false,
        error: 'No alerts channel configured'
      });
    }

    // Get the Discord channel
    const channel = discordClient.channels.cache.get(alertsChannelId) as TextChannel;

    if (!channel) {
      logger.error('Could not find Discord channel', { channelId: alertsChannelId });
      return res.status(500).json({
        success: false,
        error: 'Could not find Discord channel'
      });
    }

    // Create enhanced embed with headshots
    const embed = new EmbedBuilder()
      .setTitle('🎯 New Pick Submitted!')
      .setColor(0x00FF00)
      .addFields([
        { name: '🎪 Capper', value: pickData.capper_name, inline: true },
        { name: '🏈 Sport', value: pickData.sport, inline: true },
        { name: '🎫 Ticket ID', value: pickData.bet_slip_id || 'Unknown', inline: true },
      ])
      .setTimestamp()
      .setFooter({ text: 'Unit Talk Smart Form - Enhanced with Headshots!' });

    // Process selections with headshot enrichment
    let headshotUrl = null;

    if (pickData.selections && pickData.selections.length > 0) {
      const selections = pickData.selections.slice(0, 5); // Limit to first 5 selections

      for (let index = 0; index < selections.length; index++) {
        const selection = selections[index];
        const playerName = selection.player_name || selection.team_name || 'Unknown';
        const statType = selection.stat_type || 'Unknown';
        const line = selection.line || 'Unknown';
        const selectionType = selection.selection || 'Unknown';

        // Try to get player headshot URL if we have a player name and sport
        if (selection.player_name && pickData.sport && index === 0) {
          try {
            headshotUrl = await getPlayerHeadshotUrl(selection.player_name, pickData.sport);
            logger.info('Retrieved headshot URL', {
              player: selection.player_name,
              sport: pickData.sport,
              url: headshotUrl
            });
          } catch (error) {
            logger.debug('Failed to get headshot for player', {
              playerName: selection.player_name,
              sport: pickData.sport,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }

        embed.addFields([{
          name: `📊 Selection ${index + 1}`,
          value: `**${playerName}** ${statType}\n**Line:** ${line} (${selectionType})`,
          inline: false
        }]);

        // Set player headshot as thumbnail for the first selection with a valid headshot
        if (index === 0 && headshotUrl) {
          embed.setThumbnail(headshotUrl);
          logger.info('Added headshot to embed', { headshotUrl });
        }
      }

      if (pickData.selections.length > 5) {
        embed.addFields([{
          name: '📋 Additional Selections',
          value: `... and ${pickData.selections.length - 5} more selections`,
          inline: false
        }]);
      }
    }

    // Add units if available
    if (pickData.total_units) {
      embed.addFields([{
        name: '💰 Units',
        value: `${pickData.total_units} unit${pickData.total_units === 1 ? '' : 's'}`,
        inline: true
      }]);
    }

    // Add selection count
    if (pickData.selection_count) {
      embed.addFields([{
        name: '🔢 Selections',
        value: `${pickData.selection_count} pick${pickData.selection_count === 1 ? '' : 's'}`,
        inline: true
      }]);
    }

    // Add notes if available
    if (pickData.notes) {
      embed.addFields([{
        name: '📝 Notes',
        value: pickData.notes.substring(0, 1000), // Limit to 1000 chars
        inline: false
      }]);
    }

    // Send to Discord channel
    const message = await channel.send({ embeds: [embed] });

    logger.info('Successfully posted pick to Discord', {
      channelId: alertsChannelId,
      messageId: message.id,
      capperId: pickData.capper_name,
      sport: pickData.sport,
      headshotIncluded: !!headshotUrl
    });

    res.json({
      success: true,
      message: 'Pick posted to Discord successfully',
      messageId: message.id,
      channelId: alertsChannelId,
      headshotIncluded: !!headshotUrl,
      headshotUrl: headshotUrl
    });

  } catch (error) {
    logger.error('Failed to post pick to Discord', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    res.status(500).json({
      success: false,
      error: 'Failed to post pick to Discord',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Health check endpoint for the picks service
router.get('/health', async (_req: Request, res: Response) => {
  try {
    const isDiscordReady = discordClient && discordClient.isReady();
    const alertsChannelId = process.env.ALERTS_CHANNEL_ID || process.env.DISCORD_CHANNEL_ID;

    let channelAccessible = false;
    if (isDiscordReady && alertsChannelId) {
      const channel = discordClient.channels.cache.get(alertsChannelId);
      channelAccessible = !!channel;
    }

    res.json({
      status: isDiscordReady && channelAccessible ? 'healthy' : 'degraded',
      discord_ready: isDiscordReady,
      channel_accessible: channelAccessible,
      alerts_channel_id: alertsChannelId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Picks service health check failed', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    res.status(503).json({
      status: 'unhealthy',
      error: 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;