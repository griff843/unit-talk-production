# Unit Talk Command Center

🔴 **PRODUCTION READY** - Fortune 100 SaaS-grade operational command center for
Unit Talk sports betting intelligence platform.

**✅ LIVE STATUS**: Connected to Unit Talk production systems with real-time
data streaming and operational controls.

## Features

### 🎯 PicksHQ Dashboard ✅ PRODUCTION READY

- **Live Pick Management**: Connected to Unit Talk production `daily_picks`
  table
- **Approval Workflow**: Real-time pick approval/denial with database
  persistence
- **Production Analytics**: Live ROI tracking from actual settlement data
- **Real-Time Updates**: Instant pick status changes via Supabase subscriptions
- **Market Integration**: Connected to `raw_props` and `final_picks` for
  complete lifecycle

### 🤖 Agent Control Center ✅ PRODUCTION READY

- **Live Agent Monitoring**: Real-time subscriptions to Unit Talk production
  `agent_health` table
- **Operational Controls**: Start/stop/restart commands with database
  persistence
- **Real-Time Notifications**: Instant toast alerts for agent status changes
  (healthy/degraded/unhealthy)
- **Performance Analytics**: Live metrics from `agent_metrics` table (success
  rates, response times)
- **Production Integration**: Connected to actual Unit Talk agent systems with
  graceful fallback

### 📝 SmartForm Review System

- Pending submission queue with validation flags
- Dynamic approval/rejection workflows
- Tier tag suggestions and auto-assignment
- Submission insights and analytics

### 👥 User Management

- Discord ID lookup and profile management
- ROI summaries and engagement metrics
- Tier management and permission controls
- Capper performance analytics and audit trails

### 🎛️ LLM Task Center

- Task assignment interface for agents
- SOP management and grading review workflows
- AI-powered content generation and review
- Automated quality assurance and validation

### 📈 Business Intelligence Hub

- Revenue analytics and growth metrics
- Market trend analysis and forecasting
- User engagement and retention insights
- Integration with Phase D analytics system

## Tech Stack

- **Frontend**: Next.js 14 + React 18 + TypeScript
- **Styling**: Tailwind CSS + shadcn/ui + Framer Motion
- **Database**: Supabase (PostgreSQL) + Redis caching
- **Real-time**: Supabase Realtime + WebSockets
- **State**: Zustand + TanStack Query
- **Forms**: React Hook Form + Zod validation
- **Charts**: Chart.js + Recharts for visualizations
- **Auth**: Supabase Auth + RBAC

## Design System

Inspired by Superhuman + Vercel UI with:

- Modern dark/light themes
- Inter font family for readability
- Lucide React icons
- Framer Motion animations
- Custom tier-based color system (S, A, B, C, D)
- Glass morphism effects and responsive design

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase project
- Unit Talk platform API running

### Installation

1. Clone and install dependencies:

```bash
cd unit-talk-command-center
npm install
```

2. Set up environment variables:

```bash
cp .env.local.example .env.local
# Edit .env.local with your configuration
```

3. Configure Supabase:
   - Update `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Ensure database tables exist (picks, players, agent_logs, etc.)

4. Start development server:

```bash
npm run dev
```

5. Open [http://localhost:3001](http://localhost:3001)

## Project Structure

```
src/
├── app/
│   ├── dashboard/           # Dashboard pages
│   │   ├── picks/          # PicksHQ dashboard
│   │   ├── agents/         # Agent control center
│   │   ├── smartform/      # SmartForm review
│   │   ├── users/          # User management
│   │   ├── tasks/          # LLM task center
│   │   └── analytics/      # Business intelligence
│   ├── globals.css         # Global styles
│   └── layout.tsx          # Root layout
├── components/
│   ├── layout/             # Layout components
│   ├── ui/                 # shadcn/ui components
│   └── providers/          # Context providers
├── lib/
│   ├── supabase/           # Database client
│   └── utils.ts            # Utility functions
└── types/                  # TypeScript definitions
```

## Database Schema

### Required Tables

The Command Center expects these Supabase tables:

#### picks

```sql
id (uuid, primary key)
created_at (timestamp)
capper_id (text)
sport (text)
market_type (text)
tier (text)
ev_score (numeric)
confidence (numeric)
odds (numeric)
outcome (text, nullable)
roi (numeric, nullable)
status (text)
```

#### players

```sql
id (uuid, primary key)
name (text)
team (text)
position (text)
league (text)
player_id (text)
```

#### raw_props

```sql
id (uuid, primary key)
created_at (timestamp)
sport (text)
league (text)
game_id (text)
player_name (text)
market_type (text)
line (numeric)
odds (numeric)
book (text)
ev_score (numeric, nullable)
tier_tag (text, nullable)
confidence (numeric, nullable)
```

#### agent_logs

```sql
id (uuid, primary key)
created_at (timestamp)
agent_name (text)
level (text)
message (text)
correlation_id (text, nullable)
metadata (jsonb, nullable)
```

#### user_profiles

```sql
id (uuid, primary key)
created_at (timestamp)
discord_id (text)
username (text)
tier (text)
status (text)
roi (numeric, nullable)
```

## Integration

### Platform API Integration

The dashboard connects to the main Unit Talk platform API for:

- Pick submission and approval workflows
- Agent control and monitoring
- User management and permissions

### Phase D Analytics Integration

Integrates with the advanced analytics system for:

- Real-time monitoring dashboards
- Predictive analytics insights
- Business intelligence metrics

### Discord Integration

- User lookup by Discord ID
- Role and tier synchronization
- Notification management

## Development

### Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run type-check   # Run TypeScript checks
```

### Code Style

- ESLint + Prettier for code formatting
- TypeScript strict mode
- Consistent import organization
- Component composition patterns

## Deployment

### Production Build

```bash
npm run build
npm run start
```

### Environment Variables

Ensure all required environment variables are set in production:

- Supabase configuration
- Platform API URLs
- Authentication secrets
- Redis/caching configuration

## Production Status ✅

**COMPLETED FEATURES**:

- ✅ Real-time Supabase subscriptions integration
- ✅ Live agent health monitoring from production systems
- ✅ Pick approval workflow with database persistence
- ✅ Operational controls with live agent commands
- ✅ Performance monitoring with Redis caching
- ✅ Comprehensive error handling and graceful fallback
- ✅ Toast notifications for real-time user feedback

**FUTURE ENHANCEMENTS**:

- [ ] Advanced data visualization dashboards
- [ ] Mobile-responsive design optimization
- [ ] Role-based access control (RBAC)
- [ ] Multi-language support
- [ ] Automated testing suite expansion

## Contributing

1. Fork the repository
2. Create a feature branch
3. Follow the existing code style and patterns
4. Add tests for new functionality
5. Submit a pull request

## License

Private - Unit Talk Internal Use Only
