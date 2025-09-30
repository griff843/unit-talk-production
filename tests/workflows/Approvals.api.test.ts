import { createClient } from '@supabase/supabase-js';

const ORG_ID = '00000000-0000-0000-0000-000000000000';

describe('Approvals API approve/deny', () => {
  const url = process.env.SUPABASE_URL as string;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
  const apiBase = process.env.API_BASE_URL || process.env.API_READINESS_URL?.replace('/health/ready','') || '';

  if (!url || !service || !apiBase) {
    it('skipped (missing SUPABASE_URL/SERVICE/API_BASE_URL)', () => {
      expect(true).toBe(true);
    });
    return;
  }

  const db = createClient(url, service);

  it('approve then deny flows respond and update DB', async () => {
    // Seed unified pick + approval
    const unified_id = `jest-approval-${Date.now()}`;
    const { error: insPickErr } = await db.from('unified_picks').insert({ id: unified_id, sport: 'TEST', prediction: 'NONE', score: 0, tier: 'C', org_id: ORG_ID });
    expect(insPickErr).toBeFalsy();

    const { data: apprRow, error: insApprErr } = await db
      .from('approval_queue')
      .insert({ unified_id, status: 'pending', org_id: ORG_ID })
      .select('id')
      .single();
    expect(insApprErr).toBeFalsy();

    const approvalId = apprRow!.id;

    // Approve via API
    const approveRes = await fetch(`${apiBase}/api/approval/${approvalId}/approve`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-org-id': ORG_ID },
      body: JSON.stringify({ actorId: 'ci-jest', reason: 'approve via test' })
    });
    expect(approveRes.status).toBeLessThan(400);
    const approveJson = await approveRes.json();
    expect(approveJson.success).toBe(true);

    // Verify postable view contains the unified id
    const { data: postable } = await db.from('view_postable_unified_picks').select('id').eq('id', unified_id).limit(1);
    expect((postable?.length || 0) >= 1).toBe(true);

    // Create another pending and deny via API
    const unified_id2 = `jest-approval-deny-${Date.now()}`;
    await db.from('unified_picks').insert({ id: unified_id2, sport: 'TEST', prediction: 'NONE', score: 0, tier: 'C', org_id: ORG_ID });
    const { data: appr2 } = await db.from('approval_queue').insert({ unified_id: unified_id2, status: 'pending', org_id: ORG_ID }).select('id').single();

    const denyRes = await fetch(`${apiBase}/api/approval/${appr2!.id}/deny`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-org-id': ORG_ID },
      body: JSON.stringify({ actorId: 'ci-jest', reason: 'deny via test' })
    });
    expect(denyRes.status).toBeLessThan(400);
    const denyJson = await denyRes.json();
    expect(denyJson.success).toBe(true);
  });
});

