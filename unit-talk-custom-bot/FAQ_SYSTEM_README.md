# FAQ System Documentation

## Overview

The FAQ system provides a comprehensive solution for managing frequently asked questions in a Discord forum channel. It includes automated thread creation, staff management commands, and a rich embed system with interactive buttons.

## Features

- **Automated FAQ Thread Creation**: Creates locked threads in the specified forum channel
- **Rich Embeds**: Each FAQ uses the brand color (#1EF763) with custom icons and descriptions
- **Interactive Buttons**: Optional action buttons for external links
- **Staff Management**: Slash commands for adding and editing FAQs
- **Autocomplete Support**: Smart autocomplete for editing existing FAQs
- **Bulk Initialization**: Command to initialize all FAQs at once

## Commands

### `/faq-init` (Admin Only)
Initializes all FAQ threads in the forum with the predefined FAQ data.

**Usage**: `/faq-init`

**Permissions**: Administrator

**Description**: Creates or updates all 12 FAQ threads in the forum channel (ID: 1387837517298139267). Each thread is automatically locked so only staff can reply.

### `/faq-add` (Staff Only)
Adds a new FAQ to the forum.

**Usage**: `/faq-add title:"FAQ Title" icon:"🔥" description:"FAQ description" [button_label:"Button Text"] [button_url:"https://example.com"]`

**Parameters**:
- `title` (required): The FAQ title (max 100 characters)
- `icon` (required): Emoji or icon for the FAQ (max 10 characters)
- `description` (required): The FAQ description/answer (max 4000 characters)
- `button_label` (optional): Button text (max 80 characters)
- `button_url` (optional): Button URL (required if button_label is provided)

**Permissions**: Manage Channels

### `/faq-edit` (Staff Only)
Edits an existing FAQ in the forum.

**Usage**: `/faq-edit title:"Current FAQ Title" [new_title:"New Title"] [new_icon:"🆕"] [new_description:"New description"] [new_button_label:"New Button"] [new_button_url:"https://new-url.com"]`

**Parameters**:
- `title` (required): Current FAQ title to edit (with autocomplete)
- `new_title` (optional): New FAQ title
- `new_icon` (optional): New emoji or icon
- `new_description` (optional): New FAQ description
- `new_button_label` (optional): New button text (use "REMOVE" to remove button)
- `new_button_url` (optional): New button URL

**Permissions**: Manage Channels

**Features**:
- Autocomplete for existing FAQ titles
- Partial updates (only change what you specify)
- Button removal option

## FAQ Data Structure

Each FAQ follows this structure:

```typescript
interface FAQItem {
  title: string;           // FAQ title
  icon: string;            // Emoji or icon
  description: string;     // FAQ description/answer
  button_label?: string | null;  // Optional button text
  button_url?: string | null;    // Optional button URL
}
```

## Current FAQ List

The system includes 12 predefined FAQs:

1. **🏆 What is Unit Talk?** - Introduction to the platform
2. **💎 What does my subscription include?** - VIP benefits with upgrade button
3. **🕒 Is there a trial period for the subscription?** - Trial information with trial button
4. **💳 What payment methods do you accept?** - Payment information
5. **🔓 Are there any free channels available?** - Free channel information with link
6. **❌ Can I cancel my subscription at any time?** - Cancellation policy with management link
7. **📅 How often are tips provided?** - Tip frequency with alerts guide
8. **🏈 What sports do you cover?** - Sports coverage information
9. **🛠️ What if I have questions or need support?** - Support information with ticket link
10. **🔔 How do I get notified for new picks?** - Notification setup with capper corner link
11. **🛡️ Is my data secure?** - Data security with privacy policy link
12. **🧠 How do you promote responsible gambling?** - Responsible gaming with resources link

## Technical Implementation

### FAQ Service (`FAQService`)

The core service handles:
- Thread creation and updates
- Embed generation with brand styling
- Button creation for actionable FAQs
- Thread locking for staff-only replies
- Bulk operations with rate limiting

### Command Structure

All FAQ commands follow the Discord.js slash command pattern:
- Export `data` (SlashCommandBuilder)
- Export `execute` function
- Export `autocomplete` function (for faq-edit)

### Integration

The FAQ system integrates with:
- **Command Handler**: Routes FAQ commands to appropriate handlers
- **Interaction Handler**: Handles autocomplete for FAQ editing
- **Main Bot**: FAQ service is initialized and available to all handlers

## Configuration

### Environment Variables

The system uses the following configuration:
- `DISCORD_TOKEN`: Bot token for Discord API access
- `DISCORD_CLIENT_ID`: Application ID for command registration
- `DISCORD_GUILD_ID`: Guild ID for guild-specific commands (optional)

### Forum Channel

- **Forum ID**: `1387837517298139267`
- **Channel Type**: Guild Forum
- **Thread Permissions**: Locked (staff-only replies)

### Brand Styling

- **Color**: `#1EF763` (Unit Talk brand green)
- **Embed Style**: Title with icon, description, timestamp
- **Button Style**: Link buttons for external actions

## Usage Examples

### Initialize All FAQs
```
/faq-init
```

### Add a New FAQ
```
/faq-add title:"How do I contact support?" icon:"📞" description:"You can contact our support team 24/7 through our ticket system." button_label:"Open Ticket" button_url:"https://support.unittalk.com"
```

### Edit an Existing FAQ
```
/faq-edit title:"What is Unit Talk?" new_description:"Unit Talk is the premier Discord community for sports bettors, featuring expert analysis, daily picks, and educational content from professional handicappers."
```

### Remove a Button from FAQ
```
/faq-edit title:"What sports do you cover?" new_button_label:"REMOVE"
```

## Error Handling

The system includes comprehensive error handling:
- Invalid URLs are validated
- Missing required parameters are caught
- Discord API errors are logged
- User-friendly error messages
- Graceful degradation for partial failures

## Rate Limiting

To avoid Discord rate limits:
- 1-second delay between bulk operations
- Progress updates during initialization
- Proper error recovery

## Logging

All FAQ operations are logged:
- FAQ creation/updates
- Command usage with user information
- Errors with full context
- Performance metrics

## Maintenance

### Adding New FAQs

1. Use `/faq-add` command
2. Or add to the FAQ_DATA array in `faq-init.ts` for bulk updates

### Updating Existing FAQs

1. Use `/faq-edit` command for individual updates
2. Or modify FAQ_DATA and run `/faq-init` for bulk updates

### Monitoring

- Check bot logs for FAQ-related errors
- Monitor Discord forum for thread status
- Verify button links periodically

## Security

- Commands require appropriate Discord permissions
- Thread locking prevents unauthorized edits
- Input validation prevents malicious content
- URL validation ensures safe external links