import type { CatalogTeam } from '@/lib/api-client';
import type { V3Participant } from '@/lib/v3';

function normalizeName(value?: string | null) {
  return value?.trim().toLowerCase() || '';
}

function getMetaString(meta: Record<string, unknown> | null | undefined, key: string) {
  const value = meta?.[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function resolveTeamLogoUrl(
  teams: CatalogTeam[],
  options: {
    teamId?: string | null;
    teamName?: string | null;
  }
) {
  const byId = options.teamId
    ? teams.find(team => team.team_uuid === options.teamId || team.id === options.teamId)
    : null;

  if (byId?.logo_url) {
    return byId.logo_url;
  }

  const normalizedTeamName = normalizeName(options.teamName);
  if (!normalizedTeamName) {
    return null;
  }

  return (
    teams.find(team => normalizeName(team.name) === normalizedTeamName)?.logo_url ||
    teams.find(team => normalizedTeamName.includes(normalizeName(team.name)))?.logo_url ||
    null
  );
}

export function getParticipantImageUrl(participant: V3Participant) {
  const meta = participant.participant_meta;

  if (participant.participant_type === 'player') {
    return (
      getMetaString(meta, 'headshot_url') ||
      getMetaString(meta, 'image_url') ||
      getMetaString(meta, 'photo_url')
    );
  }

  return getMetaString(meta, 'logo_url') || getMetaString(meta, 'image_url');
}

export function getParticipantTeamLogoUrl(participant: V3Participant, teams: CatalogTeam[]) {
  if (participant.participant_type === 'team') {
    return getParticipantImageUrl(participant);
  }

  return resolveTeamLogoUrl(teams, {
    teamId: participant.team_id,
    teamName: participant.team_name,
  });
}
