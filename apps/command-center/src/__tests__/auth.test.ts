/**
 * Tests for server-side auth identity helper.
 * SPRINT-049-LAYER3-PHASE10-CC-AUTH-FOUNDATION
 */

import { describe, it, expect } from 'vitest';

import { getOperatorIdentity, requireOperatorIdentity } from '@/lib/auth';

// Minimal NextRequest mock — only needs headers.get()
function mockRequest(headers: Record<string, string> = {}) {
  return {
    headers: {
      get(name: string) {
        return headers[name.toLowerCase()] ?? null;
      },
    },
  } as any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

describe('getOperatorIdentity', () => {
  it('returns userId from x-user-id header', () => {
    const req = mockRequest({ 'x-user-id': 'operator-42' });
    const result = getOperatorIdentity(req);
    expect(result).toEqual({ userId: 'operator-42', source: 'header' });
  });

  it('trims whitespace from userId', () => {
    const req = mockRequest({ 'x-user-id': '  operator-42  ' });
    const result = getOperatorIdentity(req);
    expect(result.userId).toBe('operator-42');
    expect(result.source).toBe('header');
  });

  it('returns anonymous when header is missing', () => {
    const req = mockRequest({});
    const result = getOperatorIdentity(req);
    expect(result).toEqual({ userId: 'anonymous', source: 'anonymous' });
  });

  it('returns anonymous when header is empty string', () => {
    const req = mockRequest({ 'x-user-id': '' });
    const result = getOperatorIdentity(req);
    expect(result).toEqual({ userId: 'anonymous', source: 'anonymous' });
  });

  it('returns anonymous when header is whitespace-only', () => {
    const req = mockRequest({ 'x-user-id': '   ' });
    const result = getOperatorIdentity(req);
    expect(result).toEqual({ userId: 'anonymous', source: 'anonymous' });
  });
});

describe('requireOperatorIdentity', () => {
  it('returns identity when x-user-id header is present', () => {
    const req = mockRequest({ 'x-user-id': 'admin-1' });
    const result = requireOperatorIdentity(req);
    expect(result).not.toBeNull();
    expect(result!.userId).toBe('admin-1');
    expect(result!.source).toBe('header');
  });

  it('returns null when header is missing', () => {
    const req = mockRequest({});
    const result = requireOperatorIdentity(req);
    expect(result).toBeNull();
  });

  it('returns null when header is empty', () => {
    const req = mockRequest({ 'x-user-id': '' });
    const result = requireOperatorIdentity(req);
    expect(result).toBeNull();
  });
});
