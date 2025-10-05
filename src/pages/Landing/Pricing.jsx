import {
  Box,
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Stack,
  Chip
} from '@mui/material';
import { Check as CheckIcon, Star as StarIcon } from '@mui/icons-material';

const Pricing = ({ content }) => {
  const handlePlanClick = (href) => {
    if (href.startsWith('#')) {
      // Прокрутка к секции
      const element = document.querySelector(href);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    } else {
      // Переход по ссылке
      window.location.href = href;
    }
  };

  return (
    <Box id="pricing" sx={{ py: 10, backgroundColor: 'grey.50' }}>
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

          <Grid container spacing={4} justifyContent="center">
            {content.plans.map((plan, index) => (
              <Grid item xs={12} sm={6} md={4} key={index}>
                <Card
                  sx={{
                    height: '100%',
                    position: 'relative',
                    transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                    transform: plan.popular ? 'scale(1.05)' : 'scale(1)',
                    '&:hover': {
                      transform: plan.popular ? 'scale(1.08)' : 'scale(1.03)',
                      boxShadow: 8
                    },
                    border: plan.popular ? '2px solid' : '1px solid',
                    borderColor: plan.popular ? 'primary.main' : 'divider'
                  }}
                >
                  {plan.popular && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: -12,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 1
                      }}
                    >
                      <Chip icon={<StarIcon />} label="Популярный" color="primary" sx={{ fontWeight: 'bold' }} />
                    </Box>
                  )}

                  <CardContent sx={{ p: 4, height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <Stack spacing={3} height="100%">
                      <Stack spacing={1} alignItems="center" textAlign="center">
                        <Typography
                          variant="h4"
                          component="h3"
                          sx={{
                            fontWeight: 'bold',
                            color: plan.popular ? 'primary.main' : 'text.primary'
                          }}
                        >
                          {plan.name}
                        </Typography>

                        <Typography variant="body2" color="text.secondary">
                          {plan.description}
                        </Typography>

                        <Box sx={{ py: 2 }}>
                          <Typography
                            variant="h3"
                            sx={{
                              fontWeight: 'bold',
                              color: 'primary.main',
                              fontSize: { xs: '2rem', md: '2.5rem' }
                            }}
                          >
                            {plan.price}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {plan.period}
                          </Typography>
                        </Box>
                      </Stack>

                      <List sx={{ flexGrow: 1, py: 0 }}>
                        {plan.features.map((feature, featureIndex) => (
                          <ListItem key={featureIndex} sx={{ px: 0, py: 0.5 }}>
                            <ListItemIcon sx={{ minWidth: 32 }}>
                              <CheckIcon
                                sx={{
                                  color: 'success.main',
                                  fontSize: '1.25rem'
                                }}
                              />
                            </ListItemIcon>
                            <ListItemText
                              primary={feature}
                              sx={{
                                '& .MuiListItemText-primary': {
                                  fontSize: '0.875rem'
                                }
                              }}
                            />
                          </ListItem>
                        ))}
                      </List>

                      <Button
                        variant={plan.popular ? 'contained' : 'outlined'}
                        size="large"
                        fullWidth
                        onClick={() => handlePlanClick(plan.href)}
                        sx={{
                          py: 1.5,
                          fontSize: '1rem',
                          fontWeight: 'bold',
                          textTransform: 'none',
                          ...(plan.popular && {
                            background: 'linear-gradient(45deg, #1976d2, #42a5f5)',
                            '&:hover': {
                              background: 'linear-gradient(45deg, #1565c0, #1e88e5)'
                            }
                          })
                        }}
                      >
                        {plan.cta}
                      </Button>
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

export default Pricing;
