/**
 * Typed Supabase wrapper to prevent 'never' type issues
 * This utility provides type-safe methods that bypass TypeScript's strict checking
 * when the database schema doesn't perfectly match the expected types.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database-override';
import { requireSupabase } from './supabaseUtils';

export interface TypedSupabaseClient {
  // Raw props operations
  insertRawProps(props: any[]): Promise<{ data: any; error: any }>;
  selectRawProps(filters?: any): Promise<{ data: any; error: any }>;
  updateRawProps(id: string, updates: any): Promise<{ data: any; error: any }>;

  // Analytics events operations
  insertAnalyticsEvent(event: any): Promise<{ data: any; error: any }>;
  selectAnalyticsEvents(filters?: any): Promise<{ data: any; error: any }>;

  // Games operations
  insertGames(games: any[]): Promise<{ data: any; error: any }>;
  selectGames(filters?: any): Promise<{ data: any; error: any }>;

  // Generic operations for any table
  from<T extends keyof Database['public']['Tables']>(table: T): {
    select(columns?: string): {
      eq(column: string, value: any): Promise<{ data: any; error: any }>;
      in(column: string, values: any[]): Promise<{ data: any; error: any }>;
      limit(count: number): Promise<{ data: any; error: any }>;
      single(): Promise<{ data: any; error: any }>;
      order(column: string, options?: { ascending?: boolean }): {
        limit(count: number): Promise<{ data: any; error: any }>;
      };
    };
    insert(data: any): {
      select(): Promise<{ data: any; error: any }>;
    } & Promise<{ data: any; error: any }>;
    update(data: any): {
      eq(column: string, value: any): Promise<{ data: any; error: any }>;
    };
    delete(): {
      eq(column: string, value: any): Promise<{ data: any; error: any }>;
    };
  };
}

class TypedSupabaseClientImpl implements TypedSupabaseClient {
  private client: SupabaseClient<Database>;

  constructor() {
    this.client = requireSupabase();
  }

  async insertRawProps(props: any[]) {
    return (this.client as any).from('raw_props').insert(props);
  }

  async selectRawProps(filters?: any) {
    let query = (this.client as any).from('raw_props').select('*');
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        query = query.eq(key, value);
      });
    }
    return query;
  }

  async updateRawProps(id: string, updates: any) {
    return (this.client as any).from('raw_props').update(updates).eq('id', id);
  }

  async insertAnalyticsEvent(event: any) {
    return (this.client as any).from('analytics_events').insert(event);
  }

  async selectAnalyticsEvents(filters?: any) {
    let query = (this.client as any).from('analytics_events').select('*');
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        query = query.eq(key, value);
      });
    }
    return query;
  }

  async insertGames(games: any[]) {
    return (this.client as any).from('games').insert(games);
  }

  async selectGames(filters?: any) {
    let query = (this.client as any).from('games').select('*');
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        query = query.eq(key, value);
      });
    }
    return query;
  }

  from<T extends keyof Database['public']['Tables']>(table: T) {
    const baseQuery = (this.client as any).from(table);

    return {
      select: (columns = '*') => {
        const selectQuery = baseQuery.select(columns);
        return {
          eq: (column: string, value: any) => selectQuery.eq(column, value),
          in: (column: string, values: any[]) => selectQuery.in(column, values),
          limit: (count: number) => selectQuery.limit(count),
          single: () => selectQuery.single(),
          order: (column: string, options?: { ascending?: boolean }) => {
            const orderedQuery = selectQuery.order(column, options);
            return {
              limit: (count: number) => orderedQuery.limit(count)
            };
          }
        };
      },
      insert: (data: any) => {
        const insertQuery = baseQuery.insert(data);
        return Object.assign(insertQuery, {
          select: () => insertQuery.select()
        });
      },
      update: (data: any) => ({
        eq: (column: string, value: any) => baseQuery.update(data).eq(column, value)
      }),
      delete: () => ({
        eq: (column: string, value: any) => baseQuery.delete().eq(column, value)
      })
    };
  }
}

// Export singleton instance
export const typedSupabase = new TypedSupabaseClientImpl();

// Export helper function
export function getTypedSupabase(): TypedSupabaseClient {
  return typedSupabase;
}