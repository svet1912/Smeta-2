import { Box, Container, Typography, Button, Stack, Grid, Paper } from '@mui/material';
import { ArrowForward as ArrowForwardIcon } from '@mui/icons-material';
import LeadForm from '../../components/LeadForm';

const CTA = ({ content }) => {
  const handleCTAClick = () => {
    window.location.href = content.button.href;
  };

  return (
    <Box
      sx={{
        py: 12,
        background: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)',
        color: 'white',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Декоративные элементы */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage:
            'url("data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%23ffffff" fill-opacity="0.1"%3E%3Ccircle cx="30" cy="30" r="2"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
          opacity: 0.3
        }}
      />

      <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1 }}>
        <Grid container spacing={8} alignItems="center">
          <Grid item xs={12} md={6}>
            <Stack spacing={4} alignItems="flex-start" textAlign="left">
              <Typography
                variant="h2"
                component="h2"
                sx={{
                  fontSize: { xs: '2rem', md: '3rem' },
                  fontWeight: 'bold'
                }}
              >
                {content.title}
              </Typography>

              <Typography
                variant="h6"
                sx={{
                  fontSize: { xs: '1.1rem', md: '1.25rem' },
                  opacity: 0.9,
                  lineHeight: 1.6
                }}
              >
                {content.subtitle}
              </Typography>

              <Button
                variant="contained"
                size="large"
                endIcon={<ArrowForwardIcon />}
                onClick={handleCTAClick}
                sx={{
                  mt: 4,
                  px: 4,
                  py: 1.5,
                  fontSize: '1.2rem',
                  fontWeight: 'bold',
                  borderRadius: 3,
                  textTransform: 'none',
                  backgroundColor: 'secondary.main',
                  color: 'secondary.contrastText',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                  '&:hover': {
                    backgroundColor: 'secondary.dark',
                    transform: 'translateY(-2px)',
                    boxShadow: '0 12px 40px rgba(0,0,0,0.3)'
                  },
                  transition: 'all 0.3s ease'
                }}
              >
                {content.button.text}
              </Button>

              <Typography
                variant="body2"
                sx={{
                  opacity: 0.8,
                  fontSize: '0.9rem',
                  fontStyle: 'italic'
                }}
              >
                {content.note}
              </Typography>
            </Stack>
          </Grid>

          <Grid item xs={12} md={6}>
            <Paper
              sx={{
                p: 4,
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(10px)',
                borderRadius: 3,
                boxShadow: '0 20px 60px rgba(0,0,0,0.1)'
              }}
            >
              <LeadForm content={content.leadForm} variant="full" />
            </Paper>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};

export default CTA;
