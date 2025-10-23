import { SlashCommandBuilder, CommandInteraction, ModalSubmitInteraction, StringSelectMenuInteraction } from 'discord.js';
export declare const data: SlashCommandBuilder;
export declare function execute(interaction: CommandInteraction): Promise<void>;
export declare function handleTierSelect(interaction: StringSelectMenuInteraction): Promise<void>;
export declare function handleOnboardModal(interaction: ModalSubmitInteraction): Promise<void>;
//# sourceMappingURL=capper-onboard.d.ts.map