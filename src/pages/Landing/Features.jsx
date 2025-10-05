import { Box, Container, Typography, Grid, Card, CardContent, Stack } from '@mui/material';
import {
  Storage as StorageIcon,
  Api as ApiIcon,
  Group as GroupIcon,
  Cloud as CloudIcon,
  Description as DescriptionIcon
} from '@mui/icons-material';

const iconMap = {
  0: StorageIcon,
  1: ApiIcon,
  2: GroupIcon,
  3: CloudIcon,
  4: DescriptionIcon
};

const Features = ({ content }) => {
  return (
    <Box id="features" sx={{ py: 10, backgroundColor: 'background.paper' }}>
      <Container maxWidth="lg">
        <Stack spacing={6}>
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
              Ключевые возможности
            </Typography>
            <Typography variant="h6" color="text.secondary" sx={{ maxWidth: '600px' }}>
              Профессиональные инструменты для управления строительными сметами
            </Typography>
          </Stack>

          <Grid container spacing={4}>
            {content.map((feature, index) => {
              const IconComponent = iconMap[index] || StorageIcon;

              return (
                <Grid item xs={12} sm={6} md={4} key={index}>
                  <Card
                    sx={{
                      height: '100%',
                      transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                      '&:hover': {
                        transform: 'translateY(-8px)',
                        boxShadow: 6
                      }
                    }}
                  >
                    <CardContent sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
                      <Stack spacing={2} alignItems="center" textAlign="center">
                        <Box
                          sx={{
                            p: 2,
                            borderRadius: '50%',
                            backgroundColor: 'primary.light',
                            color: 'primary.contrastText',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          <IconComponent sx={{ fontSize: '2rem' }} />
                        </Box>

                        <Typography variant="h5" component="h3" sx={{ fontWeight: 600, color: 'primary.main' }}>
                          {feature.title}
                        </Typography>

                        <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.6, flexGrow: 1 }}>
                          {feature.description}
                        </Typography>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        </Stack>
      </Container>
    </Box>
  );
};

export default Features;
