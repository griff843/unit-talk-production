import axios from "axios";
import { DateTime } from "luxon";

// ---- Type definitions ----
export interface SGOFlattenedProp {
  eventID: string;
  leagueID: string;
  sportID: string;
  startsAtUTC: string;
  startsAtET: string;
  homeTeam: string;
  homeTeamID: string;
  awayTeam: string;
  awayTeamID: string;
  playerId: string | null;
  playerName: string | null;
  statType: string;
  ou: string | null;
  direction: string | null;
  marketKey: string;
  line: number | string | null;
  odds: number | string | null;
  sportsbook: string | null;
  period: string | null;
  meta: any;
}

// ---- Fetcher function ----
export async function fetchSGOEvents({
  apiKey,
  leagueID,
  startsAfter,
  startsBefore,
  includeAltLine = true,
  oddsAvailable = true,
  limit = 50,
}: {
  apiKey: string;
  leagueID: string;
  startsAfter: string;
  startsBefore: string;
  includeAltLine?: boolean;
  oddsAvailable?: boolean;
  limit?: number;
}): Promise<any[]> {
  const endpoint = "https://api.sportsgameodds.com/v2/events";
  const params = {
    apiKey,
    leagueID,
    startsAfter,
    startsBefore,
    includeAltLine,
    oddsAvailable,
    limit,
  };
  const resp = await axios.get(endpoint, { params });
  if (!resp.data?.success || !Array.isArray(resp.data?.data)) {
    throw new Error(`[SGO] Bad response: ${JSON.stringify(resp.data)}`);
  }
  return resp.data.data;
}

// ---- Flattener function ----
export function flattenSGOEvents(events: any[]): SGOFlattenedProp[] {
  const results: SGOFlattenedProp[] = [];
  for (const evt of events) {
    const {
      eventID,
      leagueID,
      sportID,
      teams,
      odds,
      startsAt,
      status,
      players,
      info,
    } = evt;

    if (!odds || typeof odds !== "object" || Object.keys(odds).length === 0) {
      // No odds to flatten
      continue;
    }

    // Format UTC and ET
    const startsAtUTC = startsAt ?? status?.startsAt;
    const startsAtET = startsAtUTC
      ? DateTime.fromISO(startsAtUTC, { zone: "utc" })
          .setZone("America/New_York")
          .toFormat("yyyy-MM-dd HH:mm z")
      : "";

    // Meta info
    const meta = {
      ...info,
      status,
      players,
      teams,
    };

    // Extract teams
    const homeTeam = teams?.home?.names?.full ?? teams?.home?.teamID ?? "";
    const awayTeam = teams?.away?.names?.full ?? teams?.away?.teamID ?? "";
    const homeTeamID = teams?.home?.teamID ?? "";
    const awayTeamID = teams?.away?.teamID ?? "";

    // Core fix: Typecast each offer so TS doesn't whine
    for (const [marketKey, offerRaw] of Object.entries(odds ?? {})) {
      const offer = offerRaw as any;

      let playerId: string | null = null;
      let playerName: string | null = null;
      const statType: string = offer.statID ?? "";

      if (offer.playerID && players?.[offer.playerID]?.name) {
        playerId = offer.playerID;
        playerName = players[offer.playerID].name;
      } else if (offer.statEntityID && players?.[offer.statEntityID]?.name) {
        playerId = offer.statEntityID;
        playerName = players[offer.statEntityID].name;
      }

      const ou: string | null =
        offer.fairOverUnder ?? offer.openFairOverUnder ?? null;
      const line: number | string | null =
        offer.line ?? offer.ou ?? offer.fairOverUnder ?? offer.openFairOverUnder ?? null;
      const odds: number | string | null =
        offer.bookOdds ?? offer.fairOdds ?? offer.openBookOdds ?? offer.openFairOdds ?? null;
      const direction: string | null = offer.sideID ?? null;

      results.push({
        eventID,
        leagueID,
        sportID,
        startsAtUTC,
        startsAtET,
        homeTeam,
        homeTeamID,
        awayTeam,
        awayTeamID,
        playerId,
        playerName,
        statType,
        ou,
        direction,
        marketKey,
        line,
        odds,
        sportsbook: null,
        period: offer.periodID ?? null,
        meta,
      });
    }
  }
  return results;
}

// ---- COMBINED: Fetch and Flatten in One ----
export async function fetchAndFlattenSGOProps(opts: Parameters<typeof fetchSGOEvents>[0]): Promise<SGOFlattenedProp[]> {
  const events = await fetchSGOEvents(opts);
  return flattenSGOEvents(events);
}
