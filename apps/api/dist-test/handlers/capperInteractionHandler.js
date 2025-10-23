"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleCapperInteraction = handleCapperInteraction;
const capperOnboardCommand = __importStar(require("../commands/capper-onboard"));
const submitPickCommand = __importStar(require("../commands/submit-pick"));
const logger_1 = require("../shared/logger");
// Import command handlers
async function handleCapperInteraction(interaction) {
    try {
        if (interaction.isStringSelectMenu()) {
            await handleSelectMenuInteraction(interaction);
        }
        else if (interaction.isModalSubmit()) {
            await handleModalSubmitInteraction(interaction);
        }
        else if (interaction.isButton()) {
            await handleButtonInteraction(interaction);
        }
    }
    catch (error) {
        logger_1.logger.error('Error handling capper interaction', { error });
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: '❌ An error occurred while processing your request.',
                ephemeral: true
            });
        }
    }
}
async function handleSelectMenuInteraction(interaction) {
    const customId = interaction.customId;
    switch (customId) {
        case 'pick_type_select':
            await submitPickCommand.handlePickTypeSelect(interaction);
            break;
        case 'tier_select':
            await capperOnboardCommand.handleTierSelect(interaction);
            break;
        default:
            logger_1.logger.warn('Unknown select menu interaction', { customId });
            await interaction.reply({
                content: '❌ Unknown selection menu.',
                ephemeral: true
            });
    }
}
async function handleModalSubmitInteraction(interaction) {
    const customId = interaction.customId;
    if (customId === 'single_pick_modal') {
        await submitPickCommand.handleSinglePickModal(interaction);
    }
    else if (customId === 'parlay_pick_modal') {
        await submitPickCommand.handleParlayPickModal(interaction);
    }
    else if (customId.startsWith('onboard_modal_')) {
        await capperOnboardCommand.handleOnboardModal(interaction);
    }
    else {
        logger_1.logger.warn('Unknown modal submit interaction', { customId });
        await interaction.reply({
            content: '❌ Unknown modal submission.',
            ephemeral: true
        });
    }
}
async function handleButtonInteraction(interaction) {
    const customId = interaction.customId;
    if (customId === 'confirm_pick' || customId === 'cancel_pick') {
        await submitPickCommand.handlePickConfirmation(interaction);
    }
    else {
        logger_1.logger.warn('Unknown button interaction', { customId });
        await interaction.reply({
            content: '❌ Unknown button interaction.',
            ephemeral: true
        });
    }
}
