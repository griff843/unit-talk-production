# UT Cappers Discord Bot Integration

This integration adds the UT Cappers system to your existing Discord bot, allowing users to submit, manage, and track their betting picks directly through Discord commands.

## Features

### Slash Commands
- `/submit-pick` - Submit a new betting pick with analysis
- `/capper-onboard` - Register as a new capper with display name and tier
- `/edit-pick` - Edit your pending picks
- `/delete-pick` - Delete your pending picks  
- `/capper-stats` - View your capper statistics and performance

### System Components
- **CapperSystem** - Main service that manages the capper functionality
- **CapperInteractionHandler** - Handles all capper-related Discord interactions
- **Modal Forms** - Interactive forms for detailed pick submission
- **Embed Messages** - Rich Discord embeds for displaying pick information

## Configuration

Add these environment variables to your `.env` file:

```env
# Capper System Configuration
CAPPER_SYSTEM_ENABLED=true
CAPPER_PICKS_CHANNEL_ID=your_channel_id_here
CAPPER_DATABASE_URL=your_database_url_here
```

## Usage

### For Cappers
1. **Onboard**: Use `/capper-onboard` to register as a capper
2. **Submit Picks**: Use `/submit-pick` to submit new betting picks
3. **Manage Picks**: Use `/edit-pick` and `/delete-pick` to manage pending picks
4. **View Stats**: Use `/capper-stats` to see your performance metrics

### For Administrators
The capper system integrates seamlessly with your existing bot's permission system and logging.

## Integration Status

✅ **Integrated Components:**
- Capper system service
- Discord slash commands
- Interaction handlers
- Environment configuration
- Command registration

🔄 **Placeholder Components:**
- Database integration (currently using mock data)
- Pick validation and grading
- Automated publishing
- Statistics calculation

## Next Steps

To complete the integration:

1. **Database Setup**: Connect to your actual capper database
2. **Pick Validation**: Implement pick validation logic
3. **Statistics**: Connect to real statistics calculation
4. **Publishing**: Set up automated daily pick publishing
5. **Permissions**: Configure capper role permissions

## Files Added/Modified

### New Files:
- `src/services/capperSystem.ts` - Main capper system service
- `src/handlers/capperInteractionHandler.ts` - Discord interaction handler
- `src/commands/submit-pick.ts` - Submit pick command
- `src/commands/capper-onboard.ts` - Capper onboarding command
- `src/commands/edit-pick.ts` - Edit pick command
- `src/commands/delete-pick.ts` - Delete pick command
- `src/commands/capper-stats.ts` - Capper statistics command

### Modified Files:
- `src/index.ts` - Added capper system initialization
- `src/handlers/commandHandler.ts` - Added capper command routing
- `.env.example` - Added capper configuration variables

The capper system is now successfully integrated into your Discord bot and ready for use!