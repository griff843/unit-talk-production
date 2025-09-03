# 🎯 Smart Form Setup Guide

## 📋 Complete Setup Instructions

### **Step 1: Create the smart_tickets Table**

**Method 1: Supabase Dashboard (Recommended)**

1. Go to
   [Supabase Dashboard](https://app.supabase.com/project/lxqmuzmqtnnlpfapvief)
2. Navigate to **SQL Editor**
3. Copy and paste the entire contents of
   `migrations/001_create_smart_tickets.sql`
4. Click **"Run"** to execute

**Method 2: Manual SQL Commands** If you prefer to run individual commands, use
the following:

```sql
-- Basic table creation
CREATE TABLE IF NOT EXISTS smart_tickets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    bet_slip_id TEXT UNIQUE NOT NULL,
    capper TEXT NOT NULL,
    ticket_type TEXT NOT NULL CHECK (ticket_type IN ('single', 'parlay', 'teaser', 'round_robin')),
    sport TEXT NOT NULL,
    game_date DATE NOT NULL,
    user_tier TEXT NOT NULL CHECK (user_tier IN ('free', 'vip', 'vip_plus')),
    unit_size DECIMAL(3,1) NOT NULL CHECK (unit_size >= 0.5 AND unit_size <= 5.0),
    odds_format TEXT NOT NULL CHECK (odds_format IN ('AMERICAN', 'DECIMAL', 'FRACTIONAL')),
    auto_parlay BOOLEAN DEFAULT true,
    confidence_level INTEGER NOT NULL CHECK (confidence_level >= 1 AND confidence_level <= 10),
    bet_type TEXT NOT NULL,
    market_type TEXT NOT NULL CHECK (market_type IN ('pre_game', 'live', 'player_prop', 'team_prop', 'game_prop', 'futures')),
    game_selections JSONB NOT NULL DEFAULT '[]',
    legs JSONB NOT NULL DEFAULT '[]',
    notes TEXT,
    status TEXT DEFAULT 'pending',
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    timezone TEXT DEFAULT 'UTC',
    current_step INTEGER DEFAULT 1,
    completed_steps INTEGER[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_smart_tickets_capper ON smart_tickets(capper);
CREATE INDEX idx_smart_tickets_sport ON smart_tickets(sport);
CREATE INDEX idx_smart_tickets_game_date ON smart_tickets(game_date);
CREATE INDEX idx_smart_tickets_status ON smart_tickets(status);
```

### **Step 2: Verify Table Creation**

Run this query to verify the table was created successfully:

```sql
-- Check if table exists
SELECT COUNT(*) as table_exists
FROM information_schema.tables
WHERE table_name = 'smart_tickets';

-- Check table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'smart_tickets'
ORDER BY ordinal_position;

-- Test with sample data
INSERT INTO smart_tickets (
    bet_slip_id, capper, ticket_type, sport, game_date, user_tier,
    unit_size, odds_format, confidence_level, bet_type, market_type,
    game_selections, legs, notes, status
) VALUES (
    'test-verification-' || extract(epoch from now())::bigint,
    'TestCapper',
    'single',
    'NFL',
    CURRENT_DATE,
    'vip_plus',
    2.0,
    'AMERICAN',
    8,
    'spread',
    'pre_game',
    '[{"team": "Test Team", "line": "-3", "odds": -110}]'::jsonb,
    '[]'::jsonb,
    'Verification test',
    'submitted'
);

-- Verify the test data
SELECT * FROM smart_tickets WHERE capper = 'TestCapper' ORDER BY created_at DESC LIMIT 1;
```

### **Step 3: Test the Smart Form**

**Start the development server:**

```bash
cd "unit-talk-production/unit-talk-smart form"
npm run dev
```

**Test the complete flow:**

1. Open http://localhost:3000/submit-ticket
2. Fill out the 4-step form:
   - **Step 1**: Capper name, sport, ticket type, game date
   - **Step 2**: Unit size, confidence, odds format
   - **Step 3**: Market timing, bet type
   - **Step 4**: Game selections with odds and lines
3. Submit the form
4. Check the database for the new record

### **Step 4: Integration Verification**

**Check the complete data flow:**

```sql
-- Verify recent submissions
SELECT
    id,
    capper,
    ticket_type,
    sport,
    game_date,
    unit_size,
    confidence_level,
    status,
    created_at
FROM smart_tickets
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;

-- Check for any processing errors
SELECT * FROM smart_tickets WHERE status = 'error';
```

### **Step 5: Troubleshooting**

**Common Issues and Solutions:**

1. **"relation does not exist" error**
   - ✅ Run the SQL migration again
   - ✅ Verify table name is `smart_tickets` (not `tickets`)

2. **Permission errors**
   - ✅ Ensure your Supabase anon key has insert permissions
   - ✅ Check RLS (Row Level Security) policies

3. **Form submission fails**
   - ✅ Check browser console for errors
   - ✅ Verify environment variables in `.env.local`
   - ✅ Test database connection with provided scripts

### **Step 6: Environment Variables**

Ensure your `.env.local` file contains:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4cW11em1xdG5ubHBmYXB2aWVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUwOTY4NDUsImV4cCI6MjA2MDY3Mjg0NX0.PkJJDTPo8WVpGWaAQ-gdzvyGH9WEjcxcwCDi8z0g93o
```

### **Step 7: Quick Verification Script**

Run this to test everything:

```bash
# Test database connection
node -e "
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://lxqmuzmqtnnlpfapvief.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4cW11em1xdG5ubHBmYXB2aWVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUwOTY4NDUsImV4cCI6MjA2MDY3Mjg0NX0.PkJJDTPo8WVpGWaAQ-gdzvyGH9WEjcxcwCDi8z0g93o');
supabase.from('smart_tickets').select('count').single().then(r => console.log('✅ Table exists:', r)).catch(e => console.log('❌ Error:', e.message));
"
```

## 🚀 **Next Steps**

1. **Create the table** using the SQL above
2. **Test the form** with a sample submission
3. **Verify integration** with the grading system
4. **Monitor the complete workflow** from form submission to Discord delivery

Once the table is created, your smart form will be fully functional and
integrated with the complete grading pipeline!
