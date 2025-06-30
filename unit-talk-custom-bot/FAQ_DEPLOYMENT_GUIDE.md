# FAQ System Deployment Guide

## Quick Start

Follow these steps to deploy the FAQ system to your Unit Talk Discord bot:

### 1. Prerequisites

Ensure you have:
- Node.js 18+ installed
- Discord bot token with appropriate permissions
- Access to the Discord server with forum channel ID `1387837517298139267`
- Bot permissions: `Manage Channels`, `Send Messages`, `Create Public Threads`, `Manage Threads`

### 2. Environment Setup

Make sure your `.env` file contains:
```env
DISCORD_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=your_application_id_here
DISCORD_GUILD_ID=your_guild_id_here  # Optional, for faster command registration
```

### 3. Install Dependencies

```bash
cd unit-talk-custom-bot
npm install
```

### 4. Build the Project

```bash
npm run build
```

### 5. Register Commands

Register the new FAQ commands with Discord:

```bash
npm run faq:register
```

This will register the following commands:
- `/faq-init` (Administrator only)
- `/faq-add` (Manage Channels permission)
- `/faq-edit` (Manage Channels permission)

### 6. Test the System (Optional)

Test the FAQ service connectivity:

```bash
npm run faq:test
```

### 7. Start the Bot

```bash
npm start
```

### 8. Initialize FAQs

Once the bot is running, use the `/faq-init` command in Discord to create all FAQ threads:

1. Go to your Discord server
2. Use the command: `/faq-init`
3. Wait for the initialization to complete (about 12-15 seconds)
4. Check the FAQ forum channel for the new threads

## Command Usage

### Initialize All FAQs
```
/faq-init
```
- **Who can use**: Administrators only
- **What it does**: Creates/updates all 12 FAQ threads
- **Time**: ~15 seconds with progress updates

### Add New FAQ
```
/faq-add title:"How do I reset my password?" icon:"🔑" description:"To reset your password, click the forgot password link on the login page." button_label:"Reset Password" button_url:"https://unittalk.com/reset"
```
- **Who can use**: Staff with Manage Channels permission
- **Required**: title, icon, description
- **Optional**: button_label, button_url

### Edit Existing FAQ
```
/faq-edit title:"What is Unit Talk?" new_description:"Updated description here"
```
- **Who can use**: Staff with Manage Channels permission
- **Features**: Autocomplete for existing FAQ titles
- **Tip**: Use `new_button_label:"REMOVE"` to remove buttons

## Verification Steps

After deployment, verify:

1. **Commands are registered**: Type `/faq` in Discord and see the three commands
2. **Forum channel exists**: Confirm channel ID `1387837517298139267` is accessible
3. **Bot permissions**: Bot can create threads and send messages in the forum
4. **FAQ threads created**: All 12 FAQ threads appear in the forum
5. **Threads are locked**: Only staff can reply to FAQ threads
6. **Embeds display correctly**: Green color (#1EF763), icons, and buttons work
7. **Autocomplete works**: `/faq-edit` shows existing FAQ titles

## Troubleshooting

### Commands not appearing
- Run `npm run faq:register` again
- Check bot permissions in Discord Developer Portal
- Verify `DISCORD_CLIENT_ID` and `DISCORD_TOKEN` are correct

### Forum channel not found
- Verify channel ID `1387837517298139267` exists
- Check bot has access to the channel
- Ensure channel type is "Forum"

### Threads not creating
- Check bot permissions: `Create Public Threads`, `Manage Threads`
- Verify bot can send messages in the forum
- Check console logs for error messages

### Buttons not working
- Verify URLs are valid and accessible
- Check button labels are under 80 characters
- Ensure URLs start with `https://`

## Customization

### Update FAQ Data
Edit the `FAQ_DATA` array in `src/commands/faq-init.ts` and run `/faq-init` again.

### Change Brand Color
Update the `BRAND_COLOR` constant in `src/services/faqService.ts`.

### Modify Forum Channel
Update the `FAQ_FORUM_ID` constant in `src/services/faqService.ts`.

### Add New Commands
Follow the existing pattern in the `src/commands/` directory.

## Monitoring

### Logs to Watch
- FAQ thread creation/updates
- Command usage by staff
- Error messages and stack traces
- Rate limiting warnings

### Health Checks
- Verify FAQ threads remain locked
- Check button links periodically
- Monitor command response times
- Ensure autocomplete is working

## Maintenance

### Regular Tasks
- Update FAQ content as needed using `/faq-edit`
- Monitor logs for errors
- Verify external links in buttons
- Update FAQ data for new features

### Backup Strategy
- FAQ data is stored in Discord threads
- Command definitions are in source code
- Configuration is in environment variables
- Database: No additional database storage needed

## Support

If you encounter issues:

1. Check the console logs for error messages
2. Verify all environment variables are set
3. Confirm Discord permissions are correct
4. Test with `/faq-test` script
5. Review the FAQ_SYSTEM_README.md for detailed documentation

## Security Notes

- Commands require appropriate Discord permissions
- All FAQ threads are automatically locked
- Input validation prevents malicious content
- External URLs are validated before saving
- No sensitive data is stored in FAQ content

## Performance

- FAQ operations include rate limiting (1 second between bulk operations)
- Autocomplete responses are cached
- Thread lookups are optimized
- Progress updates during bulk operations

---

**Deployment Complete!** 🎉

Your FAQ system is now ready to use. Staff can manage FAQs with the slash commands, and users can browse the comprehensive FAQ forum.