#!/usr/bin/env tsx

/**
 * COMPREHENSIVE DUMMY DATA AUDIT
 * 
 * Find and eliminate ALL dummy, mock, stub, or hardcoded data throughout the entire repo.
 * This system must be world-class - no shortcuts, no compromises.
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import { getEnv } from '../utils/getEnv';

const logger = {
  info: (...args: any[]) => console.log('[INFO ]', ...args),
  success: (...args: any[]) => console.log('[✅  ]', ...args),
  error: (...args: any[]) => console.log('[❌  ]', ...args),
  warn: (...args: any[]) => console.log('[⚠️  ]', ...args),
  critical: (...args: any[]) => console.log('[🚨  ]', ...args),
};

interface DummyDataIssue {
  file: string;
  line: number;
  issue: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  fix: string;
}

async function comprehensiveDummyDataAudit() {
  try {
    logger.critical('🚨 COMPREHENSIVE DUMMY DATA ELIMINATION AUDIT');
    logger.critical('Target: World-class system that beats the best cappers');
    logger.info('='.repeat(80));

    const issues: DummyDataIssue[] = [];
    const repoRoot = path.resolve(__dirname, '../../../..');  // Focus on apps directory
    
    // Define dummy data patterns to search for
    const dummyDataPatterns = [
      // Hardcoded values that should be calculated
      { pattern: /playerForm:\s*0\.[0-9]/, severity: 'critical' as const, description: 'Hardcoded player form' },
      { pattern: /matchupRating:\s*0\.[0-9]/, severity: 'critical' as const, description: 'Hardcoded matchup rating' },
      { pattern: /sharpAction:\s*0\.[0-9]/, severity: 'critical' as const, description: 'Hardcoded sharp action' },
      { pattern: /publicBetting:\s*0\.[0-9]/, severity: 'critical' as const, description: 'Hardcoded public betting' },
      { pattern: /lineMovement:\s*0/, severity: 'critical' as const, description: 'Hardcoded line movement' },
      { pattern: /steamMove:\s*false/, severity: 'high' as const, description: 'Hardcoded steam detection' },
      { pattern: /injuryImpact:\s*0/, severity: 'high' as const, description: 'Hardcoded injury impact' },
      { pattern: /weatherImpact:\s*0/, severity: 'medium' as const, description: 'Hardcoded weather impact' },
      { pattern: /venueAdvantage:\s*0/, severity: 'high' as const, description: 'Hardcoded venue advantage' },
      { pattern: /motivation:\s*0\.[0-9]/, severity: 'medium' as const, description: 'Hardcoded motivation' },
      
      // Test/mock/dummy keywords
      { pattern: /test_data|mock_data|dummy_data/gi, severity: 'critical' as const, description: 'Test/mock/dummy data' },
      { pattern: /\.mock\(|mock\(/gi, severity: 'high' as const, description: 'Mock functions' },
      { pattern: /stub\(|\.stub/gi, severity: 'high' as const, description: 'Stub functions' },
      { pattern: /fake\w*data|data.*fake/gi, severity: 'high' as const, description: 'Fake data references' },
      
      // Default/placeholder values that should be real
      { pattern: /TODO:|FIXME:|HACK:/gi, severity: 'medium' as const, description: 'TODO/FIXME/HACK comments' },
      { pattern: /placeholder|example\.com/gi, severity: 'medium' as const, description: 'Placeholder values' },
      { pattern: /lorem ipsum/gi, severity: 'low' as const, description: 'Lorem ipsum text' },
      
      // Hardcoded probabilities and calculations
      { pattern: /probability.*=.*0\.[0-9]/, severity: 'critical' as const, description: 'Hardcoded probabilities' },
      { pattern: /confidence.*=.*[0-9]+/, severity: 'critical' as const, description: 'Hardcoded confidence values' },
      { pattern: /edge.*=.*[0-9.]+/, severity: 'critical' as const, description: 'Hardcoded edge values' },
    ];

    // File extensions to scan
    const extensionsToScan = ['.ts', '.js', '.tsx', '.jsx', '.json'];
    
    // Directories to exclude - add system directories
    const excludeDirs = ['node_modules', '.git', 'dist', 'build', '.next', 'coverage', 'proc', 'sys', 'dev', 'tmp'];

    async function scanDirectory(dir: string): Promise<void> {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          if (!excludeDirs.includes(entry.name)) {
            await scanDirectory(fullPath);
          }
        } else if (extensionsToScan.some(ext => entry.name.endsWith(ext))) {
          await scanFile(fullPath);
        }
      }
    }

    async function scanFile(filePath: string): Promise<void> {
      try {
        const content = await fs.promises.readFile(filePath, 'utf8');
        const lines = content.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          
          for (const pattern of dummyDataPatterns) {
            if (pattern.pattern.test(line)) {
              issues.push({
                file: path.relative(repoRoot, filePath),
                line: i + 1,
                issue: `${pattern.description}: ${line.trim()}`,
                severity: pattern.severity,
                fix: generateFix(pattern.description, line)
              });
            }
          }
        }
      } catch (error) {
        logger.warn(`⚠️  Could not scan file: ${filePath}`);
      }
    }

    function generateFix(description: string, line: string): string {
      if (description.includes('player form')) {
        return 'Calculate from L3/L5/L10 historical performance';
      } else if (description.includes('matchup rating')) {
        return 'Calculate from DVP analysis and team vs team data';
      } else if (description.includes('sharp action')) {
        return 'Implement real sharp money detection algorithm';
      } else if (description.includes('line movement')) {
        return 'Track actual line changes over time';
      } else if (description.includes('steam')) {
        return 'Implement real-time steam detection';
      } else if (description.includes('injury')) {
        return 'Parse injury reports and calculate impact';
      } else if (description.includes('venue')) {
        return 'Calculate home/away performance differentials';
      } else {
        return 'Replace with real calculated value';
      }
    }

    // Start scanning from repo root
    logger.info('🔍 Scanning entire repository for dummy data...');
    await scanDirectory(repoRoot);

    // Categorize and report issues
    const criticalIssues = issues.filter(i => i.severity === 'critical');
    const highIssues = issues.filter(i => i.severity === 'high');
    const mediumIssues = issues.filter(i => i.severity === 'medium');
    const lowIssues = issues.filter(i => i.severity === 'low');

    logger.info('\n📊 DUMMY DATA AUDIT RESULTS:');
    logger.info('='.repeat(80));
    logger.critical(`🚨 CRITICAL Issues: ${criticalIssues.length} (System-breaking dummy data)`);
    logger.error(`❌ HIGH Issues: ${highIssues.length} (Major accuracy problems)`);
    logger.warn(`⚠️  MEDIUM Issues: ${mediumIssues.length} (Minor accuracy problems)`);
    logger.info(`ℹ️  LOW Issues: ${lowIssues.length} (Cosmetic/documentation)`);

    if (criticalIssues.length > 0) {
      logger.critical('\n🚨 CRITICAL ISSUES (Must Fix for Production):');
      logger.critical('-'.repeat(60));
      criticalIssues.forEach((issue, i) => {
        logger.critical(`${i + 1}. ${issue.file}:${issue.line}`);
        logger.critical(`   Issue: ${issue.issue}`);
        logger.critical(`   Fix: ${issue.fix}`);
        logger.critical('');
      });
    }

    if (highIssues.length > 0) {
      logger.error('\n❌ HIGH PRIORITY ISSUES:');
      logger.error('-'.repeat(40));
      highIssues.slice(0, 10).forEach((issue, i) => { // Show first 10
        logger.error(`${i + 1}. ${issue.file}:${issue.line} - ${issue.issue}`);
      });
      if (highIssues.length > 10) {
        logger.error(`... and ${highIssues.length - 10} more high priority issues`);
      }
    }

    // Generate fix plan
    logger.info('\n🎯 WORLD-CLASS SYSTEM TRANSFORMATION PLAN:');
    logger.info('='.repeat(80));

    const transformationPlan = [
      {
        phase: 'Phase 1: Critical Data Elimination (2 hours)',
        tasks: [
          'Replace all hardcoded playerForm with L3/L5/L10 calculations',
          'Replace all hardcoded matchupRating with DVP analysis',
          'Replace all hardcoded sharpAction with real betting analysis',
          'Replace all hardcoded lineMovement with actual line tracking',
          'Implement proper Over/Under prediction logic'
        ]
      },
      {
        phase: 'Phase 2: Advanced Analytics (3 hours)',
        tasks: [
          'Build steam detection from real line movements',
          'Create injury impact analysis from reports',
          'Implement venue advantage calculations',
          'Add weather impact for outdoor sports',
          'Build motivational factor analysis'
        ]
      },
      {
        phase: 'Phase 3: Professional Features (2 hours)',
        tasks: [
          'Add customer unit size recommendations',
          'Implement proper tier assignment flow',
          'Create comprehensive backtesting validation',
          'Add performance tracking and alerts',
          'Build world-class reporting dashboards'
        ]
      }
    ];

    transformationPlan.forEach((phase, i) => {
      logger.success(`\n${phase.phase}:`);
      phase.tasks.forEach((task, j) => {
        logger.info(`  ${j + 1}. ${task}`);
      });
    });

    logger.info('\n🏆 SUCCESS CRITERIA FOR WORLD-CLASS SYSTEM:');
    logger.success('✅ Zero hardcoded grading values');
    logger.success('✅ All analytics calculated from real data');
    logger.success('✅ Clear Over/Under predictions with confidence');
    logger.success('✅ Customer-facing unit size recommendations');
    logger.success('✅ Performance beats best human cappers');
    logger.success('✅ Full backtesting validation');

    // Return summary for action
    return {
      totalIssues: issues.length,
      criticalIssues: criticalIssues.length,
      highIssues: highIssues.length,
      readyForProduction: criticalIssues.length === 0 && highIssues.length === 0,
      issues: issues
    };

  } catch (error) {
    logger.critical('🚨 Comprehensive audit failed:', error);
    throw error;
  }
}

if (require.main === module) {
  comprehensiveDummyDataAudit()
    .then((results) => {
      console.log(`\n📊 AUDIT COMPLETE: ${results.totalIssues} total issues found`);
      if (results.readyForProduction) {
        console.log('✅ System is ready for world-class production!');
        process.exit(0);
      } else {
        console.log(`❌ System needs ${results.criticalIssues + results.highIssues} critical fixes before production`);
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('\n🚨 Audit failed:', error);
      process.exit(1);
    });
}

export { comprehensiveDummyDataAudit };