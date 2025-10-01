import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { vi } from 'vitest';
import AuthLogin from '../../src/sections/auth/AuthLogin';
import { withProviders } from './test-utils';
import * as authApi from '../../src/api/auth';

// Мокаем AuthContext
const mockAuthContext = {
  updateUser: vi.fn(),
  user: null
};

vi.mock('../../src/contexts/AuthContext', () => ({
  useAuth: () => mockAuthContext
}));

// Мокаем навигацию
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate
  };
});

// Мокаем API
vi.mock('../../src/api/auth');

const theme = createTheme();

const TestWrapper = ({ children }) => (
  <BrowserRouter>
    <ThemeProvider theme={theme}>
      {withProviders(children)}
    </ThemeProvider>
  </BrowserRouter>
);

describe('AuthLogin Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('рендерит форму логина с правильными полями', () => {
    render(
      <TestWrapper>
        <AuthLogin />
      </TestWrapper>
    );

    expect(screen.getByLabelText(/email адрес/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/пароль/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /войти/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/запомнить меня/i)).toBeInTheDocument();
  });

  it('валидирует поля и показывает ошибки', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <AuthLogin />
      </TestWrapper>
    );

    // Очищаем поля и пытаемся отправить пустую форму
    const emailField = screen.getByLabelText(/email адрес/i);
    const passwordField = screen.getByLabelText(/пароль/i);
    
    await user.clear(emailField);
    await user.clear(passwordField);
    await user.click(screen.getByRole('button', { name: /войти/i }));

    await waitFor(() => {
      expect(screen.getByText(/email обязателен/i)).toBeInTheDocument();
      expect(screen.getByText(/пароль обязателен/i)).toBeInTheDocument();
    });
  });

  it('успешно отправляет форму с валидными данными', async () => {
    const user = userEvent.setup();
    
    // Мокаем успешный ответ API
    vi.mocked(authApi.loginUser).mockResolvedValue({
      success: true,
      data: {
        user: { id: 1, email: 'test@example.com', name: 'Test User' },
        token: 'fake-jwt-token'
      }
    });

    render(
      <TestWrapper>
        <AuthLogin />
      </TestWrapper>
    );

    const emailField = screen.getByLabelText(/email адрес/i);
    const passwordField = screen.getByLabelText(/пароль/i);

    await user.clear(emailField);
    await user.clear(passwordField);
    await user.type(emailField, 'test@example.com');
    await user.type(passwordField, 'password123');
    await user.click(screen.getByRole('button', { name: /войти/i }));

    await waitFor(() => {
      expect(authApi.loginUser).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123'
      });
      expect(mockAuthContext.updateUser).toHaveBeenCalledWith({
        id: 1,
        email: 'test@example.com',
        name: 'Test User'
      });
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard/default');
    });
  });

  it('показывает ошибку при неудачном логине', async () => {
    const user = userEvent.setup();
    
    // Мокаем неудачный ответ API
    vi.mocked(authApi.loginUser).mockResolvedValue({
      success: false,
      message: 'Неверный email или пароль'
    });

    render(
      <TestWrapper>
        <AuthLogin />
      </TestWrapper>
    );

    const emailField = screen.getByLabelText(/email адрес/i);
    const passwordField = screen.getByLabelText(/пароль/i);

    await user.clear(emailField);
    await user.clear(passwordField);
    await user.type(emailField, 'wrong@example.com');
    await user.type(passwordField, 'wrongpassword');
    await user.click(screen.getByRole('button', { name: /войти/i }));

    await waitFor(() => {
      expect(screen.getByText(/неверный email или пароль/i)).toBeInTheDocument();
    });
  });

  it('переключает видимость пароля', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <AuthLogin />
      </TestWrapper>
    );

    const passwordField = screen.getByLabelText(/пароль/i);
    const toggleButton = screen.getByRole('button', { name: /toggle password visibility/i });

    // Изначально пароль скрыт
    expect(passwordField).toHaveAttribute('type', 'password');

    // Кликаем на переключатель
    await user.click(toggleButton);
    expect(passwordField).toHaveAttribute('type', 'text');

    // Кликаем еще раз
    await user.click(toggleButton);
    expect(passwordField).toHaveAttribute('type', 'password');
  });
});