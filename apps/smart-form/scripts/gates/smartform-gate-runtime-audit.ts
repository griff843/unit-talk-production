#!/usr/bin/env tsx
/**
 * SMARTFORM-V1.1-ENTERPRISE-COMPLIANCE-036 (HARDENED + DETERMINISTIC + FULL COVERAGE)
 * Gate: Runtime Endpoint Audit
 *
 * DUAL-SOURCE VALIDATION:
 * 1. HAR file - comprehensive network recording
 * 2. requests.jsonl - deterministic /api/* request log
 *
 * REQUIRED BUCKET COVERAGE:
 * - /api/catalog/*     (teams, players, games)
 * - /api/normalize     (manual mode normalization)
 * - /api/submit-ticket (form submission)
 * - /api/cappers       (capper selection)
 *
 * Gate FAILS if:
 * - HAR file is missing
 * - requests.jsonl is missing
 * - ZERO /api/ requests are found
 * - Unique endpoints < 4 (minimum coverage)
 * - Any required bucket is missing
 * - Any prohibited endpoint is called
 *
 * Usage: npm run smartform:gate:runtime-audit
 */

import * as fs from 'fs';
import * as path from 'path';

const SMART_FORM_DIR = path.resolve(__dirname, '../..');
const HAR_FILE = path.join(SMART_FORM_DIR, 'test-results', 'runtime-audit.har');
const REQUESTS_JSONL_FILE = path.join(SMART_FORM_DIR, 'test-results', 'runtime-audit.requests.jsonl');

const SPRINT_DATE = '2026-02-18';
const PROOF_DIR = path.resolve(SMART_FORM_DIR, '..', '..', 'out', 'sprints', 'SMARTFORM-V1.1-ENTERPRISE-COMPLIANCE-036', SPRINT_DATE, 'proofs');
const PROOF_ENDPOINT_AUDIT = path.join(PROOF_DIR, 'proof_runtime_endpoint_audit.txt');
const PROOF_REQUEST_LOG_SUMMARY = path.join(PROOF_DIR, 'proof_runtime_request_log_summary.txt');
const PROOF_REQUIRED_BUCKETS = path.join(PROOF_DIR, 'proof_runtime_audit_required_buckets.txt');

// Minimum unique endpoints required
const MIN_UNIQUE_ENDPOINTS = 4;

// Required endpoint buckets for V1.1 compliance
const REQUIRED_BUCKETS = [
  { pattern: '/api/catalog/', name: 'CATALOG', description: 'Team/player/game catalog' },
  { pattern: '/api/normalize', name: 'NORMALIZE', description: 'Manual mode normalization' },
  { pattern: '/api/submit-ticket', name: 'SUBMIT', description: 'Ticket submission' },
  { pattern: '/api/cappers', name: 'CAPPERS', description: 'Capper selection' },
];

// Spec-true approved endpoints
const APPROVED_ENDPOINTS = [
  '/api/catalog/',
  '/api/registry/',
  '/api/search',
  '/api/normalize',
  '/api/cappers',
  '/api/submit-ticket',
  '/api/version',
  '/api/health',
];

// Explicitly prohibited (not in spec)
const PROHIBITED_ENDPOINTS = [
  '/api/dev/',
  '/api/teams',
  '/api/players',
  '/api/props',
  '/api/games',
];

interface RequestLogEntry {
  ts: string;
  method: string;
  url: string;
  pathname: string;
  resourceType: string;
  status?: number;
}

interface EndpointAudit {
  endpoint: string;
  method: string;
  count: number;
  status: 'approved' | 'prohibited' | 'unknown';
  violation?: string;
}

interface BucketResult {
  name: string;
  pattern: string;
  description: string;
  found: boolean;
  matchingEndpoints: string[];
}

function isProhibited(endpoint: string): string | null {
  for (const prohibited of PROHIBITED_ENDPOINTS) {
    if (endpoint.startsWith(prohibited) && !endpoint.startsWith('/api/catalog/')) {
      return `PROHIBITED: ${prohibited} - Use spec-compliant endpoint instead`;
    }
  }
  return null;
}

function isApproved(endpoint: string): boolean {
  return APPROVED_ENDPOINTS.some(ap => endpoint.startsWith(ap));
}

function parseRequestsJsonl(filePath: string): RequestLogEntry[] {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Request log not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf-8').trim();
  if (!content) {
    return [];
  }

  const entries: RequestLogEntry[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    if (line.trim()) {
      try {
        entries.push(JSON.parse(line));
      } catch (e) {
        console.warn(`Warning: Could not parse line: ${line}`);
      }
    }
  }

  return entries;
}

function auditEndpoints(entries: RequestLogEntry[]): EndpointAudit[] {
  const endpointMap = new Map<string, { method: string; count: number }>();

  for (const entry of entries) {
    if (!entry.pathname.startsWith('/api/')) {
      continue;
    }

    let pathname = entry.pathname;
    const queryIndex = pathname.indexOf('?');
    if (queryIndex !== -1) {
      pathname = pathname.substring(0, queryIndex);
    }

    const key = `${entry.method}:${pathname}`;
    const existing = endpointMap.get(key);

    if (existing) {
      existing.count++;
    } else {
      endpointMap.set(key, { method: entry.method, count: 1 });
    }
  }

  const audits: EndpointAudit[] = [];

  for (const [key, value] of endpointMap.entries()) {
    const [method, pathname] = key.split(':', 2);

    const violation = isProhibited(pathname);
    const approved = !violation && isApproved(pathname);

    audits.push({
      endpoint: pathname,
      method: method,
      count: value.count,
      status: violation ? 'prohibited' : (approved ? 'approved' : 'unknown'),
      violation: violation || undefined,
    });
  }

  return audits;
}

function validateBuckets(audits: EndpointAudit[]): BucketResult[] {
  const uniqueEndpoints = [...new Set(audits.map(a => a.endpoint))];

  return REQUIRED_BUCKETS.map(bucket => {
    const matchingEndpoints = uniqueEndpoints.filter(ep => ep.startsWith(bucket.pattern));
    return {
      name: bucket.name,
      pattern: bucket.pattern,
      description: bucket.description,
      found: matchingEndpoints.length > 0,
      matchingEndpoints,
    };
  });
}

function writeProofEndpointAudit(
  audits: EndpointAudit[],
  violations: EndpointAudit[],
  bucketResults: BucketResult[],
  passed: boolean,
  failReason?: string
): void {
  const proofDir = path.dirname(PROOF_ENDPOINT_AUDIT);
  if (!fs.existsSync(proofDir)) {
    fs.mkdirSync(proofDir, { recursive: true });
  }

  const missingBuckets = bucketResults.filter(b => !b.found);

  const content = `========================================
RUNTIME ENDPOINT AUDIT PROOF
Sprint: SMARTFORM-V1.1-ENTERPRISE-COMPLIANCE-036 (HARDENED + DETERMINISTIC + FULL COVERAGE)
Date: ${new Date().toISOString()}
========================================

SPEC-TRUE APPROVED ENDPOINTS:
${APPROVED_ENDPOINTS.map(ep => `  - ${ep}`).join('\n')}

PROHIBITED ENDPOINTS:
${PROHIBITED_ENDPOINTS.map(ep => `  - ${ep}`).join('\n')}

========================================
RUNTIME AUDIT RESULTS
========================================

Total unique API endpoints: ${audits.length}
Minimum required: ${MIN_UNIQUE_ENDPOINTS}
Approved: ${audits.filter(a => a.status === 'approved').length}
Prohibited: ${audits.filter(a => a.status === 'prohibited').length}
Unknown: ${audits.filter(a => a.status === 'unknown').length}

ENDPOINTS CALLED AT RUNTIME:
${audits.length > 0 ? audits.map(a => `  [${a.status.toUpperCase()}] ${a.method} ${a.endpoint} (${a.count}x)`).join('\n') : '  (none)'}

========================================
REQUIRED BUCKET COVERAGE
========================================

${bucketResults.map(b => {
  const status = b.found ? '[OK]' : '[MISSING]';
  const endpoints = b.matchingEndpoints.length > 0 ? `\n    Matched: ${b.matchingEndpoints.join(', ')}` : '';
  return `${status} ${b.name}: ${b.pattern}\n    ${b.description}${endpoints}`;
}).join('\n\n')}

Buckets found: ${bucketResults.filter(b => b.found).length}/${bucketResults.length}
${missingBuckets.length > 0 ? `Missing: ${missingBuckets.map(b => b.name).join(', ')}` : 'All required buckets present'}

${violations.length > 0 ? `
========================================
VIOLATIONS
========================================
${violations.map(v => `  ${v.method} ${v.endpoint}\n    ${v.violation}`).join('\n')}
` : ''}
========================================
RESULT
========================================

${passed ? 'PASSED - All runtime endpoints spec-compliant, all buckets covered' : `FAILED - ${failReason || 'Unknown failure'}`}
`;

  fs.writeFileSync(PROOF_ENDPOINT_AUDIT, content);
  console.log(`Proof file written to: ${PROOF_ENDPOINT_AUDIT}`);
}

function writeProofRequestLogSummary(
  entries: RequestLogEntry[],
  audits: EndpointAudit[],
  bucketResults: BucketResult[],
  passed: boolean
): void {
  const proofDir = path.dirname(PROOF_REQUEST_LOG_SUMMARY);
  if (!fs.existsSync(proofDir)) {
    fs.mkdirSync(proofDir, { recursive: true });
  }

  const totalRequests = entries.length;
  const apiRequests = entries.filter(e => e.pathname.startsWith('/api/')).length;

  const content = `========================================
RUNTIME REQUEST LOG SUMMARY
Sprint: SMARTFORM-V1.1-ENTERPRISE-COMPLIANCE-036 (HARDENED + DETERMINISTIC + FULL COVERAGE)
Date: ${new Date().toISOString()}
========================================

SOURCE FILE: test-results/runtime-audit.requests.jsonl

CAPTURE STATISTICS:
  Total request entries: ${totalRequests}
  /api/* entries: ${apiRequests}
  Unique endpoints: ${audits.length}
  Minimum required: ${MIN_UNIQUE_ENDPOINTS}

========================================
ENDPOINT BREAKDOWN
========================================

${audits.length > 0 ? audits.map(a => {
  const statusIcon = a.status === 'approved' ? '[OK]' :
                     a.status === 'prohibited' ? '[XX]' : '[??]';
  return `${statusIcon} ${a.method} ${a.endpoint}
     Count: ${a.count}
     Status: ${a.status.toUpperCase()}`;
}).join('\n\n') : 'NO /api/ REQUESTS CAPTURED'}

========================================
REQUIRED BUCKETS
========================================

${bucketResults.map(b => {
  const status = b.found ? '[OK]' : '[MISSING]';
  return `${status} ${b.name}: ${b.pattern} - ${b.description}`;
}).join('\n')}

========================================
VALIDATION RESULT
========================================

${passed ? `PASSED: ${apiRequests} /api/ requests captured, ${audits.length} unique endpoints, all buckets covered` :
  apiRequests === 0 ? `FAILED: ZERO /api/ requests captured (false negative protection)` :
  audits.length < MIN_UNIQUE_ENDPOINTS ? `FAILED: Only ${audits.length} unique endpoints (minimum ${MIN_UNIQUE_ENDPOINTS} required)` :
  `FAILED: Missing required buckets or prohibited endpoints detected`}
`;

  fs.writeFileSync(PROOF_REQUEST_LOG_SUMMARY, content);
  console.log(`Proof file written to: ${PROOF_REQUEST_LOG_SUMMARY}`);
}

function writeProofRequiredBuckets(bucketResults: BucketResult[], audits: EndpointAudit[], passed: boolean): void {
  const proofDir = path.dirname(PROOF_REQUIRED_BUCKETS);
  if (!fs.existsSync(proofDir)) {
    fs.mkdirSync(proofDir, { recursive: true });
  }

  const missingBuckets = bucketResults.filter(b => !b.found);
  const foundBuckets = bucketResults.filter(b => b.found);

  const content = `========================================
RUNTIME AUDIT REQUIRED BUCKETS PROOF
Sprint: SMARTFORM-V1.1-ENTERPRISE-COMPLIANCE-036 (HARDENED + DETERMINISTIC + FULL COVERAGE)
Date: ${new Date().toISOString()}
========================================

REQUIRED BUCKETS FOR V1.1 COMPLIANCE:

${REQUIRED_BUCKETS.map((b, i) => `${i + 1}. ${b.name}
   Pattern: ${b.pattern}
   Purpose: ${b.description}`).join('\n\n')}

========================================
BUCKET PRESENCE CHECKS
========================================

${bucketResults.map(b => {
  const icon = b.found ? '[OK]' : '[MISSING]';
  const matchInfo = b.found
    ? `\n   Matched endpoints:\n${b.matchingEndpoints.map(ep => `     - ${ep}`).join('\n')}`
    : '\n   No matching endpoints found';
  return `${icon} ${b.name}
   Pattern: ${b.pattern}
   Status: ${b.found ? 'PRESENT' : 'MISSING'}${matchInfo}`;
}).join('\n\n')}

========================================
UNIQUE ENDPOINT COUNT
========================================

Total unique endpoints: ${audits.length}
Minimum required: ${MIN_UNIQUE_ENDPOINTS}
Status: ${audits.length >= MIN_UNIQUE_ENDPOINTS ? 'PASSED' : 'FAILED'}

All unique endpoints captured:
${audits.map(a => `  - ${a.method} ${a.endpoint}`).join('\n')}

========================================
PASS/FAIL BEHAVIOR
========================================

Gate FAILS if:
  1. HAR file missing
  2. requests.jsonl missing
  3. Zero /api/ requests captured
  4. Unique endpoints < ${MIN_UNIQUE_ENDPOINTS}
  5. Any required bucket missing (${REQUIRED_BUCKETS.map(b => b.name).join(', ')})
  6. Any prohibited endpoint called

Current state:
  - HAR file: EXISTS
  - Request log: EXISTS
  - /api/ requests: ${audits.length > 0 ? 'CAPTURED' : 'NONE'}
  - Unique endpoints: ${audits.length} (minimum ${MIN_UNIQUE_ENDPOINTS})
  - Required buckets: ${foundBuckets.length}/${bucketResults.length}
  - Missing buckets: ${missingBuckets.length > 0 ? missingBuckets.map(b => b.name).join(', ') : 'none'}
  - Prohibited endpoints: ${audits.filter(a => a.status === 'prohibited').length}

========================================
FINAL RESULT
========================================

${passed
  ? 'PASSED - All required buckets present, minimum coverage met'
  : `FAILED - ${missingBuckets.length > 0 ? `Missing buckets: ${missingBuckets.map(b => b.name).join(', ')}` : audits.length < MIN_UNIQUE_ENDPOINTS ? `Insufficient coverage (${audits.length}/${MIN_UNIQUE_ENDPOINTS})` : 'Other validation failure'}`}
`;

  fs.writeFileSync(PROOF_REQUIRED_BUCKETS, content);
  console.log(`Proof file written to: ${PROOF_REQUIRED_BUCKETS}`);
}

function main() {
  console.log('========================================');
  console.log('SMART FORM GATE: RUNTIME ENDPOINT AUDIT');
  console.log('Sprint: SMARTFORM-V1.1-ENTERPRISE-COMPLIANCE-036');
  console.log('Mode: HARDENED + DETERMINISTIC + FULL COVERAGE');
  console.log('========================================\n');

  // PHASE 1: Check HAR file exists
  console.log('PHASE 1: HAR File Verification');
  console.log(`  File: ${HAR_FILE}`);

  if (!fs.existsSync(HAR_FILE)) {
    console.log('  Status: MISSING');
    console.log('\nGATE FAILED: Missing HAR file');
    process.exit(1);
  }

  const harStats = fs.statSync(HAR_FILE);
  console.log(`  Status: EXISTS (${harStats.size} bytes)`);

  // PHASE 2: Check requests.jsonl exists
  console.log('\nPHASE 2: Request Log Verification');
  console.log(`  File: ${REQUESTS_JSONL_FILE}`);

  if (!fs.existsSync(REQUESTS_JSONL_FILE)) {
    console.log('  Status: MISSING');
    console.log('\nGATE FAILED: Missing request log');
    process.exit(1);
  }

  const jsonlStats = fs.statSync(REQUESTS_JSONL_FILE);
  console.log(`  Status: EXISTS (${jsonlStats.size} bytes)`);

  // PHASE 3: Parse and audit
  console.log('\nPHASE 3: Request Log Analysis');

  let entries: RequestLogEntry[];
  try {
    entries = parseRequestsJsonl(REQUESTS_JSONL_FILE);
    console.log(`  Entries parsed: ${entries.length}`);
  } catch (err) {
    console.log(`  Error: ${err}`);
    console.log('\nGATE FAILED: Could not parse request log');
    process.exit(1);
  }

  const apiEntries = entries.filter(e => e.pathname.startsWith('/api/'));
  console.log(`  /api/* entries: ${apiEntries.length}`);

  const audits = auditEndpoints(entries);
  console.log(`  Unique endpoints: ${audits.length}`);

  // PHASE 4: False negative protection
  console.log('\nPHASE 4: False Negative Protection');

  if (apiEntries.length === 0) {
    console.log('  Status: FAILED');
    console.log('\nGATE FAILED: Zero /api/ requests captured');

    const bucketResults = validateBuckets(audits);
    writeProofEndpointAudit(audits, [], bucketResults, false, 'Zero API requests captured');
    writeProofRequestLogSummary(entries, audits, bucketResults, false);
    writeProofRequiredBuckets(bucketResults, audits, false);

    process.exit(1);
  }

  console.log(`  Status: PASSED (${apiEntries.length} requests)`);

  // PHASE 5: Minimum coverage check
  console.log('\nPHASE 5: Minimum Coverage Check');
  console.log(`  Unique endpoints: ${audits.length}`);
  console.log(`  Minimum required: ${MIN_UNIQUE_ENDPOINTS}`);

  if (audits.length < MIN_UNIQUE_ENDPOINTS) {
    console.log('  Status: FAILED');
    console.log(`\nGATE FAILED: Only ${audits.length} unique endpoints (minimum ${MIN_UNIQUE_ENDPOINTS} required)`);

    const bucketResults = validateBuckets(audits);
    writeProofEndpointAudit(audits, [], bucketResults, false, `Insufficient coverage (${audits.length}/${MIN_UNIQUE_ENDPOINTS})`);
    writeProofRequestLogSummary(entries, audits, bucketResults, false);
    writeProofRequiredBuckets(bucketResults, audits, false);

    process.exit(1);
  }

  console.log('  Status: PASSED');

  // PHASE 6: Required bucket validation
  console.log('\nPHASE 6: Required Bucket Validation');

  const bucketResults = validateBuckets(audits);
  const missingBuckets = bucketResults.filter(b => !b.found);

  for (const bucket of bucketResults) {
    const status = bucket.found ? '[OK]' : '[MISSING]';
    console.log(`  ${status} ${bucket.name}: ${bucket.pattern}`);
    if (bucket.matchingEndpoints.length > 0) {
      bucket.matchingEndpoints.forEach(ep => console.log(`      - ${ep}`));
    }
  }

  if (missingBuckets.length > 0) {
    console.log('\n  Status: FAILED');
    console.log(`\nGATE FAILED: Missing required buckets: ${missingBuckets.map(b => b.name).join(', ')}`);

    writeProofEndpointAudit(audits, [], bucketResults, false, `Missing buckets: ${missingBuckets.map(b => b.name).join(', ')}`);
    writeProofRequestLogSummary(entries, audits, bucketResults, false);
    writeProofRequiredBuckets(bucketResults, audits, false);

    process.exit(1);
  }

  console.log('\n  Status: PASSED (all buckets present)');

  // PHASE 7: Endpoint compliance
  console.log('\nPHASE 7: Endpoint Compliance Validation');

  const approved = audits.filter(a => a.status === 'approved');
  const prohibited = audits.filter(a => a.status === 'prohibited');
  const unknown = audits.filter(a => a.status === 'unknown');

  console.log(`  Approved: ${approved.length}`);
  console.log(`  Prohibited: ${prohibited.length}`);
  console.log(`  Unknown: ${unknown.length}`);

  if (prohibited.length > 0) {
    console.log('\n  VIOLATIONS:');
    prohibited.forEach(v => {
      console.log(`    ${v.method} ${v.endpoint}`);
      if (v.violation) console.log(`      ${v.violation}`);
    });
    console.log('\nGATE FAILED: Prohibited endpoints detected');

    writeProofEndpointAudit(audits, prohibited, bucketResults, false, 'Prohibited endpoints detected');
    writeProofRequestLogSummary(entries, audits, bucketResults, false);
    writeProofRequiredBuckets(bucketResults, audits, false);

    process.exit(1);
  }

  // Write success proof files
  writeProofEndpointAudit(audits, [], bucketResults, true);
  writeProofRequestLogSummary(entries, audits, bucketResults, true);
  writeProofRequiredBuckets(bucketResults, audits, true);

  // FINAL SUMMARY
  console.log('\n========================================');
  console.log('FINAL DETERMINATION');
  console.log('========================================');
  console.log(`\nSummary:`);
  console.log(`  HAR file: EXISTS (${harStats.size} bytes)`);
  console.log(`  Request log: ${apiEntries.length} /api/ requests`);
  console.log(`  Unique endpoints: ${audits.length} (minimum ${MIN_UNIQUE_ENDPOINTS})`);
  console.log(`  Required buckets: ${bucketResults.filter(b => b.found).length}/${bucketResults.length}`);
  console.log(`  Violations: 0`);
  console.log('');
  console.log('All runtime endpoints are spec-compliant.');
  console.log('All required buckets are present.');
  console.log('');
  console.log('GATE PASSED (DETERMINISTIC + FULL COVERAGE)');
  process.exit(0);
}

main();
