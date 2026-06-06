'use client';
import { useAuth } from '@/hooks/useAuth';

export function AuthPrefetch() {
  useAuth();
  return null;
}
