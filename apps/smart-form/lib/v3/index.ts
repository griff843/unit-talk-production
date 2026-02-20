/**
 * V3 Module Exports
 * SPRINT-SMARTFORM-UX-REBUILD-080
 */

// Types
export * from './types';

// Catalog Client
export {
  fetchSports,
  fetchEvents,
  searchEvents,
  fetchMarketGroups,
  fetchMarketTypes,
  fetchMarketTypesByGroup,
  fetchSegmentTypes,
  fetchParticipants,
  searchParticipants,
  fetchOffers,
  fetchBestOffer,
  fetchProviders,
  formatEventDisplay,
  formatScheduledAt,
  formatOdds,
  clearCache,
  clearCachePrefix,
} from './catalogClient';

// Submit Ticket
export {
  submitTicketV3,
  generateBetSlipId,
  buildLegPayload,
  validateLeg,
  validateLegs,
  formatErrorDetails,
  getLegErrors,
  TEST_USER_ID,
} from './submitTicket';
