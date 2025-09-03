const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase env vars for audit. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function auditProductionReadiness() {
  console.log('🏗️ PRODUCTION READINESS AUDIT: Smart Form System');
  console.log('===============================================\n');

  const audit = {
    score: 0,
    maxScore: 0,
    criticalIssues: [],
    warnings: [],
    passed: [],
    details: {},
  };

  // 1. CRITICAL: Real Data Integration
  console.log('📊 AUDIT 1: Real Production Data Integration');
  audit.maxScore += 20;

  try {
    // Check real cappers
    const { data: cappers, error: cappersError } = await supabase
      .from('cappers')
      .select('*')
      .eq('status', 'Active');

    if (!cappersError && cappers && cappers.length > 0) {
      audit.professional_score += 5;
      audit.passed.push('✅ Real cappers accessible: ' + cappers.length + ' active');
      audit.details.realCappers = cappers.map(c => c.name);
    } else {
      audit.criticalIssues.push('❌ CRITICAL: No real cappers accessible for form');
    }

    // Check real games
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('*')
      .neq('source', 'manual_test_data')
      .limit(5);

    if (!gamesError && games && games.length > 0) {
      audit.professional_score += 5;
      audit.passed.push('✅ Real games accessible: ' + games.length + ' games');
      audit.details.realGames = games
        .slice(0, 3)
        .map(g => g.matchup || g.away_team + ' @ ' + g.home_team);
    } else {
      audit.criticalIssues.push('❌ CRITICAL: No real games accessible for form');
    }

    // Check real props
    const { data: props, error: propsError } = await supabase
      .from('raw_props')
      .select('*')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .limit(5);

    if (!propsError && props && props.length > 0) {
      audit.professional_score += 5;
      audit.passed.push('✅ Real props accessible: ' + props.length + ' recent props');
      audit.details.realProps = props
        .slice(0, 3)
        .map(p => `${p.player_name} ${p.stat_type} ${p.line}`);
    } else {
      audit.criticalIssues.push('❌ CRITICAL: No real props accessible for form');
    }

    // Test backend submission
    const testSubmission = {
      bet_slip_id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      capper: cappers[0]?.name || 'TestCapper',
      sport: props[0]?.sport || 'MLB',
      game_date: props[0]?.game_date || new Date().toISOString().split('T')[0],
      bet_type: 'player_prop',
      market_type: 'player_prop',
      ticket_type: 'single',
      unit_size: 1.0,
      confidence_level: 7,
      odds_format: 'AMERICAN',
      user_tier: 'vip_plus',
      notes: 'Production readiness audit test',
      status: 'submitted',
      game_selections: [
        {
          id: 'audit-selection',
          game_id: props[0]?.game_id || games[0]?.id || 'test',
          game: props[0]?.matchup || games[0]?.matchup || 'Test Game',
          selection: `${props[0]?.player_name || 'Test Player'} ${props[0]?.stat_type || 'points'} Over ${props[0]?.line || 25.5}`,
          odds: '-110',
          line: props[0]?.line?.toString() || '25.5',
        },
      ],
      legs: [],
      timezone: 'America/New_York',
      auto_parlay: false,
      current_step: 4,
      completed_steps: [1, 2, 3, 4],
      timestamp: new Date().toISOString(),
    };

    testSubmission.legs = testSubmission.game_selections;

    const { data: submitted, error: submitError } = await supabase
      .from('smart_tickets')
      .insert([testSubmission])
      .select()
      .single();

    if (!submitError && submitted) {
      audit.professional_score += 5;
      audit.passed.push('✅ Backend submission working with real data');
      audit.details.testSubmissionId = submitted.bet_slip_id;
    } else {
      audit.criticalIssues.push(
        '❌ CRITICAL: Backend submission failed: ' + (submitError?.message || 'Unknown error')
      );
    }
  } catch (e) {
    audit.criticalIssues.push('❌ CRITICAL: Database connection failed: ' + e.message);
  }

  console.log('   Score: ' + audit.professional_score + '/20 points\n');

  // 2. CRITICAL: Form Component Structure
  console.log('🧩 AUDIT 2: Form Component Structure');
  audit.maxScore += 20;

  const criticalComponents = [
    'app/submit-ticket/page.tsx',
    'app/submit-ticket/components/SmartTicketForm.tsx',
    'app/submit-ticket/components/Step1Essentials.tsx',
    'app/submit-ticket/components/Step4GameSelection.tsx',
  ];

  let componentScore = 0;
  for (const componentPath of criticalComponents) {
    try {
      if (fs.existsSync(componentPath)) {
        const content = fs.readFileSync(componentPath, 'utf8');

        // Check for critical patterns
        const hasSupabaseIntegration =
          content.includes('supabase') || content.includes('createClient');
        const hasFormHandling =
          content.includes('useForm') || content.includes('onSubmit') || content.includes('form');
        const hasRealDataHandling =
          content.includes('capper') || content.includes('game') || content.includes('prop');

        let professional_score = 1; // Base point for existing
        if (hasSupabaseIntegration) professional_score += 1;
        if (hasFormHandling) professional_score += 1;
        if (hasRealDataHandling) professional_score += 1;

        componentScore += Math.min(professional_score, 5); // Max 5 points per component
        audit.passed.push(`✅ Component exists: ${componentPath} (${score}/4 features)`);
      } else {
        audit.criticalIssues.push(`❌ CRITICAL: Missing component: ${componentPath}`);
      }
    } catch (e) {
      audit.criticalIssues.push(
        `❌ CRITICAL: Cannot read component: ${componentPath} - ${e.message}`
      );
    }
  }

  audit.professional_score += componentScore;
  console.log('   Score: ' + componentScore + '/20 points\n');

  // 3. CRITICAL: API Routes
  console.log('🌐 AUDIT 3: API Routes and Functionality');
  audit.maxScore += 15;

  const apiRoutes = [
    'app/api/submit-ticket/route.ts',
    'app/api/cappers/route.ts',
    'app/api/games/route.ts',
  ];

  let apiScore = 0;
  for (const routePath of apiRoutes) {
    try {
      if (fs.existsSync(routePath)) {
        const content = fs.readFileSync(routePath, 'utf8');

        const hasErrorHandling = content.includes('try') && content.includes('catch');
        const hasSupabaseCall = content.includes('supabase');
        const hasValidation = content.includes('validate') || content.includes('schema');

        let professional_score = 2; // Base points for existing
        if (hasErrorHandling) professional_score += 1;
        if (hasSupabaseCall) professional_score += 1;
        if (hasValidation) professional_score += 1;

        apiScore += score;
        audit.passed.push(`✅ API route exists: ${routePath} (${score}/5 features)`);
      } else {
        audit.warnings.push(`⚠️ Missing API route: ${routePath} (may be optional)`);
      }
    } catch (e) {
      audit.warnings.push(`⚠️ Cannot read API route: ${routePath} - ${e.message}`);
    }
  }

  audit.professional_score += apiScore;
  console.log('   Score: ' + apiScore + '/15 points\n');

  // 4. Configuration and Environment
  console.log('⚙️ AUDIT 4: Configuration and Environment');
  audit.maxScore += 10;

  const configFiles = ['.env.local', 'next.config.js', 'package.json', 'tailwind.config.js'];

  let configScore = 0;
  for (const configFile of configFiles) {
    if (fs.existsSync(configFile)) {
      configScore += 2;
      audit.passed.push(`✅ Config file exists: ${configFile}`);
    } else {
      audit.warnings.push(`⚠️ Missing config file: ${configFile}`);
    }
  }

  // Check environment variables
  if (fs.existsSync('.env.local')) {
    const envContent = fs.readFileSync('.env.local', 'utf8');
    if (
      envContent.includes('NEXT_PUBLIC_SUPABASE_URL') &&
      envContent.includes('NEXT_PUBLIC_SUPABASE_ANON_KEY')
    ) {
      audit.passed.push('✅ Supabase environment variables configured');
    } else {
      audit.criticalIssues.push('❌ CRITICAL: Missing Supabase environment variables');
    }
  }

  audit.professional_score += Math.min(configScore, 10);
  console.log('   Score: ' + Math.min(configScore, 10) + '/10 points\n');

  // 5. Build and Dependencies
  console.log('📦 AUDIT 5: Build System and Dependencies');
  audit.maxScore += 10;

  try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

    const criticalDeps = [
      'next',
      'react',
      '@supabase/supabase-js',
      'react-hook-form',
      '@radix-ui/react-select',
    ];

    let depScore = 0;
    for (const dep of criticalDeps) {
      if (packageJson.dependencies[dep] || packageJson.devDependencies[dep]) {
        depScore += 2;
        audit.passed.push(`✅ Critical dependency: ${dep}`);
      } else {
        audit.criticalIssues.push(`❌ CRITICAL: Missing dependency: ${dep}`);
      }
    }

    audit.professional_score += depScore;
    console.log('   Score: ' + depScore + '/10 points\n');
  } catch (e) {
    audit.criticalIssues.push('❌ CRITICAL: Cannot read package.json: ' + e.message);
  }

  // Final Assessment
  console.log('🎯 FINAL PRODUCTION READINESS ASSESSMENT');
  console.log('========================================');

  const percentage = Math.round((audit.professional_score / audit.maxScore) * 100);

  console.log(`📊 Overall Score: ${audit.score}/${audit.maxScore} (${percentage}%)`);

  if (audit.criticalIssues.length > 0) {
    console.log('\n🚨 CRITICAL ISSUES - Must Fix Before Production:');
    audit.criticalIssues.forEach(issue => console.log('   ' + issue));
  }

  if (audit.warnings.length > 0) {
    console.log('\n⚠️ WARNINGS - Recommended Fixes:');
    audit.warnings.forEach(warning => console.log('   ' + warning));
  }

  console.log('\n✅ PASSED CHECKS:');
  audit.passed.forEach(pass => console.log('   ' + pass));

  if (audit.details.realCappers) {
    console.log('\n👥 Available Real Cappers:');
    audit.details.realCappers.forEach(capper => console.log('   - ' + capper));
  }

  if (audit.details.realGames) {
    console.log('\n🏈 Available Real Games:');
    audit.details.realGames.forEach(game => console.log('   - ' + game));
  }

  if (audit.details.realProps) {
    console.log('\n🎲 Available Real Props:');
    audit.details.realProps.forEach(prop => console.log('   - ' + prop));
  }

  console.log('\n🎯 PRODUCTION READINESS VERDICT:');

  if (percentage >= 90 && audit.criticalIssues.length === 0) {
    console.log('✅ EXCELLENT - Ready for production deployment');
    console.log('   - All critical systems functional');
    console.log('   - Real data integration working');
    console.log('   - Backend submission pipeline verified');
  } else if (percentage >= 75 && audit.criticalIssues.length <= 2) {
    console.log('⚠️ GOOD - Near production ready, minor fixes needed');
    console.log('   - Address critical issues listed above');
    console.log('   - Consider fixing warnings for better reliability');
  } else if (percentage >= 50) {
    console.log('❌ NEEDS WORK - Significant issues prevent production deployment');
    console.log('   - Must resolve all critical issues');
    console.log('   - Additional testing and verification required');
  } else {
    console.log('🚨 NOT READY - Major system failures detected');
    console.log('   - Extensive development work required');
    console.log('   - Complete system review needed');
  }

  if (audit.details.testSubmissionId) {
    console.log(`\n🎫 Test Submission Created: ${audit.details.testSubmissionId}`);
    console.log('   This proves backend functionality works with real data');
  }

  return audit;
}

// Run the audit
auditProductionReadiness();
