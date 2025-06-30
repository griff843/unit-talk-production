import { fetchSGOEvents, flattenSGOEvents } from "../logic/providers/sgoFetcher";
import dotenv from "dotenv";
dotenv.config();

async function run() {
  console.log("=== SGO HARNESS RUN STARTED ===");

  // Fetch raw SGO event data
  const events = await fetchSGOEvents({
    apiKey: process.env['SPORTS_GAME_ODDS_API_KEY']!,
    leagueID: "MLB", // or "NBA", etc.
    startsAfter: new Date().toISOString(),
    startsBefore: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    includeAltLine: true,
    oddsAvailable: true,
    limit: 50,
  });

  if (!events.length) {
    console.log("No events found for given window.");
    return;
  }
  console.log(`[SGO] Fetch Success: ${events.length} events`);

  // Flatten all props from all events
  const props = flattenSGOEvents(events);
  if (!props.length) {
    console.log("No props found for given window. (Check above logs for event/odds issues)");
    return;
  }

  console.log(`Fetched ${props.length} props:`);
  // Show a sample:
  console.dir(props.slice(0, 3), { depth: null });
}

run().catch((err) => {
  console.error("[SGO HARNESS ERROR]", err);
});
