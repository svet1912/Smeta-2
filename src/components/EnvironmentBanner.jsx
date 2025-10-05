import { Box, Chip, Typography } from '@mui/material';

const EnvironmentBanner = () => {
  const isPreview =
    import.meta.env.VITE_VERCEL_ENV === 'preview' ||
    window.location.hostname.includes('-git-') ||
    window.location.hostname.includes('.vercel.app');

  const isProduction = import.meta.env.PROD && !isPreview;

  if (isProduction) {
    return null; // Не показываем баннер в продакшене
  }

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        zIndex: 9999,
        background: 'rgba(0, 0, 0, 0.8)',
        borderRadius: 2,
        p: 1,
        backdropFilter: 'blur(10px)'
      }}
    >
      <Chip
        label={
          <Typography variant="caption" sx={{ color: 'white' }}>
            {isPreview ? '🚀 Preview' : '🛠️ Development'}
          </Typography>
        }
        size="small"
        sx={{
          backgroundColor: isPreview ? 'warning.main' : 'info.main',
          color: 'white'
        }}
      />
    </Box>
  );
};

export default EnvironmentBanner;
