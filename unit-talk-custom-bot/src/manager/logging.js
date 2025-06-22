const { ActivityType, Collection, Client, Colors, ActionRowBuilder, ButtonBuilder, ButtonStyle, SnowflakeUtil
    , Partials, EmbedBuilder, Utils, AuditLogEvent, GuildHubType, GuildMember, MessageManager, Events
    , GatewayIntentBits, PermissionsBitField, Permission, ComponentType, ChannelType
    , InteractionType, ModalBuilder, Message, TextInputBuilder, TextInputStyle, IntegrationExpireBehavior } = require("discord.js");
const Discord = require("discord.js");
require('dotenv').config()
const fs = require("fs");
const configFile = fs.readFileSync(`config.json`);
const config = JSON.parse(configFile)
const cooldowns = new Map();
const fetch = require('node-fetch');

module.exports = (client) => {

    client.on('voiceStateUpdate', async (oldState, newState) => {

        if (oldState.channel && !newState.channel) {
            const logChannel = oldState.guild.channels.cache.get(config.logging);

            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setAuthor({ name: 'CHANNEL LEFT', iconURL: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS07YilaV52XGoxo78bYImjMSPMmybpec5Qiw&usqp=CAU' })
                .setDescription(`**User:** <@${oldState.member.id}> (ID: ${oldState.member.id})
            \n**Channel:** <#${oldState.channel.id}> (ID: ${oldState.channel.id})`)
                .setThumbnail('https://discords.com/_next/image?url=https%3A%2F%2Fcdn.discordapp.com%2Femojis%2F876897427242766356.gif%3Fv%3D1&w=128&q=75')
                .setTimestamp();


            logChannel.send({ embeds: [embed] });
        }
    });




    client.on('voiceStateUpdate', async (oldState, newState) => {

        if (!oldState.channel && newState.channel) {
            const logChannel = oldState.guild.channels.cache.get(config.logging);
            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setAuthor({
                    name: `${newState.guild.name} | CHANNEL JOINED`,
                    iconURL: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS07YilaV52XGoxo78bYImjMSPMmybpec5Qiw&usqp=CAU'
                })
                .setDescription(`**User:** <@${newState.member.id}> (ID: ${newState.member.id})
            \n**Channel:** <#${newState.channel.id}> (ID: ${newState.channel.id})`)
                .setThumbnail('https://cdn.discordapp.com/attachments/849047781276647425/869529604296159282/863876115584385074.gif')

                .setTimestamp();


            logChannel.send({ embeds: [embed] });
        }
    });

    client.on('voiceStateUpdate', async (oldState, newState) => {

        if (oldState.channel && newState.channel && oldState.channel.id !== newState.channel.id) {
            const logChannel = oldState.guild.channels.cache.get(config.logging);

            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setAuthor({
                    name: 'CHANNEL SWITCHED',
                    iconURL: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS07YilaV52XGoxo78bYImjMSPMmybpec5Qiw&usqp=CAU'
                })
                .setDescription(`**User:** <@${newState.member.id}> (${newState.member.user.tag}) (ID: ${newState.member.id})
            \n**TO CHANNEL:** <#${newState.channel.id}> (ID: ${newState.channel.id})
            \n**FROM CHANNEL:** <#${oldState.channel.id}> (ID: ${oldState.channel.id})`)
                .setThumbnail('https://cdn.discordapp.com/attachments/849047781276647425/869529684805840896/841989410978398218.gif?ex=65af979f&is=659d229f&hm=9fb59e190a49ca05bb9271f0518c1473983dbe4667ebf468b60bcca761c53b4f&')

                .setTimestamp();


            logChannel.send({ embeds: [embed] });
        }
    });

    client.on('messageDelete', async (message) => {

        const logChannel = message.guild.channels.cache.get(config.logging);


        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('Message Deleted')
            .addFields(
                { name: 'Author', value: `@${message.author.tag || 'Cannot determine'} - ${message.author || 'Cannot determine'}`, inline: true },
                { name: 'Date', value: message.createdAt.toUTCString(), inline: true },
                { name: 'Channel', value: `${message.channel}`, inline: true },
                { name: 'Deleted Message', value: message.content ? message.content : 'No text content', inline: false }
            )
            .setThumbnail('https://cdn.discordapp.com/attachments/849047781276647425/869530655871082516/850923749132992550.png')
            .setTimestamp();


        if (message.attachments.size > 0) {
            embed.addFields({ name: 'Attachment URL(s)', value: message.attachments.map(a => a.url).join('\n') });
        }


        logChannel.send({ embeds: [embed] });
    });

    client.on('roleCreate', async (role) => {

        const logChannel = role.guild.channels.cache.get(config.logging);


        const embed = new EmbedBuilder()
            .setColor(role.hexColor)
            .setTitle('ROLE CREATED')
            .addFields(
                { name: 'ROLE', value: `<@&${role.id}>`, inline: true },
                { name: 'ROLENAME', value: role.name, inline: true },
                { name: 'ROLEID', value: role.id, inline: true },
                { name: 'HEXCOLOR', value: role.hexColor, inline: true },
                { name: 'POSITION', value: role.position.toString(), inline: true }
            )
            .setThumbnail('https://cdn.discordapp.com/attachments/849047781276647425/869531337411952670/845717716559593512.png')

            .setTimestamp();


        logChannel.send({ embeds: [embed] });
    });

    client.on('roleDelete', async (role) => {

        const logChannel = role.guild.channels.cache.get(config.logging);



        const embed = new EmbedBuilder()
            .setColor(role.hexColor)
            .setTitle('ROLE DELETED')
            .addFields(
                { name: 'ROLE', value: role.name, inline: true },
                { name: 'ROLEID', value: role.id, inline: true },
                { name: 'HEXCOLOR', value: role.hexColor, inline: true },
                { name: 'POSITION', value: role.position.toString(), inline: true }
            )
            .setThumbnail('https://discords.com/_next/image?url=https%3A%2F%2Fcdn.discordapp.com%2Femojis%2F804032068841242705.png%3Fv%3D1&w=128&q=75')
            .setTimestamp();


        logChannel.send({ embeds: [embed] });
    });




    client.on('messageUpdate', async (oldMessage, newMessage) => {

        if (oldMessage.content === newMessage.content) return;
        if (!oldMessage.guild) return;
        const logChannel = oldMessage.guild.channels.cache.get(config.logging);


        const messageLink = `https://discord.com/channels/${newMessage.guild.id}/${newMessage.channel.id}/${newMessage.id}`;


        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('Message Edited')
            .setURL(messageLink)
            .addFields(
                { name: 'Author', value: `@${newMessage.author.tag} - ${newMessage.author}`, inline: true },
                { name: 'Date', value: newMessage.createdAt.toUTCString(), inline: true },
                { name: 'Channel', value: `${newMessage.channel}`, inline: true },
                { name: 'Original Message', value: oldMessage.content ? oldMessage.content : 'No original text', inline: false },
                { name: 'Edited Message', value: newMessage.content ? newMessage.content : 'No edited text', inline: false }
            )
            .addFields({ name: 'Jump to Message', value: `[Click here to jump to the message](${messageLink})`, inline: false })
            .setThumbnail('https://discords.com/_next/image?url=https%3A%2F%2Fcdn.discordapp.com%2Femojis%2F944017636893786203.png%3Fv%3D1&w=128&q=75')
            .setTimestamp();


        logChannel.send({ embeds: [embed] });
    });


    client.on('guildMemberUpdate', async (oldMember, newMember) => {

        const addedRole = newMember.roles.cache.find(role => !oldMember.roles.cache.has(role.id));


        if (addedRole) {

            const logChannel = oldMember.guild.channels.cache.get(config.logging);


            const embed = new EmbedBuilder()
                .setColor(addedRole.hexColor)
                .setTitle('ROLE ADDED')
                .addFields(
                    { name: 'Member', value: `<@${newMember.id}>`, inline: true },
                    { name: 'Member ID', value: newMember.id, inline: true },
                    { name: 'Role Added', value: `<@&${addedRole.id}>`, inline: true },
                    { name: 'Role ID', value: addedRole.id, inline: true },
                    { name: 'Total User Roles', value: newMember.roles.cache.size.toString(), inline: true }
                )
                .setThumbnail('https://discords.com/_next/image?url=https%3A%2F%2Fcdn.discordapp.com%2Femojis%2F812353578995679324.png%3Fv%3D1&w=128&q=75')
                .setTimestamp();


            logChannel.send({ embeds: [embed] });
        }
    });



    client.on('guildMemberUpdate', async (oldMember, newMember) => {

        const removedRole = oldMember.roles.cache.find(role => !newMember.roles.cache.has(role.id));

        if (removedRole) {
            const logChannel = oldMember.guild.channels.cache.get(config.logging);

            const embed = new EmbedBuilder()
                .setColor(removedRole.hexColor)
                .setTitle('ROLE REMOVED')
                .addFields(
                    { name: 'Member', value: `<@${newMember.id}>`, inline: true },
                    { name: 'Member ID', value: newMember.id, inline: true },
                    { name: 'Role Removed', value: `<@&${removedRole.id}>`, inline: true },
                    { name: 'Role ID', value: removedRole.id, inline: true },
                    { name: 'Total User Roles', value: newMember.roles.cache.size.toString(), inline: true }
                )
                .setThumbnail('https://discords.com/_next/image?url=https%3A%2F%2Fcdn.discordapp.com%2Femojis%2F904899961961984011.png%3Fv%3D1&w=128&q=75')
                .setTimestamp();


            logChannel.send({ embeds: [embed] });
        }
    });


    client.on('inviteCreate', async invite => {

        if (!invite.guild) return;

        const logChannel = invite.guild.channels.cache.get(config.logging);

        if (!logChannel) {
            console.log('Audit-log channel not found');
            return;
        }
        const embed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('NEW INVITE CREATED')
            .setThumbnail('https://cdn.discordapp.com/emojis/1065300559952875620.gif')
            .addFields(
                { name: 'Invite Code', value: invite.code, inline: true },
                { name: 'Inviter', value: invite.inviter ? `<@${invite.inviter.id}>` : 'Unknown', inline: true },
                { name: 'Channel', value: invite.channel ? `<#${invite.channel.id}>` : 'Unknown', inline: true },
                { name: 'Expires', value: invite.expiresTimestamp ? new Date(invite.expiresTimestamp).toString() : 'Never', inline: true },
                { name: 'Max Uses', value: invite.maxUses.toString(), inline: true }
            )
            .setTimestamp();


        logChannel.send({ embeds: [embed] }).catch(console.error);
    });



    client.on('roleUpdate', async (oldRole, newRole) => {

        const logChannel = oldRole.guild.channels.cache.get(config.logging);

        if (!logChannel) {
            console.log('Audit-log channel not found');
            return;
        }

        let descriptionText = '';


        if (oldRole.hexColor !== newRole.hexColor) {
            descriptionText += `**Color:** Changed from \`${oldRole.hexColor.toUpperCase()}\` to \`${newRole.hexColor.toUpperCase()}\`\n`;
        }


        const oldPerms = new PermissionsBitField(oldRole.permissions);
        const newPerms = new PermissionsBitField(newRole.permissions);
        const addedPerms = newPerms.remove(oldPerms).toArray();
        const removedPerms = oldPerms.remove(newPerms).toArray();

        if (addedPerms.length > 0 || removedPerms.length > 0) {
            descriptionText += '**Permissions:**\n';
            if (addedPerms.length > 0) {
                descriptionText += `Added: \`${addedPerms.join('`, `')}\`\n`;
            }
            if (removedPerms.length > 0) {
                descriptionText += `Removed: \`${removedPerms.join('`, `')}\`\n`;
            }
        }


        if (descriptionText !== '') {
            const embed = new EmbedBuilder()
                .setColor(newRole.hexColor)
                .setTitle(`Role Updated: "${newRole.name}"`)
                .setDescription(descriptionText)
                .addFields({ name: 'Role ID', value: `\`${newRole.id}\``, inline: false })
                .setTimestamp()
                .setThumbnail('https://discords.com/_next/image?url=https%3A%2F%2Fcdn.discordapp.com%2Femojis%2F769686808375590943.gif%3Fv%3D1&w=128&q=75')
                .setTimestamp();
            logChannel.send({ embeds: [embed] }).catch(console.error);
        }
    });






    client.on('guildMemberUpdate', async (oldMember, newMember) => {

        const logChannel = oldMember.guild.channels.cache.get(config.logging);
        if (!logChannel) {
            console.log('Audit-log channel not found');
            return;
        }
        if (!oldMember.communicationDisabledUntilTimestamp && newMember.communicationDisabledUntilTimestamp) {
            const duration = newMember.communicationDisabledUntilTimestamp - Date.now();

            const embed = new EmbedBuilder()
                .setColor(0xFFA500)
                .setTitle('User Timed Out')
                .setDescription(`**User:** ${newMember.user.tag}`)
                .addFields(
                    { name: 'User ID', value: newMember.user.id, inline: true },
                    { name: 'Timeout Duration', value: `${Math.round(duration / 60000)} minutes`, inline: true }
                )
                .setThumbnail(newMember.user.displayAvatarURL({ dynamic: true }))
                .setTimestamp();

            logChannel.send({ embeds: [embed] }).catch(console.error);
        }
    });



    client.on('emojiCreate', async emoji => {
        const logChannel = emoji.guild.channels.cache.get(config.logging);
        if (!logChannel) {
            console.error('Audit-log channel not found');
            return;
        }


        const fetchedLogs = await emoji.guild.fetchAuditLogs({
            limit: 1,
            type: AuditLogEvent.EmojiCreate
        }).catch(console.error);

        const emojiLog = fetchedLogs?.entries.first();
        let executor = 'Unknown';
        if (emojiLog && emojiLog.target.id === emoji.id) {
            executor = emojiLog.executor.tag;
        }

        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('New Emoji Added')
            .setDescription(`A new emoji has been added to the server!`)
            .addFields(
                { name: 'Emoji', value: `${emoji}`, inline: true },
                { name: 'Emoji Name', value: `\`${emoji.name}\``, inline: true },
                { name: 'Emoji ID', value: `\`${emoji.id}\``, inline: true },
                { name: 'Animated', value: emoji.animated ? 'Yes' : 'No', inline: true },
                { name: 'Uploader', value: executor, inline: true }
            )
            .setThumbnail(emoji.url)
            .setTimestamp()

        logChannel.send({ embeds: [embed] }).catch(console.error);
    });



    client.on('emojiDelete', async emoji => {
        const logChannel = emoji.guild.channels.cache.get(config.logging);
        if (!logChannel) {
            console.error('Audit-log channel not found');
            return;
        }


        const fetchedLogs = await emoji.guild.fetchAuditLogs({
            limit: 1,
            type: AuditLogEvent.EmojiDelete
        }).catch(console.error);

        const emojiLog = fetchedLogs?.entries.first();
        let executor = 'Unknown';
        if (emojiLog && emojiLog.target.id === emoji.id) {
            executor = emojiLog.executor.tag;
        }

        const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('Emoji Deleted 🚫')
            .setDescription(`An emoji was deleted from the server.`)
            .setThumbnail('https://discords.com/_next/image?url=https%3A%2F%2Fcdn.discordapp.com%2Femojis%2F893811882807410759.gif%3Fv%3D1&w=128&q=75')
            .addFields(
                { name: 'Emoji Name', value: `\`${emoji.name}\``, inline: true },
                { name: 'Emoji ID', value: `\`${emoji.id}\``, inline: true },
                { name: 'Deleted by', value: executor, inline: true }
            )
            .setTimestamp();
        logChannel.send({ embeds: [embed] }).catch(console.error);
    });



    client.on('emojiUpdate', async (oldEmoji, newEmoji) => {
        const logChannel = oldEmoji.guild.channels.cache.get(config.logging);
        if (!logChannel) {
            console.error('Audit-log channel not found');
            return;
        }


        const fetchedLogs = await newEmoji.guild.fetchAuditLogs({
            limit: 1,
            type: AuditLogEvent.EmojiUpdate
        }).catch(console.error);

        const emojiLog = fetchedLogs?.entries.first();
        let executor = 'Unknown';
        if (emojiLog && emojiLog.target.id === newEmoji.id) {
            executor = emojiLog.executor.tag;
        }


        const embed = new EmbedBuilder()
            .setColor('#FFA500')
            .setTitle('Emoji Updated 🔄')
            .setDescription(`An emoji has been updated in the server.`)
            .addFields(
                { name: 'Old Emoji Name', value: `\`${oldEmoji.name}\``, inline: true },
                { name: 'New Emoji Name', value: `\`${newEmoji.name}\``, inline: true },
                { name: 'Emoji ID', value: `\`${newEmoji.id}\``, inline: true },
                { name: 'Updated by', value: executor, inline: true }
            )
            .setThumbnail(newEmoji.url)
            .setTimestamp();

        logChannel.send({ embeds: [embed] }).catch(console.error);
    });



    client.on('channelCreate', async channel => {
        const logChannel = channel.guild.channels.cache.get(config.logging);
        if (!logChannel) {
            console.error('Audit-log channel not found');
            return;
        }


        const fetchedLogs = await channel.guild.fetchAuditLogs({
            limit: 1,
            type: AuditLogEvent.ChannelCreate
        }).catch(console.error);

        const channelLog = fetchedLogs?.entries.first();
        const executor = channelLog?.executor.tag || 'Unknown';


        const permissionsOverview = channel.permissionOverwrites.cache.map(overwrite => {
            const role = channel.guild.roles.cache.get(overwrite.id);
            const canView = overwrite.allow.has(PermissionsBitField.Flags.ViewChannel);
            return canView ? `✅ ${role.name}` : '';
        }).filter(name => name).join('\n') || 'No roles with explicit view access.';

        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('🆕 Channel Created')
            .setDescription(`A new channel has been created!`)
            .setThumbnail('https://discords.com/_next/image?url=https%3A%2F%2Fcdn.discordapp.com%2Femojis%2F1000566451213701180.gif%3Fv%3D1&w=128&q=75')
            .addFields(
                { name: 'Name', value: channel.name, inline: true },
                { name: 'Type', value: ChannelType[channel.type], inline: true },
                { name: 'Category', value: channel.parent?.name || 'None', inline: true },
                { name: 'Created By', value: executor, inline: true },
                { name: 'Roles with View Access', value: permissionsOverview, inline: false },
                { name: 'Channel ID', value: channel.id, inline: false }
            )
            .setTimestamp();

        logChannel.send({ embeds: [embed] }).catch(console.error);
    });





    client.on('channelDelete', async channel => {
        const logChannel = channel.guild.channels.cache.get(config.logging);
        if (!logChannel) {
            console.error('Audit-log channel not found');
            return;
        }

        let executor = 'Unknown';


        const fetchedLogs = await channel.guild.fetchAuditLogs({
            limit: 1,
            type: AuditLogEvent.ChannelDelete
        })

        if (fetchedLogs && fetchedLogs.entries.size > 0) {
            const channelLog = fetchedLogs.entries.first();
            if (channelLog && channelLog.target.id === channel.id) {
                executor = channelLog.executor.tag;
            }
        }

        const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('Channel Deleted')
            .setDescription(`**Name:** ${channel.name}\n**Type:** ${ChannelType[channel.type]}\n**Deleted by:** ${executor}`)
            .setThumbnail('https://discords.com/_next/image?url=https%3A%2F%2Fcdn.discordapp.com%2Femojis%2F893811882807410759.gif%3Fv%3D1&w=128&q=75')
            .setTimestamp();

        logChannel.send({ embeds: [embed] }).catch(console.error);
    });



    client.on('channelUpdate', async (oldChannel, newChannel) => {
        const creationTime = SnowflakeUtil.deconstruct(newChannel.id).timestamp;
        if (BigInt(Date.now()) - BigInt(creationTime) < BigInt(10000)) {
            return;
        }
        const logChannel = oldChannel.guild.channels.cache.get(config.logging);

        if (!logChannel) {
            console.error('Audit-log channel not found');
            return;
        }

        let executor = 'Unknown';

        const fetchedLogs =
            await newChannel.guild.fetchAuditLogs({
                limit: 1,
                type: AuditLogEvent.ChannelUpdate
            })

        if (fetchedLogs && fetchedLogs.entries.size > 0) {
            const channelLog = fetchedLogs.entries.first();
            if (channelLog && channelLog.target.id === newChannel.id) {
                executor = channelLog.executor.tag || 'Unknown';
            }
        }

        if (executor == 'Unknown') return;

        const embed = new EmbedBuilder()
            .setColor('#FFFF00')
            .setTitle('Channel Updated')
            .setDescription(`A channel has been updated in the server.`)
            .addFields(
                { name: 'Channel ID', value: newChannel.id, inline: true },
                { name: 'Updated by', value: executor, inline: true }
            )
            .setThumbnail('https://discords.com/_next/image?url=https%3A%2F%2Fcdn.discordapp.com%2Femojis%2F1000566451213701180.gif%3Fv%3D1&w=128&q=75')
            .setTimestamp()
            .setFooter({ text: `Channel Update Log`, iconURL: newChannel.guild.iconURL({ dynamic: true }) });


        if (oldChannel.name !== newChannel.name) {
            embed.addFields(
                { name: 'Old Name', value: oldChannel.name, inline: true },
                { name: 'New Name', value: newChannel.name, inline: true }
            );
        }

        logChannel.send({ embeds: [embed] }).catch(console.error);
    });


    client.on('messageDelete', async message => {
        if (message.mentions.users.size > 0 && Date.now() - message.createdTimestamp < 5000) {
            const logChannel = message.guild.channels.cache.get(config.logging);
            if (!logChannel) {
                console.error('Audit-log channel not found');
                return;
            }

            let executor = 'Unknown';
            const fetchedLogs = await message.guild.fetchAuditLogs({
                limit: 1,
                type: AuditLogEvent.MessageDelete
            }).catch(console.error);

            const deletionLog = fetchedLogs?.entries.first();
            if (deletionLog && deletionLog.extra.channel.id === message.channel.id
                && deletionLog.target.id === message.author.id
                && deletionLog.createdTimestamp > message.createdTimestamp) {
                executor = deletionLog.executor.tag;
            } else {

                executor = message.author.tag + ' (Self-deletion)';
            }

            const embed = new EmbedBuilder()
                .setColor('#FF4500')
                .setTitle('Ghost Ping Detected 🚫')
                .setDescription(`A message mentioning a user was quickly deleted.`)
                .addFields(
                    { name: 'Author', value: message.author.tag, inline: true },
                    { name: 'Content', value: message.content, inline: true },
                    { name: 'Deleted by', value: executor, inline: true }
                )
                .setTimestamp();

            logChannel.send({ embeds: [embed] }).catch(console.error);
        }
    });


    client.on('messageDeleteBulk', async messages => {
        const logChannel = messages.guild.channels.cache.get(config.logging);
        if (!logChannel) {
            console.error('Audit-log channel not found');
            return;
        }

        const fetchedLogs = await messages.first().guild.fetchAuditLogs({
            limit: 1,
            type: 'MESSAGE_BULK_DELETE'
        }).catch(console.error);

        const deletionLog = fetchedLogs?.entries.first();
        let executor = 'Unknown';
        if (deletionLog) {
            executor = deletionLog.executor.tag;
        }

        const embed = new EmbedBuilder()
            .setColor('#FF4500')
            .setTitle('Bulk Messages Deleted 🚫')
            .setDescription(`${messages.size} messages were deleted in bulk.`)
            .addFields(
                { name: 'Channel', value: messages.first().channel.name, inline: true },
                { name: 'Deleted by', value: executor, inline: true }
            )
            .setTimestamp();
        logChannel.send({ embeds: [embed] }).catch(console.error);
    });



    client.on('guildMemberAdd', async member => {
        const logChannel = member.guild.channels.cache.get(config.logging);

        if (!logChannel) {
            console.error('Audit-log channel not found');
            return;
        }

        const accountCreationDate = member.user.createdAt;
        const accountAge = new Date() - accountCreationDate;
        const sevenDaysInMilliseconds = 7 * 24 * 60 * 60 * 1000; // 7 days

        let accountAgeWarning = '';
        if (accountAge < sevenDaysInMilliseconds) {
            accountAgeWarning = '⚠️ **This account is less than 7 days old. Admins, please take note!** ⚠️';
        }

        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle(`**${member.user.tag}** has joined`)
            .setDescription(`Member ${member.user.tag} Account overview! 
        
        **${accountAgeWarning}**`)
            .setThumbnail(member.user.displayAvatarURL())
            .addFields(
                { name: 'Member #', value: `${member.guild.memberCount}`, inline: true },
                { name: 'Account Created', value: `${accountCreationDate.toDateString()}`, inline: true }
            )

        logChannel.send({ embeds: [embed] }).catch(console.error);
    });



    client.on('guildMemberRemove', async member => {
        const logChannel = member.guild.channels.cache.get(config.logging);
        if (!logChannel) {
            console.error('Audit-log channel not found');
            return;
        }

        const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('Member Left the Server')
            .setDescription(`**${member.user.tag}** has left **${member.guild.name}**.`)
            .setThumbnail(member.user.displayAvatarURL())
            .addFields(
                { name: 'Username', value: `${member.user.tag}`, inline: true },
                { name: 'Member ID', value: `${member.id}`, inline: true },
                { name: 'Total Members Now', value: `${member.guild.memberCount}`, inline: true }
            )

        logChannel.send({ embeds: [embed] }).catch(console.error);
    });



    client.on('guildBanRemove', async (ban) => {
        const logChannel = ban.guild.channels.cache.get(config.logging);
        if (!logChannel) {
            console.error('Audit-log channel not found');
            return;
        }

        const fetchedLogs = await ban.guild.fetchAuditLogs({
            limit: 1,
            type: AuditLogEvent.MemberBanRemove
        }).catch(console.error);

        const unbanLog = fetchedLogs?.entries.first();
        let executor = 'Unknown';
        if (unbanLog) {
            executor = unbanLog.executor.tag;
        }

        const embed = new EmbedBuilder()
            .setColor('#32a852')
            .setTitle('User Unbanned')
            .setDescription(`**${ban.user.tag}** has been unbanned from **${ban.guild.name}**.`)
            .setThumbnail(ban.user.displayAvatarURL())
            .addFields(
                { name: 'Unbanned User', value: `${ban.user.tag}`, inline: true },
                { name: 'User ID', value: `${ban.user.id}`, inline: true },
                { name: 'Unbanned by', value: executor, inline: true }
            )
        logChannel.send({ embeds: [embed] }).catch(console.error);
    });


    client.on('guildBanAdd', async (ban) => {
        const logChannel = ban.guild.channels.cache.get(config.logging);
        if (!logChannel) {
            console.error('Ban-log channel not found');
            return;
        }

        const fetchedLogs = await ban.guild.fetchAuditLogs({
            limit: 1,
            type: 22
        }).catch(console.error);

        const banLog = fetchedLogs?.entries.first();
        let executor = banLog?.executor?.tag || 'Unknown';
        let reason = banLog?.reason || 'No reason provided';

        const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('User Banned')
            .setDescription(`**${ban.user.tag}** has been banned from the server.`)
            .setThumbnail(ban.user.displayAvatarURL())
            .addFields(
                { name: 'Username', value: `${ban.user.tag}`, inline: true },
                { name: 'User ID', value: `${ban.user.id}`, inline: true },
                { name: 'Banned By', value: executor, inline: true },
                { name: 'Reason', value: reason, inline: false },
                { name: 'Time of ban', value: `<t:${Math.floor(banLog.createdTimestamp / 1000)}:F>`, inline: false }
            )

        logChannel.send({ embeds: [embed] }).catch(console.error);
    });


    client.on('guildMemberRemove', async member => {
        const logChannel = member.guild.channels.cache.get(config.logging);
        if (!logChannel) {
            console.error('Audit-log channel not found');
            return;
        }

        try {
            const fetchedLogs = await member.guild.fetchAuditLogs({
                limit: 1,
                type: AuditLogEvent.MemberKick
            });

            const kickLog = fetchedLogs.entries.first();
            if (!kickLog || kickLog.target.id !== member.id) return;

            const executor = kickLog.executor.tag;
            const reason = kickLog.reason || 'No reason provided';

            const embed = new EmbedBuilder()
                .setColor('#FF4500')
                .setTitle('User Kicked')
                .setDescription(`**${member.user.tag}** has been removed from the server.`)
                .setThumbnail(member.user.displayAvatarURL())
                .addFields(
                    { name: 'Username', value: `${member.user.tag}`, inline: true },
                    { name: 'User ID', value: `${member.user.id}`, inline: true },
                    { name: 'Kicked By', value: executor, inline: true },
                    { name: 'Reason for Kick', value: reason, inline: false },
                    { name: 'Time of Kick', value: `<t:${Math.floor(kickLog.createdTimestamp / 1000)}:F>`, inline: false }
                )

            await logChannel.send({ embeds: [embed] });
        } catch (error) {
            console.error('Error fetching logs:', error);
        }
    })
} 