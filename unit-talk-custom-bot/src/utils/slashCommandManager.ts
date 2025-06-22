import { Client, REST, Routes, SlashCommandBuilder, ApplicationCommandData } from 'discord.js';
import { readdirSync, statSync } from 'fs';
import { join } from 'path';
import { logger } from '../utils/logger';
import { botConfig } from '../config';

export interface CommandDefinition {
  name: string;
  description: string;
  options?: any[];
  defaultMemberPermissions?: string;
  dmPermission?: boolean;
  nsfw?: boolean;
}

export interface CommandRegistrationResult {
  success: boolean;
  registered: string[];
  failed: string[];
  unchanged: string[];
  errors: Array<{ command: string; error: string }>;
}

export class SlashCommandManager {
  private client: Client;
  private rest: REST;
  private commandsPath: string;

  constructor(client: Client) {
    this.client = client;
    this.rest = new REST({ version: '10' }).setToken(botConfig.discord!.token);
    this.commandsPath = join(__dirname, '../commands');
  }

  /**
   * Auto-discover and register all slash commands
   */
  public async autoRegisterCommands(): Promise<CommandRegistrationResult> {
    const result: CommandRegistrationResult = {
      success: true,
      registered: [],
      failed: [],
      unchanged: [],
      errors: []
    };

    try {
      logger.info('Starting automatic slash command registration...');

      // Discover commands from filesystem
      const discoveredCommands = await this.discoverCommands();
      logger.info(`Discovered ${discoveredCommands.length} commands`);

      // Get currently registered commands from Discord
      const currentCommands = await this.getCurrentCommands();
      logger.info(`Found ${currentCommands.length} currently registered commands`);

      // Compare and determine what needs to be updated
      const { toRegister, toUpdate, toDelete } = this.compareCommands(discoveredCommands, currentCommands);

      // Register new commands
      for (const command of toRegister) {
        try {
          await this.registerSingleCommand(command);
          result.registered.push(command.name);
          logger.info(`Registered new command: ${command.name}`);
        } catch (error) {
          result.failed.push(command.name);
          result.errors.push({
            command: command.name,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          logger.error(`Failed to register command ${command.name}:`, error);
        }
      }

      // Update existing commands
      for (const command of toUpdate) {
        try {
          await this.updateSingleCommand(command);
          result.registered.push(command.name);
          logger.info(`Updated command: ${command.name}`);
        } catch (error) {
          result.failed.push(command.name);
          result.errors.push({
            command: command.name,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          logger.error(`Failed to update command ${command.name}:`, error);
        }
      }

      // Delete removed commands
      for (const commandId of toDelete) {
        try {
          await this.deleteSingleCommand(commandId);
          logger.info(`Deleted command with ID: ${commandId}`);
        } catch (error) {
          logger.error(`Failed to delete command ${commandId}:`, error);
        }
      }

      // Commands that didn't change
      result.unchanged = currentCommands
        .filter(cmd => !toUpdate.some(u => u.name === cmd.name) && !toDelete.includes((cmd as any).id))
        .map(cmd => cmd.name);

      result.success = result.errors.length === 0;

      logger.info(`Command registration complete. Registered: ${result.registered.length}, Failed: ${result.failed.length}, Unchanged: ${result.unchanged.length}`);

      return result;

    } catch (error) {
      logger.error('Failed to auto-register commands:', error);
      result.success = false;
      result.errors.push({
        command: 'global',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return result;
    }
  }

  /**
   * Discover commands from the filesystem
   */
  private async discoverCommands(): Promise<CommandDefinition[]> {
    const commands: CommandDefinition[] = [];

    try {
      const commandFiles = this.getCommandFiles(this.commandsPath);

      for (const filePath of commandFiles) {
        try {
          // Dynamic import of command file
          const commandModule = await import(filePath);
          
          // Look for command definition in various export formats
          const commandDef = this.extractCommandDefinition(commandModule);
          
          if (commandDef) {
            commands.push(commandDef);
            logger.debug(`Discovered command: ${commandDef.name} from ${filePath}`);
          } else {
            logger.warn(`No valid command definition found in ${filePath}`);
          }

        } catch (error) {
          logger.error(`Failed to load command from ${filePath}:`, error);
        }
      }

    } catch (error) {
      logger.error('Failed to discover commands:', error);
    }

    return commands;
  }

  /**
   * Get all command files recursively
   */
  private getCommandFiles(dir: string): string[] {
    const files: string[] = [];

    try {
      const items = readdirSync(dir);

      for (const item of items) {
        const fullPath = join(dir, item);
        const stat = statSync(fullPath);

        if (stat.isDirectory()) {
          files.push(...this.getCommandFiles(fullPath));
        } else if (item.endsWith('.ts') || item.endsWith('.js')) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      logger.error(`Failed to read directory ${dir}:`, error);
    }

    return files;
  }

  /**
   * Extract command definition from module exports
   */
  private extractCommandDefinition(module: any): CommandDefinition | null {
    // Try different export patterns
    const candidates = [
      module.default,
      module.command,
      module.data,
      module
    ];

    for (const candidate of candidates) {
      if (this.isValidCommandDefinition(candidate)) {
        return candidate;
      }

      // Check if it's a SlashCommandBuilder
      if (candidate instanceof SlashCommandBuilder) {
        return candidate.toJSON() as CommandDefinition;
      }

      // Check if it has a data property (common pattern)
      if (candidate?.data && this.isValidCommandDefinition(candidate.data)) {
        return candidate.data;
      }
    }

    return null;
  }

  /**
   * Validate command definition structure
   */
  private isValidCommandDefinition(obj: any): obj is CommandDefinition {
    return obj &&
           typeof obj.name === 'string' &&
           typeof obj.description === 'string' &&
           obj.name.length >= 1 &&
           obj.name.length <= 32 &&
           obj.description.length >= 1 &&
           obj.description.length <= 100;
  }

  /**
   * Get currently registered commands from Discord
   */
  private async getCurrentCommands(): Promise<ApplicationCommandData[]> {
    try {
      const commands = await this.rest.get(
        Routes.applicationCommands(this.client.user!.id)
      ) as ApplicationCommandData[];

      return commands;
    } catch (error) {
      logger.error('Failed to get current commands:', error);
      return [];
    }
  }

  /**
   * Compare discovered commands with current commands
   */
  private compareCommands(
    discovered: CommandDefinition[],
    current: ApplicationCommandData[]
  ): {
    toRegister: CommandDefinition[];
    toUpdate: CommandDefinition[];
    toDelete: string[];
  } {
    const toRegister: CommandDefinition[] = [];
    const toUpdate: CommandDefinition[] = [];
    const toDelete: string[] = [];

    // Find commands to register or update
    for (const discoveredCmd of discovered) {
      const existingCmd = current.find(c => c.name === discoveredCmd.name);

      if (!existingCmd) {
        toRegister.push(discoveredCmd);
      } else if (this.commandsAreDifferent(discoveredCmd, existingCmd)) {
        toUpdate.push(discoveredCmd);
      }
    }

    // Find commands to delete (exist in Discord but not in filesystem)
    for (const currentCmd of current) {
      const discoveredCmd = discovered.find(d => d.name === currentCmd.name);
      if (!discoveredCmd) {
        toDelete.push((currentCmd as any).id);
      }
    }

    return { toRegister, toUpdate, toDelete };
  }

  /**
   * Check if two commands are different
   */
  private commandsAreDifferent(discovered: CommandDefinition, current: ApplicationCommandData): boolean {
    // Compare basic properties
    if (discovered.name !== current.name ||
        discovered.defaultMemberPermissions !== current.defaultMemberPermissions ||
        discovered.dmPermission !== current.dmPermission) {
      return true;
    }

    // Only compare description for slash commands (not user/message commands)
    if ('description' in current && discovered.description !== current.description) {
      return true;
    }

    // Compare options (simplified comparison) - only for slash commands
    const discoveredOptions = discovered.options || [];
    const currentOptions = ('options' in current) ? (current.options || []) : [];

    if (discoveredOptions.length !== currentOptions.length) {
      return true;
    }

    // Deep comparison would be more complex, but this covers most cases
    return JSON.stringify(discoveredOptions) !== JSON.stringify(currentOptions);
  }

  /**
   * Register a single command
   */
  private async registerSingleCommand(command: CommandDefinition): Promise<void> {
    await this.rest.post(
      Routes.applicationCommands(this.client.user!.id),
      { body: command }
    );
  }

  /**
   * Update a single command
   */
  private async updateSingleCommand(command: CommandDefinition): Promise<void> {
    // For updates, we need to find the command ID first
    const currentCommands = await this.getCurrentCommands();
    const existingCmd = currentCommands.find(c => c.name === command.name);

    if (existingCmd && 'description' in existingCmd && 'options' in existingCmd) {
      const hasChanges =
        existingCmd.description !== command.description ||
        JSON.stringify(existingCmd.options || []) !== JSON.stringify(command.options || []);

      if (hasChanges) {
        await this.rest.put(
          Routes.applicationCommand(this.client.user!.id, (existingCmd as any).id),
          { body: command }
        );
      }
    }
  }

  /**
   * Delete a single command
   */
  private async deleteSingleCommand(commandId: string): Promise<void> {
    await this.rest.delete(
      Routes.applicationCommand(this.client.user!.id, commandId)
    );
  }

  /**
   * Rollback commands to a previous state (emergency function)
   */
  public async rollbackCommands(backupCommands: ApplicationCommandData[]): Promise<boolean> {
    try {
      logger.warn('Rolling back commands to previous state...');

      // Delete all current commands
      const currentCommands = await this.getCurrentCommands();
      for (const cmd of currentCommands) {
        await this.deleteSingleCommand((cmd as any).id);
      }

      // Re-register backup commands
      for (const cmd of backupCommands) {
        await this.registerSingleCommand(cmd as CommandDefinition);
      }

      logger.info('Command rollback completed successfully');
      return true;

    } catch (error) {
      logger.error('Failed to rollback commands:', error);
      return false;
    }
  }

  /**
   * Validate all commands before registration
   */
  public async validateCommands(): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    const commands = await this.discoverCommands();

    for (const cmd of commands) {
      // Check name constraints
      if (!/^[\w-]{1,32}$/.test(cmd.name)) {
        errors.push(`Command '${cmd.name}' has invalid name format`);
      }

      // Check description length
      if (cmd.description.length > 100) {
        errors.push(`Command '${cmd.name}' description is too long`);
      }

      // Check for duplicate names
      const duplicates = commands.filter(c => c.name === cmd.name);
      if (duplicates.length > 1) {
        errors.push(`Duplicate command name: ${cmd.name}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

/**
 * Initialize and register commands on startup
 */
export async function initializeSlashCommands(client: Client): Promise<CommandRegistrationResult> {
  const manager = new SlashCommandManager(client);
  
  // Validate commands first
  const validation = await manager.validateCommands();
  if (!validation.valid) {
    logger.error('Command validation failed:', validation.errors);
    throw new Error(`Command validation failed: ${validation.errors.join(', ')}`);
  }

  // Register commands
  return await manager.autoRegisterCommands();
}