import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

// Мок данных материалов
const mockMaterials = [
  { id: 1, name: 'Бетон М200', unit: 'м³', price: 3500, category: 'Бетон' },
  { id: 2, name: 'Кирпич керамический', unit: 'шт', price: 12, category: 'Кирпич' },
  { id: 3, name: 'Цемент М400', unit: 'кг', price: 8, category: 'Цемент' },
  { id: 4, name: 'Песок строительный', unit: 'м³', price: 800, category: 'Песок' },
  { id: 5, name: 'Щебень фракция 5-20', unit: 'м³', price: 1200, category: 'Щебень' }
];

// Мок компонента списка материалов
const MaterialsList = ({ 
  materials = [], 
  loading = false, 
  onSearch,
  onFilter,
  searchTerm = '',
  selectedCategory = 'all'
}: {
  materials?: typeof mockMaterials;
  loading?: boolean;
  onSearch?: (term: string) => void;
  onFilter?: (category: string) => void;
  searchTerm?: string;
  selectedCategory?: string;
}) => {
  return (
    <div data-testid="materials-list">
      <h1>Справочник материалов</h1>
      
      {/* Поиск */}
      <div data-testid="search-section">
        <input
          type="text"
          placeholder="Поиск материалов..."
          value={searchTerm}
          onChange={(e) => onSearch?.(e.target.value)}
          data-testid="search-input"
        />
      </div>
      
      {/* Фильтр по категориям */}
      <div data-testid="filter-section">
        <select 
          value={selectedCategory}
          onChange={(e) => onFilter?.(e.target.value)}
          data-testid="category-filter"
        >
          <option value="all">Все категории</option>
          <option value="Бетон">Бетон</option>
          <option value="Кирпич">Кирпич</option>
          <option value="Цемент">Цемент</option>
        </select>
      </div>

      {/* Статистика */}
      <div data-testid="statistics">
        <span data-testid="total-count">Всего: {materials.length}</span>
        <span data-testid="total-value">
          Общая стоимость: {materials.reduce((sum, m) => sum + m.price, 0)} ₽
        </span>
      </div>
      
      {/* Состояние загрузки */}
      {loading && (
        <div data-testid="loading-spinner">Загрузка материалов...</div>
      )}
      
      {/* Список материалов */}
      {!loading && (
        <div data-testid="materials-table">
          {materials.length === 0 ? (
            <div data-testid="no-materials">Материалы не найдены</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Название</th>
                  <th>Единица</th>
                  <th>Цена</th>
                  <th>Категория</th>
                </tr>
              </thead>
              <tbody>
                {materials.map(material => (
                  <tr key={material.id} data-testid={`material-row-${material.id}`}>
                    <td data-testid={`material-id-${material.id}`}>{material.id}</td>
                    <td data-testid={`material-name-${material.id}`}>{material.name}</td>
                    <td data-testid={`material-unit-${material.id}`}>{material.unit}</td>
                    <td data-testid={`material-price-${material.id}`}>{material.price} ₽</td>
                    <td data-testid={`material-category-${material.id}`}>{material.category}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};

describe('Список материалов', () => {
  it('отображает заголовок и основные элементы', () => {
    render(<MaterialsList materials={mockMaterials} />);

    expect(screen.getByRole('heading', { name: /справочник материалов/i })).toBeInTheDocument();
    expect(screen.getByTestId('search-input')).toBeInTheDocument();
    expect(screen.getByTestId('category-filter')).toBeInTheDocument();
    expect(screen.getByTestId('materials-table')).toBeInTheDocument();
  });

  it('отображает список материалов в таблице', () => {
    render(<MaterialsList materials={mockMaterials} />);

    expect(screen.getByTestId('material-row-1')).toBeInTheDocument();
    expect(screen.getByTestId('material-name-1')).toHaveTextContent('Бетон М200');
    expect(screen.getByTestId('material-unit-1')).toHaveTextContent('м³');
    expect(screen.getByTestId('material-price-1')).toHaveTextContent('3500 ₽');
  });

  it('показывает корректную статистику', () => {
    render(<MaterialsList materials={mockMaterials} />);

    expect(screen.getByTestId('total-count')).toHaveTextContent('Всего: 5');
    
    const expectedTotal = mockMaterials.reduce((sum, m) => sum + m.price, 0);
    expect(screen.getByTestId('total-value')).toHaveTextContent(`Общая стоимость: ${expectedTotal} ₽`);
  });

  it('обрабатывает состояние загрузки', () => {
    render(<MaterialsList loading={true} />);

    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    expect(screen.getByTestId('loading-spinner')).toHaveTextContent('Загрузка материалов...');
    expect(screen.queryByTestId('materials-table')).not.toBeInTheDocument();
  });

  it('показывает сообщение когда нет материалов', () => {
    render(<MaterialsList materials={[]} />);

    expect(screen.getByTestId('no-materials')).toBeInTheDocument();
    expect(screen.getByTestId('no-materials')).toHaveTextContent('Материалы не найдены');
  });

  it('вызывает поиск при вводе текста', async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn();
    
    render(<MaterialsList materials={mockMaterials} onSearch={onSearch} />);

    const searchInput = screen.getByTestId('search-input');
    await user.type(searchInput, 'бетон');

    // Проверяем что поиск был вызван для каждого символа
    expect(onSearch).toHaveBeenCalledTimes(5);
    expect(onSearch).toHaveBeenNthCalledWith(1, 'б');
    expect(onSearch).toHaveBeenNthCalledWith(2, 'е');
    expect(onSearch).toHaveBeenNthCalledWith(3, 'т');
    expect(onSearch).toHaveBeenNthCalledWith(4, 'о');
    expect(onSearch).toHaveBeenNthCalledWith(5, 'н');
  });

  it('вызывает фильтрацию при выборе категории', async () => {
    const user = userEvent.setup();
    const onFilter = vi.fn();
    
    render(<MaterialsList materials={mockMaterials} onFilter={onFilter} />);

    const categoryFilter = screen.getByTestId('category-filter');
    await user.selectOptions(categoryFilter, 'Бетон');

    expect(onFilter).toHaveBeenCalledWith('Бетон');
  });

  it('отображает отфильтрованные результаты', () => {
    const filteredMaterials = mockMaterials.filter(m => m.category === 'Бетон');
    
    render(
      <MaterialsList 
        materials={filteredMaterials}
        selectedCategory="Бетон"
      />
    );

    expect(screen.getByTestId('total-count')).toHaveTextContent('Всего: 1');
    expect(screen.getByTestId('material-row-1')).toBeInTheDocument();
    expect(screen.queryByTestId('material-row-2')).not.toBeInTheDocument();
  });

  it('обновляет статистику при изменении данных', () => {
    const initialMaterials = mockMaterials.slice(0, 2);
    const { rerender } = render(<MaterialsList materials={initialMaterials} />);

    expect(screen.getByTestId('total-count')).toHaveTextContent('Всего: 2');

    rerender(<MaterialsList materials={mockMaterials} />);

    expect(screen.getByTestId('total-count')).toHaveTextContent('Всего: 5');
  });

  it('корректно обрабатывает поиск с результатами', () => {
    const searchResults = mockMaterials.filter(m => 
      m.name.toLowerCase().includes('цемент')
    );
    
    render(
      <MaterialsList 
        materials={searchResults}
        searchTerm="цемент"
      />
    );

    expect(screen.getByTestId('search-input')).toHaveValue('цемент');
    expect(screen.getByTestId('total-count')).toHaveTextContent('Всего: 1');
    expect(screen.getByTestId('material-name-3')).toHaveTextContent('Цемент М400');
  });

  it('отображает все категории в фильтре', () => {
    render(<MaterialsList materials={mockMaterials} />);

    const categoryFilter = screen.getByTestId('category-filter');
    const options = Array.from(categoryFilter.getElementsByTagName('option'));
    
    expect(options).toHaveLength(4); // "Все категории" + 3 категории
    expect(options[0]).toHaveTextContent('Все категории');
    expect(options[1]).toHaveTextContent('Бетон');
    expect(options[2]).toHaveTextContent('Кирпич');
    expect(options[3]).toHaveTextContent('Цемент');
  });
});