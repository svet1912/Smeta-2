import { Box, Container, Typography, Grid, Card, CardContent, Stack, Chip } from '@mui/material';
import { TrendingUp as TrendingUpIcon } from '@mui/icons-material';

const Cases = ({ content }) => {
  return (
    <Box id="cases" sx={{ py: 10, backgroundColor: 'background.paper' }}>
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
            <Typography variant="h6" color="text.secondary" sx={{ maxWidth: '700px' }}>
              {content.subtitle}
            </Typography>
          </Stack>

          <Grid container spacing={4}>
            {content.items.map((caseItem, index) => (
              <Grid item xs={12} md={4} key={index}>
                <Card
                  sx={{
                    height: '100%',
                    transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                    '&:hover': {
                      transform: 'translateY(-8px)',
                      boxShadow: 6
                    },
                    border: '1px solid',
                    borderColor: 'divider'
                  }}
                >
                  <CardContent sx={{ p: 4, height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <Stack spacing={3} height="100%">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <TrendingUpIcon sx={{ color: 'success.main', fontSize: '2rem' }} />
                        <Chip
                          label="Кейс"
                          size="small"
                          sx={{
                            backgroundColor: 'success.light',
                            color: 'success.contrastText'
                          }}
                        />
                      </Box>

                      <Typography
                        variant="h6"
                        component="h3"
                        sx={{
                          fontWeight: 600,
                          color: 'primary.main',
                          lineHeight: 1.3
                        }}
                      >
                        {caseItem.company}
                      </Typography>

                      <Box
                        sx={{
                          backgroundColor: 'success.light',
                          borderRadius: 2,
                          p: 2,
                          textAlign: 'center'
                        }}
                      >
                        <Typography
                          variant="h5"
                          sx={{
                            fontWeight: 'bold',
                            color: 'success.main',
                            fontSize: { xs: '1.25rem', md: '1.5rem' }
                          }}
                        >
                          {caseItem.result}
                        </Typography>
                      </Box>

                      <Typography
                        variant="body1"
                        color="text.secondary"
                        sx={{
                          lineHeight: 1.6,
                          flexGrow: 1,
                          display: 'flex',
                          alignItems: 'center'
                        }}
                      >
                        {caseItem.description}
                      </Typography>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Stack>
      </Container>
    </Box>
  );
};

export default Cases;
