import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Хук управления auth-состоянием.
 * Читает user из localStorage, защищает роуты.
 */
export function useAuth() {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('practi_user')) || null;
    } catch {
      return null;
    }
  });

  const navigate = useNavigate();

  const login = (userData) => {
    localStorage.setItem('practi_user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('practi_user');
    setUser(null);
    navigate('/');
  };

  const requireRole = (allowedRoles) => {
    if (!user) {
      navigate('/');
      return false;
    }
    if (allowedRoles && !allowedRoles.includes(user.role)) {
      navigate('/');
      return false;
    }
    return true;
  };

  return { user, login, logout, requireRole };
}
