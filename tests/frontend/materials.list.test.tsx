import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { withProviders } from './test-utils';
import { mockFetchOnce } from './http';
import MaterialsPage from '../../src/pages/directories/materials';

// Мокаем API функции
vi.mock('../../src/api/database', () => ({
  getMaterials: vi.fn(),
  createMaterial: vi.fn(),
  updateMaterial: vi.fn(),
  deleteMaterial: vi.fn()
}));

// Мокаем Ant Design компоненты для упрощения тестов
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

describe('MaterialsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('загружает и отображает список материалов', async () => {
    const mockMaterials = [
      { id: 'm.1', name: 'Бетон М300', unit: 'м³', unit_price: 3500 },
      { id: 'm.2', name: 'Грунтовка универсальная', unit: 'л', unit_price: 250 }
    ];

    // Импортируем и мокаем getMaterials
    const { getMaterials } = await import('../../src/api/database');
    vi.mocked(getMaterials).mockResolvedValue(mockMaterials);

    render(withProviders(<MaterialsPage />));

    // Проверяем наличие заголовка
    expect(screen.getByText('Справочник материалов')).toBeInTheDocument();

    // Ждем загрузки данных
    await waitFor(() => {
      expect(screen.getByText('Бетон М300')).toBeInTheDocument();
      expect(screen.getByText('Грунтовка универсальная')).toBeInTheDocument();
    });

    // Проверяем статистику
    await waitFor(() => {
      expect(screen.getByText(/всего материалов:/i)).toBeInTheDocument();
    });
  });

  it('фильтрует материалы по поисковому запросу', async () => {
    const mockMaterials = [
      { id: 'm.1', name: 'Бетон М300', unit: 'м³', unit_price: 3500 },
      { id: 'm.2', name: 'Грунтовка универсальная', unit: 'л', unit_price: 250 },
      { id: 'm.3', name: 'Бетон М400', unit: 'м³', unit_price: 4000 }
    ];

    const { getMaterials } = await import('../../src/api/database');
    vi.mocked(getMaterials).mockResolvedValue(mockMaterials);

    render(withProviders(<MaterialsPage />));

    // Ждем загрузки
    await waitFor(() => {
      expect(screen.getByText('Бетон М300')).toBeInTheDocument();
    });

    // Проверяем, что все материалы отображаются
    expect(screen.getByText('Бетон М300')).toBeInTheDocument();
    expect(screen.getByText('Грунтовка универсальная')).toBeInTheDocument();
    expect(screen.getByText('Бетон М400')).toBeInTheDocument();
  });

  it('показывает корректную статистику материалов', async () => {
    const mockMaterials = [
      { id: 'm.1', name: 'Материал 1', unit: 'шт', unit_price: 100, image_url: 'test.jpg', item_url: 'http://test.com' },
      { id: 'm.2', name: 'Материал 2', unit: 'кг', unit_price: 200, image_url: null, item_url: null },
      { id: 'm.3', name: 'Материал 3', unit: 'л', unit_price: 300, image_url: 'test2.jpg', item_url: null }
    ];

    const { getMaterials } = await import('../../src/api/database');
    vi.mocked(getMaterials).mockResolvedValue(mockMaterials);

    render(withProviders(<MaterialsPage />));

    await waitFor(() => {
      expect(screen.getByText('Материал 1')).toBeInTheDocument();
    });

    // Проверяем статистику
    await waitFor(() => {
      // Всего материалов: 3
      expect(screen.getByText(/всего материалов.*3/i)).toBeInTheDocument();
      // С изображениями: 2
      expect(screen.getByText(/с изображениями.*2/i)).toBeInTheDocument();
      // С ссылками: 1
      expect(screen.getByText(/с ссылками.*1/i)).toBeInTheDocument();
      // Средняя цена: (100 + 200 + 300) / 3 = 200
      expect(screen.getByText(/средняя цена.*200\.00.*₽/i)).toBeInTheDocument();
    });
  });

  it('обрабатывает пустой ответ от API', async () => {
    const { getMaterials } = await import('../../src/api/database');
    vi.mocked(getMaterials).mockResolvedValue([]);

    render(withProviders(<MaterialsPage />));

    await waitFor(() => {
      expect(screen.getByText(/всего материалов.*0/i)).toBeInTheDocument();
      expect(screen.getByText(/средняя цена.*0.*₽/i)).toBeInTheDocument();
    });
  });

  it('обрабатывает ошибку загрузки материалов', async () => {
    const { getMaterials } = await import('../../src/api/database');
    vi.mocked(getMaterials).mockRejectedValue(new Error('Network error'));

    // Мокаем console.error чтобы не засорять вывод тестов
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(withProviders(<MaterialsPage />));

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Ошибка загрузки материалов:', expect.any(Error));
    });

    consoleSpy.mockRestore();
  });
});