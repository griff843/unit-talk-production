import { SupabaseClient } from '@supabase/supabase-js';

// Test data store interface
export interface TestDataStore {
  data: Record<string, any[]>;
  insert: (table: string, rows: any[]) => void;
  reset: () => void;
}

// Create a mock Supabase client with in-memory store
// eslint-disable-next-line max-lines-per-function
export function setupTestDatabase() {
  // In-memory store
  const store: TestDataStore = {
    data: {},
    insert(table: string, rows: any[]) {
      if (!this.data[table]) {
        this.data[table] = [];
      }
      this.data[table].push(...rows);
    },
    reset() {
      this.data = {};
    },
  };

  // Mock client
  const client = {
    from: (table: string) => ({
      select: () => ({
        eq: (column: string, value: any) => ({
          single: () => {
            const rows = store.data[table] || [];
            const row = rows.find(r => r[column] === value);
            return Promise.resolve({ data: row, error: null });
          },
          then: () => {
            const rows = store.data[table] || [];
            const filtered = rows.filter(r => r[column] === value);
            return Promise.resolve({ data: filtered, error: null });
          },
        }),
        then: () => {
          const rows = store.data[table] || [];
          return Promise.resolve({ data: rows, error: null });
        },
      }),
      insert: (rows: any[]) => {
        store.insert(table, Array.isArray(rows) ? rows : [rows]);
        return Promise.resolve({ data: rows, error: null });
      },
      update: (data: any) => ({
        eq: (column: string, value: any) => {
          const rows = store.data[table] || [];
          const index = rows.findIndex(r => r[column] === value);
          if (index !== -1) {
            rows[index] = { ...rows[index], ...data };
          }
          return Promise.resolve({ data: rows[index], error: null });
        },
      }),
      delete: () => ({
        eq: (column: string, value: any) => {
          const rows = store.data[table] || [];
          const index = rows.findIndex(r => r[column] === value);
          if (index !== -1) {
            rows.splice(index, 1);
          }
          return Promise.resolve({ data: null, error: null });
        },
      }),
    }),
    auth: {
      getUser: () => Promise.resolve({ data: { user: null }, error: null }),
    },
  } as unknown as SupabaseClient;

  // Add store to client for test access
  (client as any)._store = store;

  return {
    client,
    store,
  };
}

// Helper function to populate test data
export function populateTestData(client: SupabaseClient, table: string, rows: any[]) {
  const store = (client as any)._store as TestDataStore;
  store.insert(table, rows);
}

// Helper function to reset test data
export function resetTestData(client: SupabaseClient) {
  const store = (client as any)._store as TestDataStore;
  store.reset();
}
