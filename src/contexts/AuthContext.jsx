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
      // Проверяем есть ли токен в localStorage
      const token = localStorage.getItem('authToken');
      if (!token) {
        clearAuth();
        setIsLoading(false);
        return;
      }
      
      // Пытаемся загрузить данные пользователя
      try {
        const response = await getCurrentUser();
        if (response.success && response.user) {
          setUser(response.user);
          setIsAuthenticated(true);
        } else {
          // Если не удалось загрузить - НЕ удаляем токен сразу
          // Просто показываем что пользователь авторизован
          console.warn('⚠️ Не удалось загрузить данные пользователя, но токен есть');
          setIsAuthenticated(true);
        }
      } catch (error) {
        // При ошибке сети - НЕ удаляем токен!
        // Токен будет проверен при следующем API запросе
        console.warn('⚠️ Ошибка загрузки пользователя (возможно временная):', error.message);
        setIsAuthenticated(true);  // Оптимистично считаем что авторизован
      }
    } catch (error) {
      console.error('Критическая ошибка проверки auth:', error);
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