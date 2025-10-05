import { Box, Container, Typography, Grid, Stack, Avatar } from '@mui/material';
import { Login as LoginIcon, Search as SearchIcon, Description as DescriptionIcon } from '@mui/icons-material';

const iconMap = {
  0: LoginIcon,
  1: SearchIcon,
  2: DescriptionIcon
};

const HowItWorks = ({ content }) => {
  return (
    <Box id="how" sx={{ py: 10, backgroundColor: 'grey.50' }}>
      <Container maxWidth="lg">
        <Stack spacing={8}>
          <Stack spacing={2} alignItems="center" textAlign="center">
            <Typography
              variant="h2"
              component="h2"
              sx={{
                fontSize: { xs: '2rem', md: '3rem' },
                fontWeight: 'bold',
                color: 'primary.main'
              }}
            >
              {content.title}
            </Typography>
            <Typography variant="h6" color="text.secondary" sx={{ maxWidth: '600px' }}>
              {content.subtitle}
            </Typography>
          </Stack>

          <Grid container spacing={6} alignItems="center">
            {content.steps.map((step, index) => {
              const IconComponent = iconMap[index] || LoginIcon;

              return (
                <Grid item xs={12} md={4} key={index}>
                  <Stack spacing={3} alignItems="center" textAlign="center">
                    <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                      <Avatar
                        sx={{
                          width: 80,
                          height: 80,
                          backgroundColor: 'primary.main',
                          fontSize: '2rem'
                        }}
                      >
                        <IconComponent sx={{ fontSize: '2rem' }} />
                      </Avatar>
                      <Box
                        sx={{
                          position: 'absolute',
                          top: -8,
                          right: -8,
                          backgroundColor: 'secondary.main',
                          color: 'secondary.contrastText',
                          borderRadius: '50%',
                          width: 32,
                          height: 32,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.875rem',
                          fontWeight: 'bold'
                        }}
                      >
                        {step.step}
                      </Box>
                    </Box>

                    <Typography variant="h5" component="h3" sx={{ fontWeight: 600, color: 'primary.main' }}>
                      {step.title}
                    </Typography>

                    <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.6, maxWidth: '300px' }}>
                      {step.description}
                    </Typography>

                    {/* Стрелка между шагами */}
                    {index < content.steps.length - 1 && (
                      <Box
                        sx={{
                          display: { xs: 'none', md: 'block' },
                          position: 'absolute',
                          top: '50%',
                          right: '-3rem',
                          transform: 'translateY(-50%)',
                          fontSize: '2rem',
                          color: 'primary.light'
                        }}
                      >
                        →
                      </Box>
                    )}
                  </Stack>
                </Grid>
              );
            })}
          </Grid>
        </Stack>
      </Container>
    </Box>
  );
};

export default HowItWorks;
