import { MockSupabaseClient, createMockSupabaseClient } from './supabase-mock';

interface TestUser {
  id: string;
  name: string;
  email: string;
  age: number;
  points: number;
  role: string;
  tags: string[];
  created_at: string;
}

describe('Supabase Mock', () => {
  let supabase: MockSupabaseClient;

  beforeEach(() => {
    supabase = createMockSupabaseClient() as unknown as MockSupabaseClient;
    supabase.clearMockData();

    // Set up test data
    const testUsers: TestUser[] = [
      {
        id: 'user-1',
        name: 'Test User 1',
        email: 'test1@example.com',
        age: 25,
        points: 150,
        role: 'user',
        tags: ['active', 'premium'],
        created_at: '2025-01-01T00:00:00Z'
      },
      {
        id: 'user-2',
        name: 'Test User 2',
        email: 'test2@example.com',
        age: 30,
        points: 500,
        role: 'admin',
        tags: ['active', 'staff'],
        created_at: '2025-01-02T00:00:00Z'
      },
      {
        id: 'user-3',
        name: 'Test User 3',
        email: 'test3@example.com',
        age: 20,
        points: 50,
        role: 'user',
        tags: ['inactive'],
        created_at: '2025-01-03T00:00:00Z'
      }
    ];

    supabase.setMockData('users', testUsers);
  });

  describe('Basic CRUD Operations', () => {
    it('should handle insert operations', async () => {
      const newUser: TestUser = {
        id: 'user-4',
        name: 'New User',
        email: 'new@example.com',
        age: 35,
        points: 200,
        role: 'user',
        tags: ['active'],
        created_at: '2025-01-04T00:00:00Z'
      };

      const result = await supabase
        .from<TestUser>('users')
        .insert(newUser)
        .execute();

      expect(result.error).toBeNull();
      expect(result.data).toContainEqual(newUser);

      const allUsers = supabase.getMockData('users');
      expect(allUsers).toHaveLength(4);
      expect(allUsers).toContainEqual(newUser);
    });

    it('should handle update operations', async () => {
      const result = await supabase
        .from<TestUser>('users')
        .update({ points: 1000 })
        .eq('id', 'user-1')
        .execute();

      expect(result.error).toBeNull();
      const updatedUser = supabase.getMockData('users').find(u => u.id === 'user-1');
      expect(updatedUser?.points).toBe(1000);
    });

    it('should handle delete operations', async () => {
      const result = await supabase
        .from<TestUser>('users')
        .delete()
        .eq('id', 'user-1')
        .execute();

      expect(result.error).toBeNull();
      const remainingUsers = supabase.getMockData('users');
      expect(remainingUsers).toHaveLength(2);
      expect(remainingUsers.find(u => u.id === 'user-1')).toBeUndefined();
    });
  });

  describe('Query Filters', () => {
    it('should handle eq filter', async () => {
      const result = await supabase
        .from<TestUser>('users')
        .select()
        .eq('role', 'admin')
        .execute();

      expect(result.error).toBeNull();
      expect(result.data).toHaveLength(1);
      expect(result.data![0].id).toBe('user-2');
    });

    it('should handle neq filter', async () => {
      const result = await supabase
        .from<TestUser>('users')
        .select()
        .neq('role', 'admin')
        .execute();

      expect(result.error).toBeNull();
      expect(result.data).toHaveLength(2);
      expect(result.data!.every(u => u.role !== 'admin')).toBe(true);
    });

    it('should handle gt and lt filters', async () => {
      const result = await supabase
        .from<TestUser>('users')
        .select()
        .gt('age', 20)
        .lt('age', 30)
        .execute();

      expect(result.error).toBeNull();
      expect(result.data).toHaveLength(1);
      expect(result.data![0].id).toBe('user-1');
    });

    it('should handle gte and lte filters', async () => {
      const result = await supabase
        .from<TestUser>('users')
        .select()
        .gte('points', 150)
        .lte('points', 500)
        .execute();

      expect(result.error).toBeNull();
      expect(result.data).toHaveLength(2);
    });

    it('should handle in filter', async () => {
      const result = await supabase
        .from<TestUser>('users')
        .select()
        .in('role', ['admin', 'staff'])
        .execute();

      expect(result.error).toBeNull();
      expect(result.data).toHaveLength(1);
      expect(result.data![0].id).toBe('user-2');
    });

    it('should handle contains filter with arrays', async () => {
      const result = await supabase
        .from<TestUser>('users')
        .select()
        .contains('tags', ['active'])
        .execute();

      expect(result.error).toBeNull();
      expect(result.data).toHaveLength(2);
    });
  });

  describe('Query Modifiers', () => {
    it('should handle order modifier', async () => {
      const result = await supabase
        .from<TestUser>('users')
        .select()
        .order('age', { ascending: true })
        .execute();

      expect(result.error).toBeNull();
      expect(result.data).toHaveLength(3);
      expect(result.data!.map(u => u.age)).toEqual([20, 25, 30]);
    });

    it('should handle limit modifier', async () => {
      const result = await supabase
        .from<TestUser>('users')
        .select()
        .order('created_at', { ascending: true })
        .limit(2)
        .execute();

      expect(result.error).toBeNull();
      expect(result.data).toHaveLength(2);
      expect(result.data!.map(u => u.id)).toEqual(['user-1', 'user-2']);
    });

    it('should handle range modifier', async () => {
      const result = await supabase
        .from<TestUser>('users')
        .select()
        .order('created_at', { ascending: true })
        .range(1, 2)
        .execute();

      expect(result.error).toBeNull();
      expect(result.data).toHaveLength(2);
      expect(result.data!.map(u => u.id)).toEqual(['user-2', 'user-3']);
    });
  });

  describe('Storage Operations', () => {
    it('should handle storage operations', async () => {
      const uploadResult = await supabase.storage
        .from('bucket')
        .upload('test.txt', 'test data');

      expect(uploadResult.error).toBeNull();
      expect(uploadResult.data).toBeTruthy();

      const downloadResult = await supabase.storage
        .from('bucket')
        .download('test.txt');

      expect(downloadResult.error).toBeNull();
      expect(downloadResult.data).toBeTruthy();
    });
  });

  describe('Auth Operations', () => {
    it('should handle auth operations', async () => {
      const signUpResult = await supabase.auth.signUp({
        email: 'test@example.com',
        password: 'password'
      });

      expect(signUpResult.error).toBeNull();
      expect(signUpResult.user).toBeTruthy();

      const signInResult = await supabase.auth.signIn({
        email: 'test@example.com',
        password: 'password'
      });

      expect(signInResult.error).toBeNull();
      expect(signInResult.user).toBeTruthy();

      const signOutResult = await supabase.auth.signOut();
      expect(signOutResult.error).toBeNull();
    });
  });
}); 