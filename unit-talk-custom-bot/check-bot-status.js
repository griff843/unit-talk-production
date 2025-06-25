const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();

async function checkBotStatus() {
    console.log('🔍 Checking Discord Bot Status...\n');
    
    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMembers,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent
        ]
    });

    try {
        console.log('🔗 Connecting to Discord...');
        await client.login(process.env.DISCORD_TOKEN);
        
        client.once('ready', async () => {
            console.log(`✅ Bot logged in as: ${client.user.tag}`);
            console.log(`🆔 Bot ID: ${client.user.id}`);
            console.log(`🏠 Serving ${client.guilds.cache.size} guilds`);
            
            // Check guild details
            const guild = client.guilds.cache.first();
            if (guild) {
                console.log(`\n📋 Guild Info:`);
                console.log(`   Name: ${guild.name}`);
                console.log(`   ID: ${guild.id}`);
                console.log(`   Member Count: ${guild.memberCount}`);
                
                // Check bot member in guild
                const botMember = guild.members.cache.get(client.user.id);
                if (botMember) {
                    console.log(`\n🤖 Bot Member Status:`);
                    console.log(`   Display Name: ${botMember.displayName}`);
                    console.log(`   Status: ${botMember.presence?.status || 'unknown'}`);
                    console.log(`   Roles: ${botMember.roles.cache.map(r => r.name).join(', ')}`);
                    console.log(`   Permissions: ${botMember.permissions.toArray().slice(0, 5).join(', ')}...`);
                } else {
                    console.log(`❌ Bot member not found in guild`);
                }
                
                // Check if bot can send messages in general channel
                const channels = guild.channels.cache.filter(c => c.type === 0); // Text channels
                console.log(`\n📺 Text Channels: ${channels.size}`);
                
                const firstChannel = channels.first();
                if (firstChannel) {
                    const permissions = firstChannel.permissionsFor(client.user);
                    console.log(`\n🔐 Permissions in #${firstChannel.name}:`);
                    console.log(`   View Channel: ${permissions.has('ViewChannel')}`);
                    console.log(`   Send Messages: ${permissions.has('SendMessages')}`);
                    console.log(`   Use Slash Commands: ${permissions.has('UseApplicationCommands')}`);
                }
            }
            
            // Check application commands
            try {
                const commands = await client.application.commands.fetch();
                console.log(`\n⚡ Global Slash Commands: ${commands.size}`);
                if (commands.size > 0) {
                    commands.forEach(cmd => {
                        console.log(`   - /${cmd.name}: ${cmd.description}`);
                    });
                }
                
                if (guild) {
                    const guildCommands = await guild.commands.fetch();
                    console.log(`⚡ Guild Slash Commands: ${guildCommands.size}`);
                    if (guildCommands.size > 0) {
                        guildCommands.forEach(cmd => {
                            console.log(`   - /${cmd.name}: ${cmd.description}`);
                        });
                    }
                }
            } catch (error) {
                console.log(`❌ Error fetching commands: ${error.message}`);
            }
            
            console.log('\n✅ Bot status check complete!');
            process.exit(0);
        });
        
    } catch (error) {
        console.error('❌ Failed to connect:', error.message);
        process.exit(1);
    }
}

checkBotStatus();