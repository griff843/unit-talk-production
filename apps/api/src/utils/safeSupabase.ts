/**
 * Safe Supabase operations that bypass TypeScript 'never' type issues
 */

import { requireSupabase } from './supabaseUtils';

/**
 * Safely insert data into any table, bypassing type checking
 */
export async function safeInsert(tableName: string, data: any) {
  const client = requireSupabase();
  return (client as any).from(tableName).insert(data);
}

/**
 * Safely select data from any table, bypassing type checking
 */
export async function safeSelect(tableName: string, columns = '*') {
  const client = requireSupabase();
  return (client as any).from(tableName).select(columns);
}

/**
 * Safely update data in any table, bypassing type checking
 */
export async function safeUpdate(tableName: string, data: any) {
  const client = requireSupabase();
  return (client as any).from(tableName).update(data);
}

/**
 * Get a safe Supabase client that won't resolve to 'never' types
 */
export function getSafeSupabase() {
  const client = requireSupabase();
  return {
    from: (tableName: string) => {
      const table = (client as any).from(tableName);
      return {
        select: (columns = '*') => {
          const query = table.select(columns);
          return {
            eq: (column: string, value: any) => query.eq(column, value),
            in: (column: string, values: any[]) => query.in(column, values),
            contains: (column: string, value: any) => query.contains(column, value),
            limit: (count: number) => query.limit(count),
            single: () => query.single(),
            order: (column: string, options?: any) => query.order(column, options)
          };
        },
        insert: (data: any) => {
          const query = table.insert(data);
          return Object.assign(query, {
            select: (columns = '*') => query.select(columns)
          });
        },
        update: (data: any) => {
          const query = table.update(data);
          return {
            eq: (column: string, value: any) => query.eq(column, value),
            in: (column: string, values: any[]) => query.in(column, values)
          };
        },
        delete: () => {
          const query = table.delete();
          return {
            eq: (column: string, value: any) => query.eq(column, value),
            in: (column: string, values: any[]) => query.in(column, values)
          };
        }
      };
    }
  };
}