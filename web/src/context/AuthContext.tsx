import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { clearEmail, fetchMe, getEmail, setEmail, registerWithEmail, loginWithEmail } from '../lib/api';

export type User = {
  email: string;
  name: string;
  is_admin: boolean;
  merchant: { id: string; status: string };
};

type AuthCtx = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const email = getEmail();
    if (!email) {
      setUser(null);
      setLoading(false);
      return;
    }
    const me = await fetchMe();
    if (me?.success) {
      const name = me.data.email.split('@')[0];
      setUser({ ...me.data, name });
    }
    else setUser(null);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  async function login(email: string, password: string) {
    setLoading(true);
    setEmail(email);
    const res = await loginWithEmail(email, password);
    if (!res.success) {
      clearEmail();
      setLoading(false);
      throw new Error(res.error.message);
    }
    await refresh();
  }

  async function register(email: string, password: string) {
    setLoading(true);
    setEmail(email);
    const res = await registerWithEmail(email, password);
    if (!res.success) {
      clearEmail();
      setLoading(false);
      throw new Error(res.error.message);
    }
    await refresh();
  }

  function logout() {
    clearEmail();
    setUser(null);
  }

  const value = useMemo(() => ({ user, loading, login, register, logout, refresh }), [user, loading]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used within AuthProvider');
  return v;
}
