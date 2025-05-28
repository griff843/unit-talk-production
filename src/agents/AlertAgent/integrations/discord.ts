import { AlertPayload } from '../../../types/alert'
import { WebhookClient, EmbedBuilder } from 'discord.js'

const webhookUrl = process.env.DISCORD_ALERT_WEBHOOK || ''

export async function sendDiscordAlert(alert: AlertPayload, advice: string) {
  if (!webhookUrl) throw new Error('No Discord webhook configured')
  const webhook = new WebhookClient({ url: webhookUrl })

  const embed = new EmbedBuilder()
    .setTitle(`🚨 ${alert.title}`)
    .setDescription(alert.description)
    .addFields(
      { name: 'Unit Talk Advice', value: advice }
    )
    .setFooter({ text: `Type: ${alert.type} | Source: ${alert.source}` })
    .setTimestamp(alert.createdAt)
    .setColor(alert.severity === 'critical' ? 0xff0000 : alert.severity === 'warning' ? 0xffa500 : 0x00bfff)

  await webhook.send({ embeds: [embed] })
  return { status: 'sent' }
}
