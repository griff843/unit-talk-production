#!/usr/bin/env node

import 'dotenv/config';

/**
 * CLI script to enrich player headshots and physical attributes for all supported leagues
 *
 * Usage:
 *   npm run enrich-players                    # Enrich all leagues
 *   npm run enrich-players MLB                # Enrich only MLB players
 *   npm run enrich-players NBA                # Enrich only NBA players
 *   npm run enrich-players NFL                # Enrich only NFL players
 *   npm run enrich-players NHL                # Enrich only NHL players
 *   FORCE_UPDATE=true npm run enrich-players # Force update existing data
 *
 * Environment Variables:
 *   FORCE_UPDATE=true - Overwrite existing non-null values
 */

import {
  enrichAllPlayers,
  SupportedLeague,
  EnrichmentSummary,
} from '../agents/PlayerEnrichmentAgent';

/**
 * Display help information
 */
function showHelp() {
  console.log(`
🏆 Player Enrichment CLI Tool

DESCRIPTION:
  Enriches player data with headshots and physical attributes (height, weight, birthday)
  for all major sports leagues: MLB, NBA, NFL, NHL

USAGE:
  npm run enrich-players [LEAGUE]

ARGUMENTS:
  LEAGUE    Optional league filter (MLB, NBA, NFL, NHL)
            If not specified, all leagues will be processed

EXAMPLES:
  npm run enrich-players                    # Enrich all leagues
  npm run enrich-players MLB                # Enrich only MLB players
  npm run enrich-players NBA                # Enrich only NBA players
  npm run enrich-players NFL                # Enrich only NFL players
  npm run enrich-players NHL                # Enrich only NHL players

ENVIRONMENT VARIABLES:
  FORCE_UPDATE=true                         # Overwrite existing non-null values
  
FORCE UPDATE EXAMPLES:
  FORCE_UPDATE=true npm run enrich-players # Force update all leagues
  FORCE_UPDATE=true npm run enrich-players MLB # Force update MLB only

ENRICHED FIELDS:
  • headshot_url / photo_url - Player headshot images
  • height_cm - Player height in centimeters
  • weight_kg - Player weight in kilograms  
  • birthday - Player birth date (YYYY-MM-DD)

API SOURCES:
  • MLB: MLB Stats API (statsapi.mlb.com)
  • NBA: Ball Don't Lie API + NBA.com Stats
  • NFL: ESPN API (site.api.espn.com)
  • NHL: NHL Stats API (statsapi.web.nhl.com)
`);
}

/**
 * Format and display enrichment summary
 */
function displaySummary(summary: EnrichmentSummary, league?: SupportedLeague) {
  const title = league
    ? `${league} Player Enrichment Summary`
    : 'Multi-League Player Enrichment Summary';

  console.log(`\n${'='.repeat(60)}`);
  console.log(`🏆 ${title}`);
  console.log(`${'='.repeat(60)}`);

  // Overall stats
  console.log(`\n📊 OVERALL STATISTICS:`);
  console.log(`   Total Processed: ${summary.totalProcessed}`);
  console.log(`   Successful Updates: ${summary.successfulEnrichments}`);
  console.log(`   No Data Found: ${summary.notFound}`);
  console.log(`   Errors: ${summary.errors}`);

  if (summary.totalProcessed > 0) {
    const successRate = ((summary.successfulEnrichments / summary.totalProcessed) * 100).toFixed(1);
    console.log(`   Success Rate: ${successRate}%`);
  }

  // Field breakdown
  console.log(`\n📋 FIELD ENRICHMENT BREAKDOWN:`);
  const fields: Array<{ key: keyof typeof summary.fieldBreakdown; label: string; icon: string }> = [
    { key: 'headshot', label: 'Headshots', icon: '📸' },
    { key: 'height_cm', label: 'Height (cm)', icon: '📏' },
    { key: 'weight_kg', label: 'Weight (kg)', icon: '⚖️' },
    { key: 'birthday', label: 'Birthday', icon: '🎂' },
  ];

  fields.forEach(({ key, label, icon }) => {
    const stats = summary.fieldBreakdown[key];
    if (stats.processed > 0) {
      const successRate =
        stats.processed > 0 ? ((stats.successful / stats.processed) * 100).toFixed(1) : '0.0';
      console.log(`   ${icon} ${label}:`);
      console.log(
        `      Processed: ${stats.processed} | Successful: ${stats.successful} | Not Found: ${stats.notFound} | Errors: ${stats.errors} | Success: ${successRate}%`
      );
    }
  });

  // League breakdown (only show if processing multiple leagues)
  if (!league) {
    console.log(`\n🏟️ LEAGUE BREAKDOWN:`);
    const leagues: SupportedLeague[] = ['MLB', 'NBA', 'NFL', 'NHL'];

    leagues.forEach(leagueKey => {
      const stats = summary.leagueBreakdown[leagueKey];
      if (stats.processed > 0) {
        const successRate = ((stats.successful / stats.processed) * 100).toFixed(1);
        console.log(`   ${leagueKey}:`);
        console.log(
          `      Processed: ${stats.processed} | Successful: ${stats.successful} | Not Found: ${stats.notFound} | Errors: ${stats.errors} | Success: ${successRate}%`
        );
      }
    });
  }

  // Error details
  if (summary.errors > 0 && summary.errorDetails.length > 0) {
    console.log(`\n❌ ERROR DETAILS:`);
    summary.errorDetails.slice(0, 10).forEach((error, index) => {
      console.log(`   ${index + 1}. ${error}`);
    });

    if (summary.errorDetails.length > 10) {
      console.log(`   ... and ${summary.errorDetails.length - 10} more errors`);
    }
  }

  console.log(`\n${'='.repeat(60)}`);

  // Final status
  if (summary.errors === 0) {
    console.log(`✅ Enrichment completed successfully!`);
  } else if (summary.successfulEnrichments > 0) {
    console.log(`⚠️  Enrichment completed with some errors. Check logs for details.`);
  } else {
    console.log(`❌ Enrichment failed. Check error details above.`);
  }

  console.log(`${'='.repeat(60)}\n`);
}

/**
 * Main execution function
 */
async function main() {
  const args = process.argv.slice(2);

  // Handle help flag
  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(0);
  }

  // Parse league argument
  let league: SupportedLeague | undefined;
  if (args.length > 0) {
    const leagueArg = args[0]?.toUpperCase();
    if (leagueArg && ['MLB', 'NBA', 'NFL', 'NHL'].includes(leagueArg)) {
      league = leagueArg as SupportedLeague;
    } else {
      console.error(`❌ Error: Invalid league '${args[0]}'. Supported leagues: MLB, NBA, NFL, NHL`);
      console.log(`\nUse --help for usage information.`);
      process.exit(1);
    }
  }

  // Check environment variables
  const forceUpdate = process.env['FORCE_UPDATE'] === 'true';

  // Display startup info
  console.log(`\n🚀 Starting Player Enrichment...`);
  console.log(`   Target: ${league || 'All Leagues'}`);
  console.log(`   Force Update: ${forceUpdate ? 'Enabled' : 'Disabled'}`);
  console.log(`   Fields: Headshots, Height, Weight, Birthday`);

  const startTime = Date.now();

  try {
    // Run enrichment
    const summary = await enrichAllPlayers(league);

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    // Display results
    displaySummary(summary, league);

    console.log(`⏱️  Total execution time: ${duration} seconds\n`);

    // Exit with appropriate code
    process.exit(summary.errors > 0 ? 1 : 0);
  } catch (error) {
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.error(`\n❌ Fatal error during enrichment:`, error);
    console.log(`⏱️  Execution time before failure: ${duration} seconds\n`);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', error => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Run the script
if (require.main === module) {
  main();
}
