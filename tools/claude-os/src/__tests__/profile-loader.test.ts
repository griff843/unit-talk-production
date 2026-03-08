/**
 * Tests for profile-loader.ts
 *
 * Verifies project profile loading and validation.
 */

import { describe, it, expect } from 'vitest';

import {
  loadProfileById,
  loadProfileFromPath,
  validateProfile,
  resolveProfilePath,
} from '../profile-loader.js';

describe('profile-loader', () => {
  describe('resolveProfilePath', () => {
    it('should resolve project ID to profile path', () => {
      const path = resolveProfilePath('unit-talk');
      expect(path).toBe('governance/claude-os/profiles/unit-talk.json');
    });
  });

  describe('loadProfileById', () => {
    it('should load the unit-talk profile successfully', () => {
      const result = loadProfileById('unit-talk');

      expect(result.success).toBe(true);
      expect(result.profile).not.toBeNull();
      expect(result.errors).toHaveLength(0);
      expect(result.profile!.projectId).toBe('unit-talk');
      expect(result.profile!.projectName).toBe('Unit Talk Platform');
    });

    it('should fail-closed on unknown project ID', () => {
      const result = loadProfileById('nonexistent-project');

      expect(result.success).toBe(false);
      expect(result.profile).toBeNull();
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('not found');
    });
  });

  describe('loadProfileFromPath', () => {
    it('should load profile from explicit path', () => {
      const result = loadProfileFromPath('governance/claude-os/profiles/unit-talk.json');

      expect(result.success).toBe(true);
      expect(result.profile).not.toBeNull();
    });

    it('should fail-closed on missing file', () => {
      const result = loadProfileFromPath('governance/claude-os/profiles/missing.json');

      expect(result.success).toBe(false);
      expect(result.profile).toBeNull();
      expect(result.errors[0]).toContain('not found');
    });
  });

  describe('validateProfile', () => {
    it('should accept a valid complete profile', () => {
      const result = loadProfileById('unit-talk');
      expect(result.success).toBe(true);

      const errors = validateProfile(result.profile);
      expect(errors).toHaveLength(0);
    });

    it('should reject null data', () => {
      const errors = validateProfile(null);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('null');
    });

    it('should reject non-object data', () => {
      const errors = validateProfile('not an object');
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should report missing required fields', () => {
      const errors = validateProfile({ profileVersion: '1.0.0' });
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.includes('Missing required field'))).toBe(true);
    });

    it('should reject non-array fields that should be arrays', () => {
      const errors = validateProfile({
        profileVersion: '1.0.0',
        projectId: 'test',
        projectName: 'Test',
        projectType: 'monorepo',
        deprecatedPaths: 'not-an-array',
        canonicalWriteTargets: [],
        runtimeSensitiveAreas: [],
        domainKeywords: {},
        verificationDefaults: {},
        lifecycleKeywords: [],
        schemaKeywords: [],
      });
      expect(errors.some(e => e.includes('must be an array'))).toBe(true);
    });

    it('should reject non-object domainKeywords', () => {
      const errors = validateProfile({
        profileVersion: '1.0.0',
        projectId: 'test',
        projectName: 'Test',
        projectType: 'monorepo',
        deprecatedPaths: [],
        canonicalWriteTargets: [],
        runtimeSensitiveAreas: [],
        domainKeywords: 'not-an-object',
        verificationDefaults: {},
        lifecycleKeywords: [],
        schemaKeywords: [],
      });
      expect(errors.some(e => e.includes('domainKeywords'))).toBe(true);
    });
  });

  describe('profile structure', () => {
    it('should have expected fields in unit-talk profile', () => {
      const result = loadProfileById('unit-talk');
      const profile = result.profile!;

      expect(profile.profileVersion).toBe('1.0.0');
      expect(profile.projectType).toBe('monorepo');
      expect(profile.deprecatedPaths.length).toBeGreaterThan(0);
      expect(profile.canonicalWriteTargets.length).toBeGreaterThan(0);
      expect(profile.runtimeSensitiveAreas.length).toBeGreaterThan(0);
      expect(Object.keys(profile.domainKeywords).length).toBeGreaterThan(0);
      expect(profile.lifecycleKeywords.length).toBeGreaterThan(0);
      expect(profile.schemaKeywords.length).toBeGreaterThan(0);
      expect(profile.verificationDefaults).toBeDefined();
      expect(profile.verificationDefaults.sprintTypeTiers).toBeDefined();
    });

    it('should have deprecated path entries with canonical targets', () => {
      const result = loadProfileById('unit-talk');
      const rawProps = result.profile!.deprecatedPaths.find(d => d.path === 'raw_props');

      expect(rawProps).toBeDefined();
      expect(rawProps!.canonical).toBe('provider_offers');
      expect(rawProps!.alternateCanonical).toBeDefined();
      expect(rawProps!.alternateCanonical!.length).toBeGreaterThan(0);
    });
  });
});
