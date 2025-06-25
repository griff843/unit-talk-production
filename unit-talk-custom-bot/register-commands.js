const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function registerSlashCommands() {
    console.log('🔧 Registering Discord Slash Commands...\n');

    const commands = [];
    const commandsPath = path.join(__dirname, 'src', 'commands');
    
    // Get all command files
    const commandFiles = fs.readdirSync(commandsPath).filter(file => 
        file.endsWith('.ts') && !file.includes('admin') // Skip admin commands for now
    );

    console.log(`📁 Found ${commandFiles.length} command files:`);

    // Load each command
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        console.log(`   Loading: ${file}`);
        
        try {
            // For TypeScript files, we need to compile them first or use ts-node
            const { execSync } = require('child_process');
            const jsFile = file.replace('.ts', '.js');
            const jsPath = path.join(__dirname, 'dist', 'commands', jsFile);
            
            // Check if compiled JS exists
            if (fs.existsSync(jsPath)) {
                const command = require(jsPath);
                if (command.default && command.default.data && command.default.execute) {
                    commands.push(command.default.data.toJSON());
                    console.log(`   ✅ Loaded: /${command.default.data.name}`);
                } else if (command.data && command.execute) {
                    commands.push(command.data.toJSON());
                    console.log(`   ✅ Loaded: /${command.data.name}`);
                } else {
                    console.log(`   ❌ Invalid command structure: ${file}`);
                }
            } else {
                console.log(`   ⚠️  Compiled JS not found for: ${file} (run npm run build first)`);
            }
        } catch (error) {
            console.log(`   ❌ Error loading ${file}: ${error.message}`);
        }
    }

    if (commands.length === 0) {
        console.log('\n❌ No valid commands found. Make sure to run "npm run build" first.');
        return;
    }

    console.log(`\n🚀 Registering ${commands.length} commands with Discord...`);

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

    try {
        // Register commands globally (takes up to 1 hour to propagate)
        console.log('📡 Registering global commands...');
        const globalData = await rest.put(
            Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
            { body: commands }
        );
        console.log(`✅ Successfully registered ${globalData.length} global commands.`);

        // Also register to guild for immediate testing
        console.log('⚡ Registering guild commands for immediate testing...');
        const guildData = await rest.put(
            Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.DISCORD_GUILD_ID),
            { body: commands }
        );
        console.log(`✅ Successfully registered ${guildData.length} guild commands.`);

        console.log('\n🎉 Command registration complete!');
        console.log('💡 Guild commands are available immediately.');
        console.log('💡 Global commands may take up to 1 hour to appear in other servers.');
        
    } catch (error) {
        console.error('❌ Failed to register commands:', error);
    }
}

registerSlashCommands();