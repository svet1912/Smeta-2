import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Box, CircularProgress, Typography, Stack } from '@mui/material';

// Landing components
import Header from './Header';
import Hero from './Hero';
import Features from './Features';
import HowItWorks from './HowItWorks';
import Cases from './Cases';
import Pricing from './Pricing';
import FAQ from './FAQ';
import CTA from './CTA';
import Footer from './Footer';
import EnvironmentBanner from 'components/EnvironmentBanner';

const LandingPage = () => {
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadContent = async () => {
      try {
        // Загружаем контент из JSON файла
        const response = await fetch('/content/landing/landing.json');
        if (!response.ok) {
          throw new Error('Failed to load content');
        }
        const data = await response.json();
        setContent(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadContent();
  }, []);

  if (loading) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <Stack spacing={2} alignItems="center">
          <CircularProgress size={60} />
          <Typography variant="h6" color="text.secondary">
            Загрузка...
          </Typography>
        </Stack>
      </Box>
    );
  }

  if (error) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <Typography variant="h6" color="error">
          Ошибка загрузки контента: {error}
        </Typography>
      </Box>
    );
  }

  return (
    <>
      <Helmet>
        <title>{content.meta.title}</title>
        <meta name="description" content={content.meta.description} />
        <meta name="keywords" content={content.meta.keywords} />

        {/* Open Graph */}
        <meta property="og:title" content={content.meta.og.title} />
        <meta property="og:description" content={content.meta.og.description} />
        <meta property="og:image" content={content.meta.og.image} />
        <meta property="og:type" content="website" />

        {/* Canonical URL */}
        <link rel="canonical" href={import.meta.env.VITE_SITE_URL || window.location.origin} />
      </Helmet>

      <Box sx={{ minHeight: '100vh' }}>
        <Header content={content.nav} />
        <Hero content={content.hero} />
        <Features content={content.features} />
        <HowItWorks content={content.how} />
        <Cases content={content.cases} />
        <Pricing content={content.pricing} />
        <FAQ content={content.faq} />
        <CTA content={content.cta} />
        <Footer />
        <EnvironmentBanner />
      </Box>
    </>
  );
};

export default LandingPage;
