/**
 * Market Adapters — Multi-Book Normalization Layer
 * Sprint: SPRINT-MULTI-BOOK-MARKET-LAYER-020
 */

export type { NormalizedMarketOffer } from './types';
export { BOOK_PROFILES, getBookProfile } from './types';
export { normalizeOddsApiGame } from './oddsApiAdapter';
export { normalizeSgoRawProp, normalizeSgoRawProps } from './sgoAdapter';
