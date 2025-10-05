import { Box, Container, Typography, Stack, Divider, Link } from '@mui/material';
import { GitHub as GitHubIcon } from '@mui/icons-material';

const Footer = () => {
  return (
    <Box
      component="footer"
      sx={{
        py: 6,
        backgroundColor: 'grey.900',
        color: 'common.white'
      }}
    >
      <Container maxWidth="lg">
        <Stack spacing={4}>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems="center" spacing={2}>
            <Typography variant="h5" component="div" sx={{ fontWeight: 'bold', color: 'primary.light' }}>
              SMETA360
            </Typography>

            <Stack direction="row" spacing={3} alignItems="center">
              <Link
                href="https://github.com/IYK026/Smeta360-2"
                target="_blank"
                rel="noopener noreferrer"
                color="inherit"
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  textDecoration: 'none',
                  '&:hover': { color: 'primary.light' }
                }}
              >
                <GitHubIcon sx={{ mr: 1 }} />
                GitHub
              </Link>

              <Link
                href="/login"
                color="inherit"
                sx={{
                  textDecoration: 'none',
                  '&:hover': { color: 'primary.light' }
                }}
              >
                Приложение
              </Link>
            </Stack>
          </Stack>

          <Divider sx={{ backgroundColor: 'grey.600' }} />

          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems="center" spacing={2}>
            <Typography variant="body2" color="grey.400">
              © 2025 SMETA360. Система управления строительными сметами.
            </Typography>

            <Typography variant="body2" color="grey.400">
              React 18 + Node.js + PostgreSQL
            </Typography>
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
};

export default Footer;
