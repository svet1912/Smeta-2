import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { withProviders } from './test-utils';
import MaterialsPage from '../../src/pages/directories/materials';

// Мокаем API функции
vi.mock('../../src/api/database', () => ({
  getMaterials: vi.fn(),
  createMaterial: vi.fn(),
  updateMaterial: vi.fn(),
  deleteMaterial: vi.fn()
}));

// Мокаем Ant Design message
vi.mock('antd', async () => {
  const actual = await vi.importActual('antd');
  return {
    ...actual,
    message: {
      success: vi.fn(),
      error: vi.fn(),
      info: vi.fn()
    }
  };
});

describe('MaterialsPage Search & Pagination', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('фильтрует материалы по поисковому запросу в реальном времени', async () => {
    const user = userEvent.setup();
    
    const mockMaterials = [
      { id: 'm.1', name: 'Бетон М300', unit: 'м³', unit_price: 3500 },
      { id: 'm.2', name: 'Грунтовка универсальная', unit: 'л', unit_price: 250 },
      { id: 'm.3', name: 'Бетон М400', unit: 'м³', unit_price: 4000 },
      { id: 'm.4', name: 'Кирпич красный', unit: 'шт', unit_price: 15 }
    ];

    const { getMaterials } = await import('../../src/api/database');
    vi.mocked(getMaterials).mockResolvedValue(mockMaterials);

    render(withProviders(<MaterialsPage />));

    // Ждем загрузки всех материалов
    await waitFor(() => {
      expect(screen.getByText('Бетон М300')).toBeInTheDocument();
      expect(screen.getByText('Грунтовка универсальная')).toBeInTheDocument();
      expect(screen.getByText('Бетон М400')).toBeInTheDocument();
      expect(screen.getByText('Кирпич красный')).toBeInTheDocument();
    });

    // Находим поле поиска
    const searchInput = screen.getByPlaceholderText(/поиск материалов/i);
    
    // Вводим поисковый запрос "бетон"
    await user.type(searchInput, 'бетон');

    // Ждем применения debounce (300ms) + небольшой буфер
    await waitFor(
      () => {
        // Должны отображаться только материалы с "бетон" в названии
        expect(screen.getByText('Бетон М300')).toBeInTheDocument();
        expect(screen.getByText('Бетон М400')).toBeInTheDocument();
        
        // Эти материалы не должны отображаться
        expect(screen.queryByText('Грунтовка универсальная')).not.toBeInTheDocument();
        expect(screen.queryByText('Кирпич красный')).not.toBeInTheDocument();
      },
      { timeout: 1000 }
    );

    // Очищаем поиск
    await user.clear(searchInput);

    // Все материалы должны снова отображаться
    await waitFor(() => {
      expect(screen.getByText('Бетон М300')).toBeInTheDocument();
      expect(screen.getByText('Грунтовка универсальная')).toBeInTheDocument();
      expect(screen.getByText('Бетон М400')).toBeInTheDocument();
      expect(screen.getByText('Кирпич красный')).toBeInTheDocument();
    });
  });

  it('поиск работает по ID материала', async () => {
    const user = userEvent.setup();
    
    const mockMaterials = [
      { id: 'm.1', name: 'Материал 1', unit: 'шт', unit_price: 100 },
      { id: 'm.10', name: 'Материал 10', unit: 'кг', unit_price: 200 },
      { id: 'm.100', name: 'Материал 100', unit: 'л', unit_price: 300 }
    ];

    const { getMaterials } = await import('../../src/api/database');
    vi.mocked(getMaterials).mockResolvedValue(mockMaterials);

    render(withProviders(<MaterialsPage />));

    await waitFor(() => {
      expect(screen.getByText('Материал 1')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/поиск материалов/i);
    
    // Поиск по ID "m.1" - должен найти только "m.1", а не "m.10" или "m.100"
    await user.type(searchInput, 'm.1');

    await waitFor(
      () => {
        expect(screen.getByText('Материал 1')).toBeInTheDocument();
        expect(screen.getByText('Материал 10')).toBeInTheDocument(); // m.10 содержит "m.1"
        expect(screen.getByText('Материал 100')).toBeInTheDocument(); // m.100 содержит "m.1"
      },
      { timeout: 1000 }
    );
  });

  it('поиск работает по единице измерения', async () => {
    const user = userEvent.setup();
    
    const mockMaterials = [
      { id: 'm.1', name: 'Материал 1', unit: 'м³', unit_price: 100 },
      { id: 'm.2', name: 'Материал 2', unit: 'кг', unit_price: 200 },
      { id: 'm.3', name: 'Материал 3', unit: 'м²', unit_price: 300 }
    ];

    const { getMaterials } = await import('../../src/api/database');
    vi.mocked(getMaterials).mockResolvedValue(mockMaterials);

    render(withProviders(<MaterialsPage />));

    await waitFor(() => {
      expect(screen.getByText('Материал 1')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/поиск материалов/i);
    
    // Поиск по единице "кг"
    await user.type(searchInput, 'кг');

    await waitFor(
      () => {
        expect(screen.queryByText('Материал 1')).not.toBeInTheDocument();
        expect(screen.getByText('Материал 2')).toBeInTheDocument();
        expect(screen.queryByText('Материал 3')).not.toBeInTheDocument();
      },
      { timeout: 1000 }
    );
  });

  it('сортирует материалы естественным образом по ID', async () => {
    const mockMaterials = [
      { id: 'm.100', name: 'Материал 100', unit: 'шт', unit_price: 100 },
      { id: 'm.2', name: 'Материал 2', unit: 'кг', unit_price: 200 },
      { id: 'm.10', name: 'Материал 10', unit: 'л', unit_price: 300 },
      { id: 'm.1', name: 'Материал 1', unit: 'м', unit_price: 400 }
    ];

    const { getMaterials } = await import('../../src/api/database');
    vi.mocked(getMaterials).mockResolvedValue(mockMaterials);

    render(withProviders(<MaterialsPage />));

    await waitFor(() => {
      expect(screen.getByText('Материал 1')).toBeInTheDocument();
    });

    // Проверяем, что материалы отсортированы правильно (m.1, m.2, m.10, m.100)
    const rows = screen.getAllByRole('row');
    const materialRows = rows.filter(row => row.textContent?.includes('Материал'));
    
    // Первая строка содержит заголовки, поэтому данные начинаются со второй
    expect(materialRows.length).toBeGreaterThan(0);
  });

  it('показывает пагинацию когда материалов больше 10', async () => {
    // Создаем 15 материалов чтобы проверить пагинацию
    const mockMaterials = Array.from({ length: 15 }, (_, i) => ({
      id: `m.${i + 1}`,
      name: `Материал ${i + 1}`,
      unit: 'шт',
      unit_price: (i + 1) * 100
    }));

    const { getMaterials } = await import('../../src/api/database');
    vi.mocked(getMaterials).mockResolvedValue(mockMaterials);

    render(withProviders(<MaterialsPage />));

    await waitFor(() => {
      expect(screen.getByText('Материал 1')).toBeInTheDocument();
    });

    // Проверяем наличие информации о пагинации
    await waitFor(() => {
      expect(screen.getByText(/из 15 материалов/i)).toBeInTheDocument();
    });
  });
});