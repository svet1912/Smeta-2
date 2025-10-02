import { Box, Container, Typography, Button, Stack, Grid } from '@mui/material';
import { ArrowForward } from '@mui/icons-material';
import LeadForm from '../../components/LeadForm';

const Hero = ({ content }) => {
  const handleCTAClick = () => {
    window.location.href = content.cta.target;
  };

  return (
    <Box
      id="hero"
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
        py: 8
      }}
    >
      <Container maxWidth="lg">
        <Grid container spacing={6} alignItems="center">
          <Grid item xs={12} md={7}>
            <Stack spacing={4} alignItems="flex-start" textAlign="left">
              <Typography
                variant="h1"
                component="h1"
                sx={{
                  fontSize: { xs: '2.5rem', sm: '3.5rem', md: '4.5rem' },
                  fontWeight: 'bold',
                  color: 'primary.main',
                  mb: 2
                }}
              >
                {content.title}
              </Typography>
              
              <Typography
                variant="h4"
                component="h2"
                sx={{
                  fontSize: { xs: '1.25rem', sm: '1.5rem', md: '2rem' },
                  fontWeight: 500,
                  color: 'text.secondary'
                }}
              >
                {content.subtitle}
              </Typography>
              
              <Typography
                variant="h6"
                component="p"
                sx={{
                  fontSize: { xs: '1rem', md: '1.25rem' },
                  color: 'text.primary',
                  lineHeight: 1.6
                }}
              >
                {content.description}
              </Typography>
              
              <Button
                variant="contained"
                size="large"
                endIcon={<ArrowForward />}
                onClick={handleCTAClick}
                sx={{
                  mt: 4,
                  px: 4,
                  py: 1.5,
                  fontSize: '1.1rem',
                  borderRadius: 2,
                  textTransform: 'none',
                  boxShadow: 3,
                  '&:hover': {
                    boxShadow: 6,
                    transform: 'translateY(-2px)'
                  },
                  transition: 'all 0.3s ease'
                }}
              >
                {content.cta.text}
              </Button>
            </Stack>
          </Grid>
          
          <Grid item xs={12} md={5}>
            <LeadForm 
              content={content.leadForm} 
              variant="compact"
            />
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};

export default Hero;