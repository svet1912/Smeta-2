import { useState } from 'react';
import {
  Box,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Typography,
  Alert,
  CircularProgress,
  Paper,
  Stack,
  Link
} from '@mui/material';
import { Send as SendIcon } from '@mui/icons-material';

const LeadForm = ({ content, variant = 'full' }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    project_type: '',
    budget: '',
    message: '',
    consent: false,
    website: '' // ханипот поле
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null); // 'success', 'error', null
  const [submitMessage, setSubmitMessage] = useState('');

  // UTM параметры и метаданные
  const getUTMParams = () => {
    const urlParams = new URLSearchParams(window.location.search);
    return {
      utm_source: urlParams.get('utm_source') || 'direct',
      utm_medium: urlParams.get('utm_medium') || 'organic',
      utm_campaign: urlParams.get('utm_campaign') || 'none',
      page_path: window.location.pathname
    };
  };

  const validateField = (name, value) => {
    const fieldErrors = {};

    switch (name) {
      case 'name':
        if (!value.trim()) {
          fieldErrors.name = content.messages.validation.required;
        } else if (value.trim().length < 2) {
          fieldErrors.name = 'Имя должно содержать минимум 2 символа';
        }
        break;

      case 'email':
        if (!value.trim()) {
          fieldErrors.email = content.messages.validation.required;
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          fieldErrors.email = content.messages.validation.email;
        }
        break;

      case 'phone':
        if (value && !/^[\+\d\s\(\)\-]{7,20}$/.test(value)) {
          fieldErrors.phone = content.messages.validation.phone;
        }
        break;

      case 'consent':
        if (!value) {
          fieldErrors.consent = content.messages.validation.consent;
        }
        break;
    }

    return fieldErrors;
  };

  const handleInputChange = (e) => {
    const { name, value, checked, type } = e.target;
    const newValue = type === 'checkbox' ? checked : value;

    setFormData((prev) => ({
      ...prev,
      [name]: newValue
    }));

    // Очищаем ошибки при изменении поля
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: null
      }));
    }

    // Валидация в реальном времени для обязательных полей
    const fieldErrors = validateField(name, newValue);
    if (Object.keys(fieldErrors).length > 0) {
      setErrors((prev) => ({
        ...prev,
        ...fieldErrors
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    // Проверяем все обязательные поля
    Object.entries({
      name: formData.name,
      email: formData.email,
      consent: formData.consent
    }).forEach(([field, value]) => {
      const fieldErrors = validateField(field, value);
      Object.assign(newErrors, fieldErrors);
    });

    // Проверяем опциональные поля с валидацией
    if (formData.phone) {
      const phoneErrors = validateField('phone', formData.phone);
      Object.assign(newErrors, phoneErrors);
    }

    // Ханипот проверка
    if (formData.website) {
      newErrors.website = 'Обнаружена подозрительная активность';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus(null);

    try {
      const utmParams = getUTMParams();

      const response = await fetch('/api/lead', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...formData,
          ...utmParams
        })
      });

      const result = await response.json();

      if (response.ok) {
        setSubmitStatus('success');
        setSubmitMessage(result.message || content.messages.success);

        // Очищаем форму при успехе
        setFormData({
          name: '',
          email: '',
          phone: '',
          company: '',
          project_type: '',
          budget: '',
          message: '',
          consent: false,
          website: ''
        });

        // Прокручиваем к сообщению об успехе
        setTimeout(() => {
          const alertElement = document.querySelector('[data-success-alert]');
          if (alertElement) {
            alertElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);
      } else {
        setSubmitStatus('error');
        setSubmitMessage(result.error || content.messages.error);

        // Показываем детальные ошибки валидации
        if (result.details) {
          const serverErrors = {};
          result.details.forEach((error) => {
            serverErrors.server = error;
          });
          setErrors((prev) => ({ ...prev, ...serverErrors }));
        }
      }
    } catch (error) {
      console.error('Ошибка отправки формы:', error);
      setSubmitStatus('error');
      setSubmitMessage('Ошибка сети. Проверьте соединение и попробуйте снова.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Компактная версия для Hero секции
  if (variant === 'compact') {
    return (
      <Paper sx={{ p: 3, maxWidth: 400 }}>
        <Typography variant="h6" gutterBottom>
          Быстрая заявка
        </Typography>

        <form onSubmit={handleSubmit}>
          <Stack spacing={2}>
            <TextField
              name="name"
              label={content.fields.name.label}
              placeholder={content.fields.name.placeholder}
              value={formData.name}
              onChange={handleInputChange}
              error={!!errors.name}
              helperText={errors.name}
              size="small"
              required
            />

            <TextField
              name="email"
              label={content.fields.email.label}
              placeholder={content.fields.email.placeholder}
              value={formData.email}
              onChange={handleInputChange}
              error={!!errors.email}
              helperText={errors.email}
              size="small"
              required
            />

            <FormControlLabel
              control={<Checkbox name="consent" checked={formData.consent} onChange={handleInputChange} size="small" />}
              label={
                <Typography variant="body2">
                  Соглашаюсь с <Link href="#privacy">политикой конфиденциальности</Link>
                </Typography>
              }
            />

            <Button
              type="submit"
              variant="contained"
              disabled={isSubmitting || !formData.name || !formData.email || !formData.consent}
              startIcon={isSubmitting ? <CircularProgress size={20} /> : <SendIcon />}
              size="small"
            >
              {isSubmitting ? 'Отправляем...' : 'Оставить заявку'}
            </Button>
          </Stack>
        </form>

        {submitStatus && (
          <Alert severity={submitStatus} sx={{ mt: 2 }} data-success-alert={submitStatus === 'success'}>
            {submitMessage}
          </Alert>
        )}
      </Paper>
    );
  }

  // Полная версия формы
  return (
    <Box component="form" onSubmit={handleSubmit}>
      <Stack spacing={3}>
        <Stack spacing={2} alignItems="center" textAlign="center">
          <Typography variant="h4" component="h3" sx={{ fontWeight: 'bold' }}>
            {content.title}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {content.subtitle}
          </Typography>
        </Stack>

        {submitStatus && (
          <Alert severity={submitStatus} onClose={() => setSubmitStatus(null)} data-success-alert={submitStatus === 'success'}>
            {submitMessage}
          </Alert>
        )}

        <Stack spacing={2.5}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              name="name"
              label={content.fields.name.label}
              placeholder={content.fields.name.placeholder}
              value={formData.name}
              onChange={handleInputChange}
              error={!!errors.name}
              helperText={errors.name}
              required
              fullWidth
            />

            <TextField
              name="email"
              type="email"
              label={content.fields.email.label}
              placeholder={content.fields.email.placeholder}
              value={formData.email}
              onChange={handleInputChange}
              error={!!errors.email}
              helperText={errors.email}
              required
              fullWidth
            />
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              name="phone"
              label={content.fields.phone.label}
              placeholder={content.fields.phone.placeholder}
              value={formData.phone}
              onChange={handleInputChange}
              error={!!errors.phone}
              helperText={errors.phone}
              fullWidth
            />

            <TextField
              name="company"
              label={content.fields.company.label}
              placeholder={content.fields.company.placeholder}
              value={formData.company}
              onChange={handleInputChange}
              fullWidth
            />
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <FormControl fullWidth>
              <InputLabel>{content.fields.project_type.label}</InputLabel>
              <Select
                name="project_type"
                value={formData.project_type}
                onChange={handleInputChange}
                label={content.fields.project_type.label}
              >
                {content.fields.project_type.options.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>{content.fields.budget.label}</InputLabel>
              <Select name="budget" value={formData.budget} onChange={handleInputChange} label={content.fields.budget.label}>
                {content.fields.budget.options.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>

          <TextField
            name="message"
            label={content.fields.message.label}
            placeholder={content.fields.message.placeholder}
            value={formData.message}
            onChange={handleInputChange}
            multiline
            rows={3}
            fullWidth
          />

          {/* Ханипот поле (скрытое) */}
          <TextField
            name="website"
            value={formData.website}
            onChange={handleInputChange}
            sx={{ display: 'none' }}
            tabIndex={-1}
            autoComplete="off"
          />

          <FormControlLabel
            control={<Checkbox name="consent" checked={formData.consent} onChange={handleInputChange} required />}
            label={
              <Typography variant="body2">
                Соглашаюсь с{' '}
                <Link href="#privacy" sx={{ textDecoration: 'none' }}>
                  политикой конфиденциальности
                </Link>{' '}
                и на обработку персональных данных *
              </Typography>
            }
          />

          {errors.consent && (
            <Typography color="error" variant="caption">
              {errors.consent}
            </Typography>
          )}

          {errors.server && (
            <Typography color="error" variant="caption">
              {errors.server}
            </Typography>
          )}

          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={isSubmitting}
            startIcon={isSubmitting ? <CircularProgress size={20} /> : <SendIcon />}
            sx={{
              py: 1.5,
              fontSize: '1.1rem',
              fontWeight: 'bold',
              textTransform: 'none'
            }}
          >
            {isSubmitting ? content.buttons.submitting : content.buttons.submit}
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
};

export default LeadForm;
