import { Box, Container, Typography, Button, Stack } from '@mui/material';
import { Dashboard as DashboardIcon, ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const NotFoundApp = () => {
  const navigate = useNavigate();

  return (
    <Box
      sx={{
        minHeight: 'calc(100vh - 80px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'grey.50'
      }}
    >
      <Container maxWidth="sm">
        <Stack spacing={4} alignItems="center" textAlign="center">
          <Typography
            variant="h1"
            sx={{
              fontSize: { xs: '4rem', md: '6rem' },
              fontWeight: 'bold',
              color: 'primary.main',
              opacity: 0.8
            }}
          >
            404
          </Typography>

          <Typography
            variant="h4"
            component="h1"
            sx={{
              fontSize: { xs: '1.5rem', md: '2rem' },
              fontWeight: 600,
              color: 'text.primary'
            }}
          >
            Страница не найдена
          </Typography>

          <Typography
            variant="body1"
            color="text.secondary"
            sx={{
              maxWidth: '400px',
              lineHeight: 1.6
            }}
          >
            К сожалению, запрашиваемый раздел приложения не существует. Проверьте правильность адреса или вернитесь на главную панель.
          </Typography>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ pt: 2 }}>
            <Button
              variant="contained"
              startIcon={<DashboardIcon />}
              onClick={() => navigate('/app/dashboard/default')}
              sx={{
                px: 3,
                py: 1.5,
                textTransform: 'none',
                fontSize: '1rem'
              }}
            >
              На главную панель
            </Button>

            <Button
              variant="outlined"
              startIcon={<ArrowBackIcon />}
              onClick={() => navigate(-1)}
              sx={{
                px: 3,
                py: 1.5,
                textTransform: 'none',
                fontSize: '1rem'
              }}
            >
              Назад
            </Button>
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
};

export default NotFoundApp;
