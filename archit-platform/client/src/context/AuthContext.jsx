import { createContext, useContext, useMemo, useState } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user,setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('archit_user')); } catch { return null; }
  });
  const login = async (email,password) => {
    const { data } = await api.post('/auth/login',{ email,password });
    localStorage.setItem('archit_token',data.token);
    localStorage.setItem('archit_user',JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  };
  const register = (payload) => api.post('/auth/register',payload);
  const logout = () => {
    localStorage.removeItem('archit_token');
    localStorage.removeItem('archit_user');
    setUser(null);
  };
  const value = useMemo(() => ({ user,login,register,logout }),[user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
