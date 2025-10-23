import { SlashCommandBuilder, CommandInteraction, ModalSubmitInteraction, StringSelectMenuInteraction, ButtonInteraction } from 'discord.js';
export declare const data: SlashCommandBuilder;
export declare function execute(interaction: CommandInteraction): Promise<void>;
export declare function handlePickTypeSelect(interaction: StringSelectMenuInteraction): Promise<void>;
export declare function handleSinglePickModal(interaction: ModalSubmitInteraction): Promise<void>;
export declare function handleParlayPickModal(interaction: ModalSubmitInteraction): Promise<void>;
export declare function handlePickConfirmation(interaction: ButtonInteraction): Promise<void>;
//# sourceMappingURL=submit-pick.d.ts.map