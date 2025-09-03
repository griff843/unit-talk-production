import { jest } from '@jest/globals';
import { SupabaseClient } from '@supabase/supabase-js';

import { validatePickData, validateCapperData, validateUserData } from '../utils/testHelpers';

interface TableSchema {
  name: string;
  validate: (data: any) => boolean;
}

export class MockSupabaseClient {
  private mockData: Record<string, any[]> = {
    picks: [],
    users: [],
    cappers: [],
    coaching_sessions: [],
    trends: [],
    analytics: []
  };

  private currentQuery: {
    table: string;
    filters: Array<{
      type: string;
      field: string;
      value: any;
    }>;
    orderBy?: { field: string; ascending: boolean };
    limitCount?: number;
    rangeStart?: number;
    rangeEnd?: number;
  } | null = null;

  private tableSchemas: Record<string, TableSchema> = {
    daily_picks: {
      name: 'daily_picks',
      validate: validatePickData
    },
    cappers: {
      name: 'cappers',
      validate: validateCapperData
    },
    users: {
      name: 'users',
      validate: validateUserData
    }
  };

  constructor() {
    // Initialize with some test data
    this.mockData.users = [
      {
        id: 'test-user-1',
        discord_id: 'discord-123',
        tier: 'vip',
        created_at: new Date().toISOString()
      }
    ];
  }

  // Helper method to get mock data
  getMockData(table: string): any[] {
    return this.mockData[table] || [];
  }

  // Helper method to set mock data
  setMockData(table: string, data: any[]): void {
    // Validate data if schema exists
    if (this.tableSchemas[table]) {
      data.forEach(item => {
        try {
          this.tableSchemas[table].validate(item);
        } catch (error) {
          throw new Error(`Invalid data for table ${table}: ${error.message}`);
        }
      });
    }
    this.mockData[table] = data;
  }

  // Helper method to clear mock data
  clearMockData(): void {
    Object.keys(this.mockData).forEach(key => {
      this.mockData[key] = [];
    });
  }

  // Helper method to apply filters
  private applyFilters(data: any[]): any[] {
    if (!this.currentQuery) {return data;}

    return data.filter(item => {
      return this.currentQuery!.filters.every(filter => {
        const value = item[filter.field];
        switch (filter.type) {
          case 'eq':
            return value === filter.value;
          case 'neq':
            return value !== filter.value;
          case 'gt':
            return value > filter.value;
          case 'lt':
            return value < filter.value;
          case 'gte':
            return value >= filter.value;
          case 'lte':
            return value <= filter.value;
          case 'in':
            return Array.isArray(filter.value) && filter.value.includes(value);
          case 'contains':
            if (Array.isArray(value)) {
              return filter.value.every((v: any) => value.includes(v));
            }
            return value.includes(filter.value);
          default:
            return true;
        }
      });
    });
  }

  // Mock the from method to start a query chain
  from(table: string) {
    this.currentQuery = {
      table,
      filters: []
    };

    const chain = {
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockImplementation((data) => {
        const newData = Array.isArray(data) ? data : [data];

        // Validate data if schema exists
        if (this.tableSchemas[table]) {
          newData.forEach(item => {
            try {
              this.tableSchemas[table].validate(item);
            } catch (error) {
              return { data: null, error: error.message };
            }
          });
        }

        this.mockData[table] = [...(this.mockData[table] || []), ...newData];
        return { data: newData, error: null };
      }),
      update: jest.fn().mockImplementation((data) => {
        const filteredData = this.applyFilters(this.mockData[table] || []);

        // Validate updated data if schema exists
        if (this.tableSchemas[table]) {
          try {
            filteredData.forEach(item => {
              this.tableSchemas[table].validate({ ...item, ...data });
            });
          } catch (error) {
            return { data: null, error: error.message };
          }
        }

        filteredData.forEach(item => {
          Object.assign(item, data);
        });
        return { data: filteredData, error: null };
      }),
      delete: jest.fn().mockImplementation(() => {
        const filteredData = this.applyFilters(this.mockData[table] || []);
        this.mockData[table] = this.mockData[table].filter(item => !filteredData.includes(item));
        return { data: null, error: null };
      }),
      eq: jest.fn().mockImplementation((field: string, value: any) => {
        this.currentQuery!.filters.push({ type: 'eq', field, value });
        return chain;
      }),
      neq: jest.fn().mockImplementation((field: string, value: any) => {
        this.currentQuery!.filters.push({ type: 'neq', field, value });
        return chain;
      }),
      gt: jest.fn().mockImplementation((field: string, value: any) => {
        this.currentQuery!.filters.push({ type: 'gt', field, value });
        return chain;
      }),
      lt: jest.fn().mockImplementation((field: string, value: any) => {
        this.currentQuery!.filters.push({ type: 'lt', field, value });
        return chain;
      }),
      gte: jest.fn().mockImplementation((field: string, value: any) => {
        this.currentQuery!.filters.push({ type: 'gte', field, value });
        return chain;
      }),
      lte: jest.fn().mockImplementation((field: string, value: any) => {
        this.currentQuery!.filters.push({ type: 'lte', field, value });
        return chain;
      }),
      in: jest.fn().mockImplementation((field: string, values: any[]) => {
        this.currentQuery!.filters.push({ type: 'in', field, value: values });
        return chain;
      }),
      contains: jest.fn().mockImplementation((field: string, value: any) => {
        this.currentQuery!.filters.push({ type: 'contains', field, value });
        return chain;
      }),
      order: jest.fn().mockImplementation((field: string, { ascending = true } = {}) => {
        this.currentQuery!.orderBy = { field, ascending };
        return chain;
      }),
      limit: jest.fn().mockImplementation((count: number) => {
        this.currentQuery!.limitCount = count;
        return chain;
      }),
      range: jest.fn().mockImplementation((start: number, end: number) => {
        this.currentQuery!.rangeStart = start;
        this.currentQuery!.rangeEnd = end;
        return chain;
      }),
      single: jest.fn().mockImplementation(() => {
        const filteredData = this.applyFilters(this.mockData[table] || []);
        return { data: filteredData[0] || null, error: null };
      }),
      execute: jest.fn().mockImplementation(() => {
        let result = this.applyFilters(this.mockData[table] || []);

        if (this.currentQuery?.orderBy) {
          const { field, ascending } = this.currentQuery.orderBy;
          result.sort((a, b) => {
            if (ascending) {
              return a[field] > b[field] ? 1 : -1;
            } else {
              return a[field] < b[field] ? 1 : -1;
            }
          });
        }

        if (this.currentQuery?.rangeStart !== undefined && this.currentQuery?.rangeEnd !== undefined) {
          result = result.slice(this.currentQuery.rangeStart, this.currentQuery.rangeEnd + 1);
        }

        if (this.currentQuery?.limitCount !== undefined) {
          result = result.slice(0, this.currentQuery.limitCount);
        }

        return { data: result, error: null };
      })
    };

    return chain;
  }

  // Mock storage methods
  storage = {
    from: (bucket: string) => ({
      upload: jest.fn().mockResolvedValue({ data: { Key: 'test-file' }, error: null }),
      download: jest.fn().mockResolvedValue({ data: Buffer.from('test'), error: null }),
      remove: jest.fn().mockResolvedValue({ data: null, error: null })
    })
  };

  // Mock auth methods
  auth = {
    signUp: jest.fn().mockResolvedValue({ user: { id: 'test-user' }, error: null }),
    signIn: jest.fn().mockResolvedValue({ user: { id: 'test-user' }, error: null }),
    signOut: jest.fn().mockResolvedValue({ error: null })
  };
}

export function createMockSupabaseClient(): SupabaseClient {
  return new MockSupabaseClient() as unknown as SupabaseClient;
} 