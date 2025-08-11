import { SlashCommandBuilder, EmbedBuilder, GuildMember } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('roles')
  .setDescription('View your roles and permissions');

export async function execute(interaction: any) {
  try {
    const member = interaction.member as GuildMember;
    if (!member) {
      await interaction.reply({
        content: '❌ This command can only be used in a server.',
        ephemeral: true,
      });
      return;
    }

    // Get user roles (excluding @everyone)
    const roles = member.roles.cache
      .filter(role => role.name !== '@everyone')
      .map(role => role.name)
      .sort();

    // Check various statuses
    const isVIP = roles.some(
      role => role.toLowerCase().includes('vip') && !role.toLowerCase().includes('vip+')
    );
    const isVIPPlus = roles.some(role => role.toLowerCase().includes('vip+'));
    const isAdmin = roles.some(role => role.toLowerCase().includes('admin'));
    const isModerator = roles.some(role => role.toLowerCase().includes('mod'));
    const isOwner = roles.some(role => role.toLowerCase().includes('owner'));
    const isStaff = roles.some(role => role.toLowerCase().includes('staff'));

    // Create embed
    const embed = new EmbedBuilder()
      .setTitle('👤 Your Roles & Permissions')
      .setColor(0x0099ff)
      .setTimestamp()
      .setFooter({ text: `Requested by ${member.displayName}` });

    // Add roles field
    const rolesText = roles.length > 0 ? roles.join(', ') + ', @everyone' : '@everyone';
    embed.addFields({
      name: '🏷️ Your Roles',
      value: rolesText,
      inline: false,
    });

    // Add status fields
    embed.addFields(
      {
        name: '💎 VIP Status',
        value: isVIP ? '✅ VIP' : '❌ Not VIP',
        inline: true,
      },
      {
        name: '💎+ VIP Plus Status',
        value: isVIPPlus ? '✅ VIP Plus' : '❌ Not VIP Plus',
        inline: true,
      },
      {
        name: '🛡️ Admin Status',
        value: isAdmin ? '✅ Admin' : '❌ Not Admin',
        inline: true,
      },
      {
        name: '🔨 Moderator Status',
        value: isModerator ? '✅ Moderator' : '❌ Not Moderator',
        inline: true,
      },
      {
        name: '👑 Owner Status',
        value: isOwner ? '✅ Owner' : '❌ Not Owner',
        inline: true,
      },
      {
        name: '👨‍💼 Staff Status',
        value: isStaff ? '✅ Staff' : '❌ Not Staff',
        inline: true,
      }
    );

    // Add permissions summary
    const permissions = [];
    if (isOwner) permissions.push('👑 Full Server Access');
    if (isAdmin) permissions.push('🛡️ Administrative Powers');
    if (isModerator) permissions.push('🔨 Moderation Tools');
    if (isStaff) permissions.push('👨‍💼 Staff Features');
    if (isVIPPlus) permissions.push('💎+ Premium Plus Features');
    else if (isVIP) permissions.push('💎 Premium Features');

    if (permissions.length > 0) {
      embed.addFields({
        name: '🔑 Key Permissions',
        value: permissions.join('\n'),
        inline: false,
      });
    }

    await interaction.reply({
      embeds: [embed],
      ephemeral: true,
    });
  } catch (error) {
    console.error('Error in roles command:', error);
    await interaction.reply({
      content: '❌ An error occurred while fetching your roles.',
      ephemeral: true,
    });
  }
}
