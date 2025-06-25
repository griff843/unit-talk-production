require('dotenv').config();

// Helper function to get the first role ID from a comma-separated list
const getFirstRoleId = (envVar, defaultValue) => {
  if (!envVar) return defaultValue;
  return envVar.split(',')[0].trim();
};

console.log('=== Environment Variables ===');
console.log('VIP_ROLE_IDS:', process.env.VIP_ROLE_IDS);
console.log('VIP_PLUS_ROLE_IDS:', process.env.VIP_PLUS_ROLE_IDS);
console.log('ADMIN_ROLE_IDS:', process.env.ADMIN_ROLE_IDS);
console.log('MODERATOR_ROLE_IDS:', process.env.MODERATOR_ROLE_IDS);

console.log('\n=== Parsed Role IDs ===');
console.log('VIP Role ID:', getFirstRoleId(process.env.VIP_ROLE_IDS, 'default'));
console.log('VIP Plus Role ID:', getFirstRoleId(process.env.VIP_PLUS_ROLE_IDS, 'default'));
console.log('Admin Role ID:', getFirstRoleId(process.env.ADMIN_ROLE_IDS, 'default'));
console.log('Moderator Role ID:', getFirstRoleId(process.env.MODERATOR_ROLE_IDS, 'default'));

console.log('\n=== Discord Config ===');
console.log('Discord Token exists:', !!process.env.DISCORD_TOKEN);
console.log('Discord Client ID:', process.env.DISCORD_CLIENT_ID);
console.log('Discord Guild ID:', process.env.DISCORD_GUILD_ID);