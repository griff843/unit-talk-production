'use server';

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

interface User {
  id: string;
  email: string;
  role: string;
  tenant?: string;
}

export interface AuthUser extends User {
  tenant: string | null;
}

/**
 * Mock authentication for development
 * In production, this would integrate with your actual auth provider
 */
export async function requireAuth(): Promise<AuthUser> {
  const cookieStore = cookies();
  const authToken = cookieStore.get('auth-token');
  
  // For development, return a mock user
  // In production, verify the token and get user info
  if (!authToken) {
    // Mock user for development
    return {
      id: 'dev-user-1',
      email: 'dev@unittalk.com',
      role: 'admin',
      tenant: null
    };
  }

  // Mock authenticated user
  return {
    id: 'user-1',
    email: 'admin@unittalk.com',
    role: 'admin',
    tenant: null
  };
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    return await requireAuth();
  } catch {
    return null;
  }
}

export async function signOut(): Promise<void> {
  const cookieStore = cookies();
  cookieStore.delete('auth-token');
  redirect('/login');
}