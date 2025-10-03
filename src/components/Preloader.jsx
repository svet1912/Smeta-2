/**
 * Preloader Component
 * Компонент для предварительной загрузки критичных ресурсов
 */
import { useEffect, useState } from 'react';
import { Box, CircularProgress, Typography, LinearProgress } from '@mui/material';

const Preloader = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);
  const [loadingText, setLoadingText] = useState('Инициализация...');

  useEffect(() => {
    const loadResources = async () => {
      const steps = [
        { text: 'Загрузка основных компонентов...', duration: 500 },
        { text: 'Инициализация API...', duration: 300 },
        { text: 'Подготовка интерфейса...', duration: 400 },
        { text: 'Завершение загрузки...', duration: 300 }
      ];

      for (let i = 0; i < steps.length; i++) {
        setLoadingText(steps[i].text);
        setProgress((i + 1) * 25);
        await new Promise(resolve => setTimeout(resolve, steps[i].duration));
      }

      // Дополнительная задержка для плавности
      await new Promise(resolve => setTimeout(resolve, 200));
      setProgress(100);
      
      // Вызываем callback завершения
      if (onComplete) {
        onComplete();
      }
    };

    loadResources();
  }, [onComplete]);

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        color: 'white'
      }}
    >
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <Typography variant="h4" sx={{ mb: 2, fontWeight: 'bold' }}>
          SMETA360
        </Typography>
        <Typography variant="body1" sx={{ opacity: 0.9 }}>
          Система сметного планирования
        </Typography>
      </Box>

      <Box sx={{ width: '300px', mb: 3 }}>
        <LinearProgress
          variant="determinate"
          value={progress}
          sx={{
            height: 8,
            borderRadius: 4,
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
            '& .MuiLinearProgress-bar': {
              backgroundColor: 'white',
              borderRadius: 4
            }
          }}
        />
        <Typography variant="body2" sx={{ mt: 1, opacity: 0.8 }}>
          {progress}%
        </Typography>
      </Box>

      <Box sx={{ textAlign: 'center' }}>
        <CircularProgress 
          size={24} 
          sx={{ color: 'white', mb: 2 }} 
        />
        <Typography variant="body2" sx={{ opacity: 0.8 }}>
          {loadingText}
        </Typography>
      </Box>
    </Box>
  );
};

export default Preloader;
