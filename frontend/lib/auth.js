'use client';
import { createContext, useContext, useState, useEffect } from 'react';
import api from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    const cachedUser = localStorage.getItem('user');
    try {
      const token = localStorage.getItem('token');
      if (!token) { setLoading(false); return; }

      if (cachedUser && !user) {
        try {
          setUser(JSON.parse(cachedUser));
        } catch {
          localStorage.removeItem('user');
        }
      }

      const res = await api.get('/auth/me');
      setUser(res.data.user);
      setPermissions(res.data.permissions);
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
        setPermissions([]);
      }
    } finally {
      setLoading(false);
    }
  }

  async function login(username, password) {
    const res = await api.post('/auth/login', { username, password });
    if (res.data?.token && res.data?.user) {
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      setUser(res.data.user);
      await checkAuth();
    }
    return res.data;
  }

  async function completeLogin(authData) {
    if (!authData?.token || !authData?.user) {
      throw new Error('Invalid auth data.');
    }
    localStorage.setItem('token', authData.token);
    localStorage.setItem('user', JSON.stringify(authData.user));
    setUser(authData.user);
    // fetch permissions in background — does NOT block redirect
    checkAuth().catch(() => {});
  }

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setPermissions([]);
    window.location.href = '/login';
  }

  function hasPermission(perm) {
    const role = user?.role_name || user?.role;
    if (role === 'Admin') return true;
    return permissions.includes(perm);
  }

  function hasRole(...roles) {
    const role = user?.role_name || user?.role;
    return roles.includes(role);
  }

  return (
    <AuthContext.Provider value={{ user, permissions, loading, login, completeLogin, logout, hasPermission, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
