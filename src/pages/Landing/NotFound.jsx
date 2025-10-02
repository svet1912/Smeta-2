import { Box, Container, Typography, Button, Stack } from '@mui/material';
import { Home as HomeIcon, Apps as AppsIcon } from '@mui/icons-material';

const NotFound = () => {
  return (
    <Box
      sx={{
        minHeight: '100vh',
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
            К сожалению, запрашиваемая страница не существует. 
            Проверьте правильность адреса или вернитесь на главную страницу.
          </Typography>
          
          <Stack 
            direction={{ xs: 'column', sm: 'row' }} 
            spacing={2} 
            sx={{ pt: 2 }}
          >
            <Button
              variant="contained"
              startIcon={<HomeIcon />}
              onClick={() => window.location.href = '/'}
              sx={{ 
                px: 3,
                py: 1.5,
                textTransform: 'none',
                fontSize: '1rem'
              }}
            >
              На главную
            </Button>
            
            <Button
              variant="outlined"
              startIcon={<AppsIcon />}
              onClick={() => window.location.href = '/app'}
              sx={{ 
                px: 3,
                py: 1.5,
                textTransform: 'none',
                fontSize: '1rem'
              }}
            >
              В приложение
            </Button>
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
};

export default NotFound;