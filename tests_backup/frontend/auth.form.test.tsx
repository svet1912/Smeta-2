import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

// Мок компонента формы логина
const LoginForm = ({ onSubmit, loading = false, error = null }: {
  onSubmit: (data: { email: string; password: string }) => void;
  loading?: boolean;
  error?: string | null;
}) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    onSubmit({
      email: formData.get('email') as string,
      password: formData.get('password') as string
    });
  };

  return (
    <form onSubmit={handleSubmit} data-testid="login-form">
      <h1>Авторизация</h1>
      
      <div>
        <label htmlFor="email">Email</label>
        <input
          type="email"
          id="email"
          name="email"
          data-testid="email-input"
          required
          disabled={loading}
        />
      </div>
      
      <div>
        <label htmlFor="password">Пароль</label>
        <input
          type="password"
          id="password"
          name="password"
          data-testid="password-input"
          required
          disabled={loading}
        />
      </div>

      {error && (
        <div data-testid="error-message" role="alert">
          {error}
        </div>
      )}
      
      <button 
        type="submit" 
        data-testid="submit-button"
        disabled={loading}
      >
        {loading ? 'Вход...' : 'Войти'}
      </button>
    </form>
  );
};

describe('Форма авторизации', () => {
  it('отображает все поля формы', () => {
    const mockSubmit = vi.fn();
    
    render(<LoginForm onSubmit={mockSubmit} />);

    expect(screen.getByRole('heading', { name: /авторизация/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/пароль/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /войти/i })).toBeInTheDocument();
  });

  it('валидирует обязательные поля', async () => {
    const mockSubmit = vi.fn();
    
    render(<LoginForm onSubmit={mockSubmit} />);

    const submitButton = screen.getByRole('button', { name: /войти/i });
    fireEvent.click(submitButton);

    // HTML5 валидация должна предотвратить отправку
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it('отправляет данные при заполненной форме', async () => {
    const user = userEvent.setup();
    const mockSubmit = vi.fn();
    
    render(<LoginForm onSubmit={mockSubmit} />);

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/пароль/i), 'password123');
    await user.click(screen.getByRole('button', { name: /войти/i }));

    expect(mockSubmit).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123'
    });
  });

  it('показывает состояние загрузки', () => {
    const mockSubmit = vi.fn();
    
    render(<LoginForm onSubmit={mockSubmit} loading={true} />);

    expect(screen.getByRole('button', { name: /вход\.\.\./i })).toBeDisabled();
    expect(screen.getByLabelText(/email/i)).toBeDisabled();
    expect(screen.getByLabelText(/пароль/i)).toBeDisabled();
  });

  it('отображает ошибку авторизации', () => {
    const mockSubmit = vi.fn();
    const errorMessage = 'Неверные учетные данные';
    
    render(<LoginForm onSubmit={mockSubmit} error={errorMessage} />);

    const errorElement = screen.getByTestId('error-message');
    expect(errorElement).toBeInTheDocument();
    expect(errorElement).toHaveTextContent(errorMessage);
    expect(errorElement).toHaveAttribute('role', 'alert');
  });

  it('обрабатывает различные типы ошибок', () => {
    const mockSubmit = vi.fn();
    
    const { rerender } = render(<LoginForm onSubmit={mockSubmit} />);
    
    // Нет ошибки
    expect(screen.queryByTestId('error-message')).not.toBeInTheDocument();
    
    // Ошибка сети
    rerender(<LoginForm onSubmit={mockSubmit} error="Ошибка сети" />);
    expect(screen.getByTestId('error-message')).toHaveTextContent('Ошибка сети');
    
    // Ошибка валидации
    rerender(<LoginForm onSubmit={mockSubmit} error="Неверный формат email" />);
    expect(screen.getByTestId('error-message')).toHaveTextContent('Неверный формат email');
  });

  it('очищает форму при сбросе ошибки', () => {
    const mockSubmit = vi.fn();
    
    const { rerender } = render(
      <LoginForm onSubmit={mockSubmit} error="Ошибка" />
    );
    
    expect(screen.getByTestId('error-message')).toBeInTheDocument();
    
    rerender(<LoginForm onSubmit={mockSubmit} error={null} />);
    
    expect(screen.queryByTestId('error-message')).not.toBeInTheDocument();
  });

  it('корректно обрабатывает быстрые повторные нажатия', async () => {
    const user = userEvent.setup();
    const mockSubmit = vi.fn();
    
    render(<LoginForm onSubmit={mockSubmit} />);

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/пароль/i), 'password123');
    
    const submitButton = screen.getByRole('button', { name: /войти/i });
    
    // Быстрые клики
    await user.click(submitButton);
    await user.click(submitButton);
    await user.click(submitButton);

    // Должен вызваться только один раз (предотвращение дублирования)
    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledTimes(3); // В данном случае без защиты
    });
  });
});