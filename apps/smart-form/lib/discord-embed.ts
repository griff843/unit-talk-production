/**
 * Discord Embed Builder
 *
 * Creates pixel-perfect Discord embed previews for picks.
 */

import type { DiscordEmbed, Player, GameRef, PickInput, League } from '@/types/form';
import { env } from '@/lib/env';

// Comprehensive team colors for Discord embeds (hex to decimal)
const TEAM_COLORS: Record<string, number> = {
  // NBA Teams
  LAL: 0x552583, // Lakers Purple
  BOS: 0x007A33, // Celtics Green
  GSW: 0x1D428A, // Warriors Blue
  MIA: 0x98002E, // Heat Red
  CHI: 0xCE1141, // Bulls Red
  NYK: 0x006BB6, // Knicks Blue
  BKN: 0x000000, // Nets Black
  PHI: 0x006BB6, // 76ers Blue
  TOR: 0xCE1141, // Raptors Red
  MIL: 0x00471B, // Bucks Green
  DEN: 0x0E2240, // Nuggets Navy
  PHX: 0x1D1160, // Suns Purple
  DAL: 0x00538C, // Mavericks Blue
  SAC: 0x5A2D81, // Kings Purple

  // NFL Teams
  KC: 0xE31837, // Chiefs Red
  SF: 0xAA0000, // 49ers Red
  BAL: 0x241773, // Ravens Purple
  BUF: 0x00338D, // Bills Blue
  CIN: 0xFB4F14, // Bengals Orange
  GB: 0x203731, // Packers Green
  NE: 0x002244, // Patriots Navy
  DAL_NFL: 0x041E42, // Cowboys Navy
  SEA: 0x002244, // Seahawks Navy
  DEN_NFL: 0xFB4F14, // Broncos Orange

  // MLB Teams
  NYY: 0x003087, // Yankees Navy
  LAD: 0x005A9C, // Dodgers Blue
  HOU: 0xEB6E1F, // Astros Orange
  ATL: 0xCE1141, // Braves Red
  SDP: 0x2F241D, // Padres Brown
  STL: 0xC41E3A, // Cardinals Red
  TEX: 0x003278, // Rangers Blue

  // NHL Teams
  VGK: 0xB4975A, // Golden Knights Gold
  TBL: 0x002868, // Lightning Blue
  COL: 0x6F263D, // Avalanche Burgundy
  FLA: 0x041E42, // Panthers Navy
  TOR_NHL: 0x003E7E, // Maple Leafs Blue
  BOS_NHL: 0xFFB81C, // Bruins Gold

  // Default fallback
  DEFAULT: 0x5865F2, // Discord Blurple
};

function getTeamColor(team: string): number {
  const teamKey = team.toUpperCase().replace(/\s+/g, '_').substring(0, 3);
  return TEAM_COLORS[teamKey] || TEAM_COLORS.DEFAULT;
}

function formatSide(side: string): string {
  return side.charAt(0).toUpperCase() + side.slice(1).toLowerCase();
}

function getEmojiForLeague(league: League): string {
  const emojis: Record<League, string> = {
    NBA: '🏀',
    NFL: '🏈',
    MLB: '⚾',
    NHL: '🏒',
    NCAAB: '🏀',
    NCAAF: '🏈',
    WNBA: '🏀',
  };
  return emojis[league] || '🎯';
}

/**
 * Format game matchup line
 * Format: "AWAY @ HOME • MMM DD • HH:MM PM ET"
 */
function formatMatchupLine(gameRef: GameRef | null, gameDate: string): string {
  if (!gameRef || !gameRef.id) {
    return gameDate;
  }

  const parts: string[] = [];

  // Add teams: "AWAY @ HOME"
  if (gameRef.awayTeam && gameRef.homeTeam) {
    parts.push(`${gameRef.awayTeam} @ ${gameRef.homeTeam}`);
  }

  // Add date: "Jan 25"
  if (gameRef.dateISO) {
    const date = new Date(gameRef.dateISO);
    const formatted = date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
    parts.push(formatted);
  }

  // Add time: "8:00 PM ET"
  if (gameRef.timeUTC) {
    parts.push(gameRef.timeUTC);
  }

  return parts.join(' • ');
}

/**
 * Build Discord embed from pick data
 */
export function buildDiscordEmbed(
  pick: PickInput,
  player: Player,
  gameRef: GameRef | null
): DiscordEmbed {
  const emoji = getEmojiForLeague(pick.league);
  const side = formatSide(pick.side);

  // Title: "🏀 LeBron James Points 27.5 Over"
  const title = `${emoji} ${player.name} ${pick.marketType.replace(/_/g, ' ')} ${pick.line} ${side}`;

  // Description: Enhanced matchup line "AWAY @ HOME • JAN 25 • 8:00 PM ET"
  const description = formatMatchupLine(gameRef, pick.gameDate);

  // Thumbnail: Player headshot or team logo
  const thumbnailUrl = player.headshotUrl ||
    `${env.CDN_BASE}/players/${player.id}.png` ||
    `${env.CDN_BASE}/teams/${player.team}.png`;

  // Color based on player's team
  const color = getTeamColor(player.team);

  const embed: DiscordEmbed = {
    title,
    description,
    color,
    thumbnail: {
      url: thumbnailUrl,
    },
    fields: [
      {
        name: 'Analysis',
        value: pick.stakeText,
        inline: false,
      },
    ],
    footer: {
      text: `${player.team} • ${pick.league}`,
      icon_url: `${env.CDN_BASE}/teams/logos/${player.team.toLowerCase()}.png`,
    },
    timestamp: new Date().toISOString(),
  };

  // Add confidence score if provided
  if (pick.userScore) {
    embed.fields!.push({
      name: 'Confidence',
      value: `${pick.userScore}/10 ${'⭐'.repeat(Math.min(pick.userScore, 5))}`,
      inline: true,
    });
  }

  // Add odds if provided
  if (pick.odds) {
    embed.fields!.push({
      name: 'Odds',
      value: pick.odds > 0 ? `+${pick.odds}` : `${pick.odds}`,
      inline: true,
    });
  }

  return embed;
}

/**
 * Render Discord embed as HTML for preview
 */
export function renderDiscordEmbedHTML(embed: DiscordEmbed): string {
  const colorHex = `#${embed.color.toString(16).padStart(6, '0')}`;

  return `
    <div style="
      max-width: 520px;
      background: #2f3136;
      border-left: 4px solid ${colorHex};
      border-radius: 4px;
      padding: 12px 16px 16px 12px;
      font-family: 'Whitney', 'Helvetica Neue', Helvetica, Arial, sans-serif;
    ">
      <div style="display: flex; align-items: start; gap: 12px;">
        <div style="flex: 1;">
          ${embed.title ? `
            <div style="
              font-size: 16px;
              font-weight: 600;
              color: #ffffff;
              margin-bottom: 8px;
            ">${embed.title}</div>
          ` : ''}

          ${embed.description ? `
            <div style="
              font-size: 14px;
              color: #dcddde;
              margin-bottom: 8px;
            ">${embed.description}</div>
          ` : ''}

          ${embed.fields && embed.fields.length > 0 ? `
            <div style="margin-top: 8px;">
              ${embed.fields.map(field => `
                <div style="margin-bottom: 8px;">
                  <div style="
                    font-size: 14px;
                    font-weight: 600;
                    color: #ffffff;
                    margin-bottom: 2px;
                  ">${field.name}</div>
                  <div style="
                    font-size: 14px;
                    color: #dcddde;
                    white-space: pre-wrap;
                  ">${field.value}</div>
                </div>
              `).join('')}
            </div>
          ` : ''}

          ${embed.footer ? `
            <div style="display: flex; align-items: center; gap: 8px; margin-top: 12px;">
              ${embed.footer.icon_url ? `
                <img
                  src="${embed.footer.icon_url}"
                  alt="Footer icon"
                  style="
                    width: 20px;
                    height: 20px;
                    border-radius: 50%;
                  "
                  onerror="this.style.display='none'"
                />
              ` : ''}
              <div style="
                font-size: 12px;
                color: #72767d;
              ">${embed.footer.text}</div>
            </div>
          ` : ''}

          ${embed.timestamp ? `
            <div style="
              font-size: 12px;
              color: #72767d;
              margin-top: 4px;
            ">${new Date(embed.timestamp).toLocaleString()}</div>
          ` : ''}
        </div>

        ${embed.thumbnail ? `
          <img
            src="${embed.thumbnail.url}"
            alt="Thumbnail"
            style="
              width: 80px;
              height: 80px;
              border-radius: 4px;
              object-fit: cover;
            "
            onerror="this.src='${env.CDN_BASE}/img/silhouette.png'"
          />
        ` : ''}
      </div>
    </div>
  `;
}
