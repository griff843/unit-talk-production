import { NotificationPayload } from '../types';

interface SlackConfig {
  webhookUrl: string;
  enabled: boolean;
  defaultChannel?: string;
}

export async function sendSlackNotification(
  payload: NotificationPayload,
  config: SlackConfig
): Promise<void> {
  if (!config.enabled) {
    throw new Error('Slack notifications are not enabled');
  }

  if (!config.webhookUrl) {
    throw new Error('Slack webhook URL is required');
  }

  const message = formatSlackMessage(payload);

  try {
    const response = await fetch(config.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(message)
    });

    if (!response.ok) {
      throw new Error(`Slack API error: ${response.statusText}`);
    }
  } catch (error) {
    throw new Error(`Failed to send Slack notification: ${(error as Error).message}`);
  }
}

function formatSlackMessage(payload: NotificationPayload): any {
  const blocks = [];

  // Header
  if (payload.title) {
    blocks.push({
      type: 'header',
      text: {
        type: 'plain_text',
        text: payload.title
      }
    });
  }

  // Main message
  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: payload.message
    }
  });

  // Add metadata if present
  if (payload.meta) {
    const metaFields = Object.entries(payload.meta)
      .map(([key, value]) => `*${key}:* ${value}`)
      .join('\n');

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: metaFields
      }
    });
  }

  // Add divider
  blocks.push({
    type: 'divider'
  });

  // Add footer
  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: `Sent by Unit Talk Platform | Type: ${payload.type} | Priority: ${payload.priority || 'normal'}`
      }
    ]
  });

  return {
    blocks,
    text: payload.message // Fallback text
  };
} 