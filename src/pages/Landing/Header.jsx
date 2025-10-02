import { useState, useEffect } from 'react';
import {
  AppBar,
  Toolbar,
  Container,
  Typography,
  Button,
  Box,
  useScrollTrigger,
  Slide,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  useMediaQuery,
  useTheme
} from '@mui/material';
import { Menu as MenuIcon, Close as CloseIcon } from '@mui/icons-material';

function HideOnScroll({ children }) {
  const trigger = useScrollTrigger();
  
  return (
    <Slide appear={false} direction="down" in={!trigger}>
      {children}
    </Slide>
  );
}

const Header = ({ content }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('');
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const scrollToSection = (href) => {
    if (href.startsWith('#')) {
      const element = document.querySelector(href);
      if (element) {
        element.scrollIntoView({ 
          behavior: 'smooth',
          block: 'start'
        });
      }
    } else {
      window.location.href = href;
    }
    setMobileOpen(false);
  };

  // Отслеживание активной секции при прокрутке
  useEffect(() => {
    const handleScroll = () => {
      const sections = ['hero', 'features', 'how', 'cases', 'pricing', 'faq'];
      const scrollPosition = window.scrollY + 100;

      for (const section of sections) {
        const element = document.getElementById(section);
        if (element) {
          const { offsetTop, offsetHeight } = element;
          if (scrollPosition >= offsetTop && scrollPosition < offsetTop + offsetHeight) {
            setActiveSection(`#${section}`);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const drawer = (
    <Box sx={{ width: 250, pt: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', px: 1 }}>
        <IconButton onClick={handleDrawerToggle}>
          <CloseIcon />
        </IconButton>
      </Box>
      <List>
        {content.items.map((item) => (
          <ListItem key={item.label} disablePadding>
            <ListItemButton 
              onClick={() => scrollToSection(item.href)}
              sx={{
                backgroundColor: activeSection === item.href ? 'primary.light' : 'transparent',
                color: activeSection === item.href ? 'primary.contrastText' : 'text.primary'
              }}
            >
              <ListItemText primary={item.label} />
            </ListItemButton>
          </ListItem>
        ))}
        <ListItem sx={{ pt: 2 }}>
          <Button
            variant="contained"
            fullWidth
            onClick={() => scrollToSection(content.cta.href)}
          >
            {content.cta.text}
          </Button>
        </ListItem>
      </List>
    </Box>
  );

  return (
    <>
      <HideOnScroll>
        <AppBar 
          position="fixed" 
          sx={{ 
            backgroundColor: 'background.paper',
            backdropFilter: 'blur(10px)',
            borderBottom: '1px solid',
            borderColor: 'divider'
          }}
        >
          <Container maxWidth="lg">
            <Toolbar sx={{ justifyContent: 'space-between' }}>
              <Typography
                variant="h5"
                component="div"
                sx={{ 
                  fontWeight: 'bold',
                  color: 'primary.main',
                  cursor: 'pointer'
                }}
                onClick={() => scrollToSection('#hero')}
              >
                {content.logo}
              </Typography>

              {!isMobile ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  {content.items.map((item) => (
                    <Button
                      key={item.label}
                      onClick={() => scrollToSection(item.href)}
                      sx={{
                        color: activeSection === item.href ? 'primary.main' : 'text.primary',
                        fontWeight: activeSection === item.href ? 600 : 400,
                        textTransform: 'none',
                        '&:hover': {
                          backgroundColor: 'primary.light',
                          color: 'primary.contrastText'
                        }
                      }}
                    >
                      {item.label}
                    </Button>
                  ))}
                  <Button
                    variant="contained"
                    onClick={() => scrollToSection(content.cta.href)}
                    sx={{ ml: 2 }}
                  >
                    {content.cta.text}
                  </Button>
                </Box>
              ) : (
                <IconButton
                  edge="start"
                  color="inherit"
                  onClick={handleDrawerToggle}
                  sx={{ color: 'primary.main' }}
                >
                  <MenuIcon />
                </IconButton>
              )}
            </Toolbar>
          </Container>
        </AppBar>
      </HideOnScroll>

      <Drawer
        variant="temporary"
        anchor="right"
        open={mobileOpen}
        onClose={handleDrawerToggle}
        ModalProps={{ keepMounted: true }}
      >
        {drawer}
      </Drawer>

      {/* Spacer для фиксированного header */}
      <Toolbar />
    </>
  );
};

export default Header;