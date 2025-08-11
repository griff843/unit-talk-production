# Unit Talk Discord Bot - User Command Reference

## 🎯 **Complete Command List**

This guide covers all available slash commands in the Unit Talk Discord Bot,
organized by user tier and functionality.

---

## 📋 **BASIC COMMANDS (All Users)**

### `/help`

**Description**: Get help and information about available commands **Usage**:
`/help [command]` **Example**: `/help pick` **Features**:

- Shows tier-specific available commands
- Interactive buttons for quick navigation
- Context-aware help based on your current tier

### `/ping`

**Description**: Check if the bot is responsive **Usage**: `/ping` **Response**:
Shows bot latency and status

### `/stats`

**Description**: View your personal statistics **Usage**: `/stats` **Shows**:

- Total picks submitted
- Win/loss record
- Current streak
- Overall performance

---

## 🎯 **PICK MANAGEMENT**

### `/pick`

**Description**: Submit a new sports betting pick **Usage**:
`/pick sport:<sport> selection:<pick> odds:<odds> units:<units> confidence:<1-10>`
**Example**:
`/pick sport:NFL selection:Chiefs -3.5 odds:-110 units:2 confidence:8`
**Required Fields**:

- `sport`: NFL, NBA, MLB, NHL, etc.
- `selection`: Your pick description
- `odds`: American odds format (+150, -110)
- `units`: Number of units (1-10)
- `confidence`: Confidence level (1-10)

### `/enhanced-pick`

**Description**: Submit a pick with enhanced analytics and tracking **Usage**:
`/enhanced-pick sport:<sport> selection:<pick> odds:<odds> units:<units> confidence:<7-10> analysis:<analysis>`
**VIP+ Feature**: Enhanced analytics and portfolio tracking **Additional
Fields**:

- `analysis`: Detailed reasoning for your pick
- Enhanced performance tracking
- Portfolio impact analysis

### `/edit-pick`

**Description**: Edit a previously submitted pick **Usage**:
`/edit-pick pick_id:<id> [field]:<new_value>` **Example**:
`/edit-pick pick_id:123 odds:-120` **Editable Fields**: selection, odds, units,
confidence, analysis

### `/delete-pick`

**Description**: Delete a submitted pick **Usage**: `/delete-pick pick_id:<id>`
**Note**: Only available for picks that haven't been graded

---

## 🏆 **VIP COMMANDS**

### `/vip-info`

**Description**: View VIP tier information and benefits **Usage**: `/vip-info`
**Shows**:

- VIP benefits and features
- Upgrade options and pricing
- Trial activation for eligible users

### `/trial-status`

**Description**: Check your trial status and remaining time **Usage**:
`/trial-status` **Shows**:

- Trial start date
- Remaining time
- Upgrade prompts

### `/upgrade`

**Description**: Quick access to VIP upgrade options **Usage**: `/upgrade`
**Features**:

- Direct upgrade links
- Tier comparison
- Payment options

### `/top-plays`

**Description**: View top performing picks from community **Usage**:
`/top-plays [sport] [timeframe]` **Example**: `/top-plays NFL week` **Shows**:

- Highest confidence picks
- Best performing cappers
- Trending selections

### `/recap`

**Description**: Get daily/weekly performance recap **Usage**:
`/recap [timeframe]` **Example**: `/recap week` **Shows**:

- Win/loss summary
- Best performing picks
- Community highlights

---

## ⭐ **VIP+ COMMANDS**

### `/heat-signal`

**Description**: Access live market alerts and signals **Usage**: `/heat-signal`
**VIP+ Exclusive**: Real-time market intelligence **Features**:

- Live odds movements
- Sharp money indicators
- Value betting opportunities
- Risk alerts

### `/ask-ai`

**Description**: Get AI-powered betting analysis and coaching **Usage**:
`/ask-ai question:<your_question>` **Example**:
`/ask-ai question:Should I bet the over on LeBron James 25.5 points tonight?`
**Features**:

- Personalized analysis based on your history
- Risk assessment
- Bankroll management advice
- Strategy recommendations

### `/edge-tracker`

**Description**: Track betting edges and value opportunities **Usage**:
`/edge-tracker [sport] [metric]` **Example**: `/edge-tracker NBA line_movement`
**Shows**:

- Line movement analysis
- Public vs sharp money
- Value betting opportunities
- Historical edge patterns

---

## 🖤 **BLACK LABEL COMMANDS**

### `/black-label announce`

**Description**: Create professional Black Label pick announcements **Usage**:
`/black-label announce sport:<sport> confidence:<7-10>` **Black Label
Exclusive**: Enhanced announcements with advanced features **Features**:

- Professional embed design
- Interactive tracking buttons
- Real-time analytics integration
- Risk assessment overlay
- Portfolio impact analysis

### `/black-label dashboard`

**Description**: Access comprehensive analytics dashboard **Usage**:
`/black-label dashboard` **Features**:

- Real-time performance metrics
- Confidence analysis breakdown
- Sport-specific analytics
- Portfolio status tracking
- Market insights

### `/black-label portfolio`

**Description**: View comprehensive portfolio performance **Usage**:
`/black-label portfolio` **Features**:

- Total portfolio value
- Daily/weekly/monthly P&L
- Risk metrics (Sharpe ratio, VaR)
- Allocation analysis
- Active positions tracking

### `/black-label insights`

**Description**: Access exclusive market intelligence **Usage**:
`/black-label insights` **Features**:

- Sharp money analysis
- Value opportunities
- Risk alerts
- Predictive models
- Market trends

---

## 🎯 **CAPPER COMMANDS**

### `/capper-onboard`

**Description**: Start capper onboarding process **Usage**:
`/capper-onboard display_name:<name> tier:<rookie|pro|elite|legend>`
**Example**: `/capper-onboard display_name:ProCapper tier:pro` **Features**:

- Profile creation
- Tier assignment
- Thread setup
- Performance tracking

### `/capper-stats`

**Description**: View capper performance statistics **Usage**:
`/capper-stats [capper_name]` **Example**: `/capper-stats ProCapper` **Shows**:

- Win/loss record
- ROI and performance metrics
- Recent picks
- Community ranking

### `/capper-leader`

**Description**: View capper leaderboard **Usage**:
`/capper-leader [timeframe] [sport]` **Example**: `/capper-leader month NFL`
**Shows**:

- Top performing cappers
- Performance rankings
- Recent activity
- Specialization areas

---

## 🛠️ **ADMIN COMMANDS**

### `/admin`

**Description**: Access administrative controls **Usage**:
`/admin [action] [target] [parameters]` **Admin Only**: Comprehensive admin
panel **Available Actions**:

- `user_manage`: Manage user tiers and permissions
- `system_status`: View system health and metrics
- `config_edit`: Edit bot configuration
- `analytics`: View detailed analytics
- `backup`: Create system backups

### `/roles`

**Description**: Manage user roles and permissions **Usage**:
`/roles [action] [user] [role]` **Admin/Mod Only**: Role management **Actions**:

- `assign`: Assign role to user
- `remove`: Remove role from user
- `list`: List all roles
- `check`: Check user's current roles

---

## 📊 **ANALYTICS COMMANDS**

### `/analytics`

**Description**: View analytics and performance data **Usage**:
`/analytics [type] [timeframe]` **Example**: `/analytics performance week`
**Available Types**:

- `performance`: Personal performance metrics
- `community`: Community-wide statistics
- `sports`: Sport-specific analytics
- `trends`: Trend analysis

---

## 🔧 **UTILITY COMMANDS**

### `/faq`

**Description**: Access frequently asked questions **Usage**: `/faq [topic]`
**Example**: `/faq vip` **Features**:

- Searchable FAQ database
- Interactive navigation
- Tier-specific information

### `/support`

**Description**: Get help and support **Usage**: `/support [issue]` **Example**:
`/support technical` **Features**:

- Direct support channel access
- Issue categorization
- Escalation options

---

## 🎮 **INTERACTIVE FEATURES**

### Button Interactions

Many commands include interactive buttons for enhanced functionality:

**Pick Tracking Buttons**:

- `Track Pick`: Real-time performance monitoring
- `View Analytics`: Detailed analytics
- `Risk Analysis`: Comprehensive risk assessment
- `Portfolio Impact`: Portfolio analysis

**Navigation Buttons**:

- `View VIP Perks`: VIP benefits overview
- `Start Trial`: Trial activation
- `Upgrade Now`: Quick upgrade access
- `Help Commands`: Command assistance

**Analytics Buttons**:

- `Refresh Data`: Update dashboard
- `Export Report`: Generate reports
- `Detailed Analytics`: Advanced analytics
- `Market Alerts`: Alert configuration

---

## 📱 **TIER COMPARISON**

| Feature              | Free | VIP | VIP+ | Black Label | Capper |
| -------------------- | ---- | --- | ---- | ----------- | ------ |
| Basic Commands       | ✅   | ✅  | ✅   | ✅          | ✅     |
| Pick Submission      | ✅   | ✅  | ✅   | ✅          | ✅     |
| Enhanced Picks       | ❌   | ❌  | ✅   | ✅          | ✅     |
| Heat Signals         | ❌   | ❌  | ✅   | ✅          | ✅     |
| AI Coaching          | ❌   | ❌  | ✅   | ✅          | ✅     |
| Black Label Features | ❌   | ❌  | ❌   | ✅          | ❌     |
| Capper Features      | ❌   | ❌  | ❌   | ❌          | ✅     |
| Admin Tools          | ❌   | ❌  | ❌   | ❌          | ❌     |

---

## 🚀 **GETTING STARTED**

1. **New Users**: Start with `/help` to see available commands
2. **Pick Submission**: Use `/pick` to submit your first pick
3. **Upgrade**: Use `/vip-info` to learn about VIP benefits
4. **Analytics**: Use `/stats` to track your performance
5. **Support**: Use `/support` if you need help

---

## 📞 **NEED HELP?**

- **General Help**: `/help`
- **Command Issues**: `/support technical`
- **Billing Questions**: `/support billing`
- **Feature Requests**: `/support feature`
- **Bug Reports**: `/support bug`

---

_Last Updated: July 2025_ _Bot Version: 3.0_
