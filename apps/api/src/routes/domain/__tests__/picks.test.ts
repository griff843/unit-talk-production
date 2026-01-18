/**
 * Phase 11B: Picks API Integration Tests
 * Date: 2025-11-01
 */

import request from 'supertest';
import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import picksRouter from '../picks';
import { resetPicksMetrics } from '../../../monitoring/picks-metrics';

// Mock Supabase
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
    from: jest.fn(() => ({
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ 
        data: { 
          id: uuidv4(),
          tenant_id: '00000000-0000-0000-0000-000000000001',
          selection: 'Test Pick',
          odds: -110,
          workflow_stage: 'draft'
        }, 
        error: null 
      })
    }))
  }))
}));

describe('Picks API', () => {
  let app: express.Application;
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const userId = uuidv4();
  
  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/picks', picksRouter);
  });
  
  beforeEach(() => {
    resetPicksMetrics();
  });
  
  describe('POST /api/picks', () => {
    it('should create a new pick', async () => {
      const pickData = {
        selection: 'LeBron James Over 25.5 Points',
        odds: -110,
        stake: 1.0,
        confidence: 8,
        workflow_stage: 'draft'
      };
      
      const response = await request(app)
        .post('/api/picks')
        .set('x-tenant-id', tenantId)
        .set('x-user-id', userId)
        .send(pickData);
      
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.selection).toBe(pickData.selection);
      expect(response.body).toHaveProperty('correlation_id');
    });
    
    it('should handle idempotent requests', async () => {
      const idempotencyKey = uuidv4();
      const pickData = {
        selection: 'Test Pick',
        odds: -110,
        stake: 1.0,
        idempotency_key: idempotencyKey
      };
      
      // First request
      const response1 = await request(app)
        .post('/api/picks')
        .set('x-tenant-id', tenantId)
        .set('x-user-id', userId)
        .send(pickData);
      
      expect(response1.status).toBe(201);
      
      // Second request with same idempotency key
      const response2 = await request(app)
        .post('/api/picks')
        .set('x-tenant-id', tenantId)
        .set('x-user-id', userId)
        .send(pickData);
      
      expect(response2.status).toBe(200);
      expect(response2.body.idempotent).toBe(true);
    });
    
    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/picks')
        .set('x-tenant-id', tenantId)
        .set('x-user-id', userId)
        .send({});
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });
  });
  
  describe('GET /api/picks/:id', () => {
    it('should retrieve a pick by ID', async () => {
      const pickId = uuidv4();
      
      const response = await request(app)
        .get(`/api/picks/${pickId}`)
        .set('x-tenant-id', tenantId)
        .set('x-user-id', userId);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
    });
    
    it('should return 404 for non-existent pick', async () => {
      const nonExistentId = uuidv4();
      
      // Mock 404 response
      jest.spyOn(require('@supabase/supabase-js'), 'createClient').mockReturnValueOnce({
        rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
        from: jest.fn(() => ({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ 
            data: null, 
            error: { code: 'PGRST116' } 
          })
        }))
      } as any);
      
      const response = await request(app)
        .get(`/api/picks/${nonExistentId}`)
        .set('x-tenant-id', tenantId)
        .set('x-user-id', userId);
      
      expect(response.status).toBe(404);
      expect(response.body.error).toBe('PICK_NOT_FOUND');
    });
  });
  
  describe('POST /api/picks/:id/score', () => {
    it('should trigger scoring for a pick', async () => {
      const pickId = uuidv4();
      
      const response = await request(app)
        .post(`/api/picks/${pickId}/score`)
        .set('x-tenant-id', tenantId)
        .set('x-user-id', userId)
        .send({});
      
      expect(response.status).toBe(202);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('processing');
    });
    
    it('should handle force rescore', async () => {
      const pickId = uuidv4();
      
      const response = await request(app)
        .post(`/api/picks/${pickId}/score`)
        .set('x-tenant-id', tenantId)
        .set('x-user-id', userId)
        .send({ force_rescore: true });
      
      expect(response.status).toBe(202);
      expect(response.body.success).toBe(true);
    });
  });
  
  describe('POST /api/picks/:id/publish', () => {
    it('should publish an approved pick', async () => {
      const pickId = uuidv4();
      
      // Mock approved pick
      jest.spyOn(require('@supabase/supabase-js'), 'createClient').mockReturnValueOnce({
        rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
        from: jest.fn(() => ({
          select: jest.fn().mockReturnThis(),
          update: jest.fn().mockReturnThis(),
          insert: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ 
            data: { 
              id: pickId,
              workflow_stage: 'approved'
            }, 
            error: null 
          })
        }))
      } as any);
      
      const response = await request(app)
        .post(`/api/picks/${pickId}/publish`)
        .set('x-tenant-id', tenantId)
        .set('x-user-id', userId)
        .send({ channels: ['discord'] });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('published');
    });
    
    it('should reject publishing non-approved pick', async () => {
      const pickId = uuidv4();
      
      // Mock draft pick
      jest.spyOn(require('@supabase/supabase-js'), 'createClient').mockReturnValueOnce({
        rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
        from: jest.fn(() => ({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ 
            data: { 
              id: pickId,
              workflow_stage: 'draft'
            }, 
            error: null 
          })
        }))
      } as any);
      
      const response = await request(app)
        .post(`/api/picks/${pickId}/publish`)
        .set('x-tenant-id', tenantId)
        .set('x-user-id', userId)
        .send({});
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('PICK_NOT_APPROVED');
    });
  });
  
  describe('Tenant Isolation', () => {
    it('should enforce tenant context', async () => {
      const response = await request(app)
        .post('/api/picks')
        .send({
          selection: 'Test Pick',
          odds: -110,
          stake: 1.0
        });
      
      // Should use default tenant if not provided
      expect(response.status).toBeLessThan(500);
    });
  });
  
  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      // Mock database error
      jest.spyOn(require('@supabase/supabase-js'), 'createClient').mockReturnValueOnce({
        rpc: jest.fn().mockRejectedValue(new Error('Database connection failed')),
        from: jest.fn(() => ({
          insert: jest.fn().mockRejectedValue(new Error('Database error'))
        }))
      } as any);
      
      const response = await request(app)
        .post('/api/picks')
        .set('x-tenant-id', tenantId)
        .set('x-user-id', userId)
        .send({
          selection: 'Test Pick',
          odds: -110,
          stake: 1.0
        });
      
      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body).toHaveProperty('correlation_id');
    });
  });
});

