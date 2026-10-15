import { createContext, useContext, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError, type User } from './api.ts';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: async (): Promise<User | null> => {
      try {
        return (await api.me()).user;
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return null;
        throw err;
      }
    },
    staleTime: 30_000,
    retry: false,
  });

  const value: AuthContextValue = {
    user: data ?? null,
    loading: isLoading,
    login: async (email, password) => {
      const { user } = await api.login(email, password);
      queryClient.setQueryData(['me'], user);
    },
    register: async (email, password) => {
      const { user } = await api.register(email, password);
      queryClient.setQueryData(['me'], user);
    },
    logout: async () => {
      await api.logout();
      queryClient.clear();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
