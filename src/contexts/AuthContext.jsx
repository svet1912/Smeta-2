import React, { createContext, useContext, useState, useEffect } from 'react';
import { getCurrentUser, validateToken, removeAuthToken } from 'api/auth';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth должен использоваться внутри AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Загрузка данных пользователя при инициализации
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    setIsLoading(true);
    try {
      const isValid = await validateToken();
      if (isValid) {
        const response = await getCurrentUser();
        if (response.success && response.user) {
          setUser(response.user);
          setIsAuthenticated(true);
        } else {
          clearAuth();
        }
      } else {
        clearAuth();
      }
    } catch (error) {
      console.error('Ошибка проверки аутентификации:', error);
      clearAuth();
    } finally {
      setIsLoading(false);
    }
  };

  const clearAuth = () => {
    setUser(null);
    setIsAuthenticated(false);
    removeAuthToken();
  };

  const updateUser = (userData) => {
    setUser(userData);
    setIsAuthenticated(true);
  };

  const logout = () => {
    clearAuth();
  };

  const value = {
    user,
    isAuthenticated,
    isLoading,
    updateUser,
    logout,
    checkAuthStatus
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};