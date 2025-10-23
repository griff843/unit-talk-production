"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchSGOEvents = fetchSGOEvents;
exports.flattenSGOEvents = flattenSGOEvents;
exports.fetchAndFlattenSGOProps = fetchAndFlattenSGOProps;
exports.fetchSGOEventsWithPagination = fetchSGOEventsWithPagination;
exports.fetchSGOPlayerProps = fetchSGOPlayerProps;
exports.fetchSGOHistoricData = fetchSGOHistoricData;
exports.fetchSGOEventByID = fetchSGOEventByID;
exports.fetchSGOUpcomingGames = fetchSGOUpcomingGames;
const axios_1 = __importDefault(require("axios"));
const luxon_1 = require("luxon");
// ---- Enhanced Fetcher function ----
async function fetchSGOEvents({ apiKey, leagueID, startsAfter, startsBefore, includeAltLine = true, oddsAvailable, limit = 50, oddIDs, eventID, finalized, oddsPresent, }) {
    const endpoint = "https://api.sportsgameodds.com/v2/events";
    // Build params object dynamically, only including defined values
    const params = { apiKey };
    if (leagueID)
        params.leagueID = leagueID;
    if (startsAfter)
        params.startsAfter = startsAfter;
    if (startsBefore)
        params.startsBefore = startsBefore;
    if (includeAltLine !== undefined)
        params.includeAltLine = includeAltLine;
    if (limit)
        params.limit = limit;
    if (finalized !== undefined)
        params.finalized = finalized;
    if (eventID)
        params.eventID = eventID;
    // Handle odds parameters - SGO API doesn't allow finalized=true with oddsAvailable=true
    if (finalized === true) {
        // For finalized historical data, don't set oddsAvailable
        // The finalized events already contain odds data in the response
        console.log('   🔍 Using finalized=true for historical data (oddsAvailable disabled)');
    }
    else {
        // Only set oddsAvailable if not using finalized
        if (oddsAvailable !== undefined)
            params.oddsAvailable = oddsAvailable;
        else
            params.oddsAvailable = true; // Default for non-finalized queries
    }
    if (oddsPresent !== undefined)
        params.oddsPresent = oddsPresent;
    // Handle oddIDs parameter (can be string or array)
    if (oddIDs) {
        if (Array.isArray(oddIDs)) {
            params.oddIDs = oddIDs.join(',');
        }
        else {
            params.oddID = oddIDs; // Single oddID uses oddID parameter
        }
    }
    const resp = await axios_1.default.get(endpoint, { params });
    if (!resp.data?.success || !Array.isArray(resp.data?.data)) {
        throw new Error(`[SGO] Bad response: ${JSON.stringify(resp.data)}`);
    }
    return resp.data.data;
}
// ---- Flattener function ----
function flattenSGOEvents(events) {
    const results = [];
    for (const evt of events) {
        const { eventID, leagueID, sportID, teams, odds, startsAt, status, players, info, } = evt;
        if (!odds || typeof odds !== "object" || Object.keys(odds).length === 0) {
            // No odds to flatten
            continue;
        }
        // Format UTC and ET
        const startsAtUTC = startsAt ?? status?.startsAt;
        const startsAtET = startsAtUTC
            ? luxon_1.DateTime.fromISO(startsAtUTC, { zone: "utc" })
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
            const offer = offerRaw;
            let playerId = null;
            let playerName = null;
            const statType = offer.statID ?? "";
            if (offer.playerID && players?.[offer.playerID]?.name) {
                playerId = offer.playerID;
                playerName = players[offer.playerID].name;
            }
            else if (offer.statEntityID && players?.[offer.statEntityID]?.name) {
                playerId = offer.statEntityID;
                playerName = players[offer.statEntityID].name;
            }
            const ou = offer.fairOverUnder ?? offer.openFairOverUnder ?? null;
            const line = offer.line ?? offer.ou ?? offer.fairOverUnder ?? offer.openFairOverUnder ?? null;
            const odds = offer.bookOdds ?? offer.fairOdds ?? offer.openBookOdds ?? offer.openFairOdds ?? null;
            const direction = offer.sideID ?? null;
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
async function fetchAndFlattenSGOProps(opts) {
    const events = await fetchSGOEvents(opts);
    return flattenSGOEvents(events);
}
// ---- PAGINATED FETCH FOR HISTORICAL DATA ----
async function fetchSGOEventsWithPagination({ apiKey, leagueID, startsAfter, startsBefore, finalized = true, includeAltLine = true, maxPages = 20, // Prevent infinite loops
 }) {
    const allEvents = [];
    let page = 1;
    let hasMoreData = true;
    console.log(`   🔄 Starting paginated fetch for ${leagueID} from ${startsAfter} to ${startsBefore}`);
    while (hasMoreData && page <= maxPages) {
        try {
            console.log(`      📄 Fetching page ${page}/${maxPages}...`);
            const events = await fetchSGOEvents({
                apiKey,
                leagueID,
                startsAfter,
                startsBefore,
                finalized,
                includeAltLine,
                limit: 50, // SGO maximum
            });
            if (!events || events.length === 0) {
                console.log(`      ✅ No more data on page ${page}, stopping pagination`);
                hasMoreData = false;
            }
            else {
                allEvents.push(...events);
                console.log(`      ✅ Page ${page}: Found ${events.length} events (Total: ${allEvents.length})`);
                // If we got less than the limit, we've reached the end
                if (events.length < 50) {
                    console.log(`      🏁 Reached end of data (got ${events.length} < 50)`);
                    hasMoreData = false;
                }
                else {
                    page++;
                    // Rate limiting between pages
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        }
        catch (error) {
            console.error(`      ❌ Error on page ${page}:`, error.message);
            hasMoreData = false;
        }
    }
    console.log(`   ✅ Pagination complete: ${allEvents.length} total events across ${page - 1} pages`);
    return allEvents;
}
// ---- Helper Functions for Enhanced SGO Queries ----
/**
 * Fetch specific player props for a given player
 * Example: fetchSGOPlayerProps(apiKey, "NBA", "JALEN_DUREN_1_NBA", ["points", "rebounds"])
 */
async function fetchSGOPlayerProps({ apiKey, leagueID, playerID, propTypes, startsAfter, startsBefore, finalized = false, }) {
    // Build oddIDs for both over/under for each prop type
    const oddIDs = [];
    propTypes.forEach(propType => {
        oddIDs.push(`${propType}-${playerID}-game-ou-over`);
        oddIDs.push(`${propType}-${playerID}-game-ou-under`);
    });
    const events = await fetchSGOEvents({
        apiKey,
        leagueID,
        oddIDs,
        startsAfter,
        startsBefore,
        finalized,
        oddsAvailable: true,
    });
    return flattenSGOEvents(events);
}
/**
 * Fetch historic league data for backtesting
 * Example: fetchSGOHistoricData(apiKey, "NBA", "2024-03-28T07:00:00Z", "2024-09-30T06:59:59Z")
 */
async function fetchSGOHistoricData({ apiKey, leagueID, startsAfter, startsBefore, includeAltLine = true, limit = 100, }) {
    const events = await fetchSGOEvents({
        apiKey,
        leagueID,
        startsAfter,
        startsBefore,
        includeAltLine,
        finalized: true,
        limit,
    });
    return flattenSGOEvents(events);
}
/**
 * Fetch specific event by ID
 * Example: fetchSGOEventByID(apiKey, "EPL", "THE_EVENT_ID")
 */
async function fetchSGOEventByID({ apiKey, leagueID, eventID, }) {
    const events = await fetchSGOEvents({
        apiKey,
        leagueID,
        eventID,
    });
    return flattenSGOEvents(events);
}
/**
 * Fetch upcoming games for a league starting after a specific time
 * Example: fetchSGOUpcomingGames(apiKey, "NCAAB", "2025-02-27T18:00:00Z")
 */
async function fetchSGOUpcomingGames({ apiKey, leagueID, startsAfter, limit = 100, }) {
    const events = await fetchSGOEvents({
        apiKey,
        leagueID,
        startsAfter,
        limit,
        oddsPresent: true,
    });
    return flattenSGOEvents(events);
}
