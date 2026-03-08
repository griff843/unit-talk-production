/**
 * Tests for envelope-loader.ts
 *
 * Verifies task envelope loading, validation, and conversion.
 */

import { describe, it, expect } from 'vitest';

import { loadEnvelope, validateEnvelope, envelopeToRequest } from '../envelope-loader.js';

import type { TaskEnvelope } from '../types.js';

describe('envelope-loader', () => {
  const exampleEnvelopePath = 'governance/claude-os/envelopes/example-runtime-sprint.json';

  describe('loadEnvelope', () => {
    it('should load the example envelope successfully', () => {
      const result = loadEnvelope(exampleEnvelopePath);

      expect(result.success).toBe(true);
      expect(result.envelope).not.toBeNull();
      expect(result.errors).toHaveLength(0);
      expect(result.envelope!.taskId).toBe('SPRINT-SETTLEMENT-MIGRATION-055');
      expect(result.envelope!.taskType).toBe('runtime');
    });

    it('should fail-closed on missing file', () => {
      const result = loadEnvelope('governance/claude-os/envelopes/nonexistent.json');

      expect(result.success).toBe(false);
      expect(result.envelope).toBeNull();
      expect(result.errors[0]).toContain('not found');
    });
  });

  describe('validateEnvelope', () => {
    it('should accept a valid envelope', () => {
      const result = loadEnvelope(exampleEnvelopePath);
      const errors = validateEnvelope(result.envelope);
      expect(errors).toHaveLength(0);
    });

    it('should reject null data', () => {
      const errors = validateEnvelope(null);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should report missing required fields', () => {
      const errors = validateEnvelope({ envelopeVersion: '1.0.0' });
      expect(errors.some(e => e.includes('Missing required field'))).toBe(true);
    });

    it('should reject invalid taskType', () => {
      const errors = validateEnvelope({
        envelopeVersion: '1.0.0',
        taskId: 'SPRINT-TEST-001',
        taskType: 'invalid_type',
        projectId: 'test',
        objective: 'test',
        summary: 'test',
        touchedAreas: [],
        killConditions: [],
      });
      expect(errors.some(e => e.includes('Invalid taskType'))).toBe(true);
    });

    it('should reject non-array fields that should be arrays', () => {
      const errors = validateEnvelope({
        envelopeVersion: '1.0.0',
        taskId: 'SPRINT-TEST-001',
        taskType: 'runtime',
        projectId: 'test',
        objective: 'test',
        summary: 'test',
        touchedAreas: 'not-an-array',
        killConditions: [],
      });
      expect(errors.some(e => e.includes('must be an array'))).toBe(true);
    });

    it('should reject invalid verificationTierOverride', () => {
      const errors = validateEnvelope({
        envelopeVersion: '1.0.0',
        taskId: 'SPRINT-TEST-001',
        taskType: 'runtime',
        projectId: 'test',
        objective: 'test',
        summary: 'test',
        touchedAreas: [],
        killConditions: [],
        verificationTierOverride: 'T99',
      });
      expect(errors.some(e => e.includes('verificationTierOverride'))).toBe(true);
    });
  });

  describe('envelopeToRequest', () => {
    it('should convert envelope to SprintExecutionRequest', () => {
      const result = loadEnvelope(exampleEnvelopePath);
      const envelope = result.envelope!;
      const request = envelopeToRequest(envelope);

      expect(request.sprintId).toBe(envelope.taskId);
      expect(request.sprintType).toBe(envelope.taskType);
      expect(request.summary).toBe(envelope.summary);
      expect(request.objective).toBe(envelope.objective);
      expect(request.touchedAreas).toEqual(envelope.touchedAreas);
      expect(request.runtimeProofRequired).toBe(envelope.runtimeProofRequired);
    });
  });
});
