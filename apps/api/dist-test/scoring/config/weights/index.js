"use strict";
/**
 * Centralized weights configuration system
 * Maps sports to their specific scoring configurations
 * Eliminates magic numbers and provides type safety
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NHL_CONFIG = exports.NFL_CONFIG = exports.MLB_CONFIG = exports.NBA_CONFIG = void 0;
exports.getScoringConfig = getScoringConfig;
exports.getSportWeights = getSportWeights;
exports.getAllSportConfigs = getAllSportConfigs;
exports.getSupportedSports = getSupportedSports;
exports.loadCustomWeights = loadCustomWeights;
exports.initializeWeights = initializeWeights;
exports.getFeatureWeight = getFeatureWeight;
exports.validateAllConfigurations = validateAllConfigurations;
const types_1 = require("./types");
const nba_1 = require("./nba");
Object.defineProperty(exports, "NBA_CONFIG", { enumerable: true, get: function () { return nba_1.NBA_CONFIG; } });
const mlb_1 = require("./mlb");
Object.defineProperty(exports, "MLB_CONFIG", { enumerable: true, get: function () { return mlb_1.MLB_CONFIG; } });
const nfl_1 = require("./nfl");
Object.defineProperty(exports, "NFL_CONFIG", { enumerable: true, get: function () { return nfl_1.NFL_CONFIG; } });
const nhl_1 = require("./nhl");
Object.defineProperty(exports, "NHL_CONFIG", { enumerable: true, get: function () { return nhl_1.NHL_CONFIG; } });
const fs = __importStar(require("fs"));
// Sport configuration registry
const SPORT_CONFIGS = {
    'NBA': nba_1.NBA_CONFIG,
    'MLB': mlb_1.MLB_CONFIG,
    'NFL': nfl_1.NFL_CONFIG,
    'NHL': nhl_1.NHL_CONFIG,
    // Additional sports can be added here
    'NCAAF': nfl_1.NFL_CONFIG, // Use NFL config as base for college football
    'NCAAB': nba_1.NBA_CONFIG, // Use NBA config as base for college basketball
    'WNBA': nba_1.NBA_CONFIG, // Use NBA config for WNBA
};
// Default configuration for unknown sports
const DEFAULT_CONFIG = nba_1.NBA_CONFIG; // Use NBA as default
/**
 * Get scoring configuration for a specific sport
 */
function getScoringConfig(sport) {
    const normalizedSport = sport.toUpperCase();
    const config = SPORT_CONFIGS[normalizedSport];
    if (!config) {
        console.warn(`⚠️ No specific config for sport: ${sport}, using default (NBA)`);
        return DEFAULT_CONFIG;
    }
    // Validate weights sum to 1.0 (with tolerance)
    if (!(0, types_1.validateWeights)(config.weights)) {
        console.error(`❌ Invalid weights for sport: ${sport}, weights don't sum to 1.0`);
        // Return default but log the error
        return DEFAULT_CONFIG;
    }
    return config;
}
/**
 * Get weights for a specific sport
 */
function getSportWeights(sport) {
    return getScoringConfig(sport).weights;
}
/**
 * Get all available sport configurations
 */
function getAllSportConfigs() {
    return { ...SPORT_CONFIGS };
}
/**
 * Get list of supported sports
 */
function getSupportedSports() {
    return Object.keys(SPORT_CONFIGS);
}
/**
 * Load custom weights from JSON file if SCORING_WEIGHTS_PATH is set
 */
function loadCustomWeights() {
    const customPath = process.env.SCORING_WEIGHTS_PATH;
    if (!customPath) {
        return null;
    }
    try {
        if (!fs.existsSync(customPath)) {
            console.warn(`⚠️ Custom weights file not found: ${customPath}`);
            return null;
        }
        const customWeights = JSON.parse(fs.readFileSync(customPath, 'utf8'));
        console.log(`✅ Loaded custom weights from: ${customPath}`);
        // Validate custom weights
        for (const [sport, config] of Object.entries(customWeights)) {
            if (!(0, types_1.validateWeights)(config.weights)) {
                console.error(`❌ Invalid custom weights for sport: ${sport}`);
                delete customWeights[sport];
            }
        }
        return customWeights;
    }
    catch (error) {
        console.error(`❌ Failed to load custom weights: ${error}`);
        return null;
    }
}
/**
 * Initialize weights system with optional custom overrides
 */
function initializeWeights() {
    const customWeights = loadCustomWeights();
    if (customWeights) {
        // Merge custom weights with defaults
        return { ...SPORT_CONFIGS, ...customWeights };
    }
    return SPORT_CONFIGS;
}
/**
 * Get feature weight by name for a specific sport
 * Returns 0 if feature not found (with warning)
 */
function getFeatureWeight(sport, featureName) {
    const config = getScoringConfig(sport);
    const weights = config.weights;
    if (!(featureName in weights)) {
        console.warn(`⚠️ Feature '${featureName}' not found in ${sport} weights, defaulting to 0`);
        return 0;
    }
    return weights[featureName];
}
/**
 * Validate all sport configurations at startup
 */
function validateAllConfigurations() {
    let allValid = true;
    for (const [sport, config] of Object.entries(SPORT_CONFIGS)) {
        if (!(0, types_1.validateWeights)(config.weights)) {
            console.error(`❌ Invalid configuration for ${sport}`);
            allValid = false;
        }
        else {
            console.log(`✅ Valid configuration for ${sport}`);
        }
    }
    return allValid;
}
__exportStar(require("./types"), exports);
// Validate configurations on module load
if (process.env.NODE_ENV !== 'test') {
    validateAllConfigurations();
}
