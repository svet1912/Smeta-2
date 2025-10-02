import { useState } from 'react';
import { 
  Box, 
  Container, 
  Typography, 
  Accordion, 
  AccordionSummary, 
  AccordionDetails,
  Stack 
} from '@mui/material';
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material';

const FAQ = ({ content }) => {
  const [expanded, setExpanded] = useState(false);

  const handleChange = (panel) => (event, isExpanded) => {
    setExpanded(isExpanded ? panel : false);
  };

  return (
    <Box id="faq" sx={{ py: 10, backgroundColor: 'grey.50' }}>
      <Container maxWidth="md">
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
              Часто задаваемые вопросы
            </Typography>
            <Typography
              variant="h6"
              color="text.secondary"
              sx={{ maxWidth: '600px' }}
            >
              Ответы на основные вопросы о системе SMETA360
            </Typography>
          </Stack>

          <Stack spacing={2}>
            {content.map((faq, index) => (
              <Accordion
                key={index}
                expanded={expanded === `panel${index}`}
                onChange={handleChange(`panel${index}`)}
                sx={{
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: '8px !important',
                  '&:before': {
                    display: 'none'
                  },
                  boxShadow: expanded === `panel${index}` ? 3 : 1
                }}
              >
                <AccordionSummary
                  expandIcon={<ExpandMoreIcon />}
                  sx={{
                    backgroundColor: expanded === `panel${index}` ? 'primary.light' : 'background.paper',
                    borderRadius: '8px',
                    '& .MuiAccordionSummary-content': {
                      margin: '12px 0'
                    }
                  }}
                >
                  <Typography
                    variant="h6"
                    sx={{
                      fontWeight: 600,
                      color: expanded === `panel${index}` ? 'primary.contrastText' : 'text.primary'
                    }}
                  >
                    {faq.question}
                  </Typography>
                </AccordionSummary>
                <AccordionDetails
                  sx={{
                    backgroundColor: 'background.paper',
                    borderTop: '1px solid',
                    borderColor: 'divider'
                  }}
                >
                  <Typography
                    variant="body1"
                    color="text.secondary"
                    sx={{ lineHeight: 1.6 }}
                  >
                    {faq.answer}
                  </Typography>
                </AccordionDetails>
              </Accordion>
            ))}
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
};

export default FAQ;