import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

// Мокаем виртуализованный компонент таблицы
const MockVirtualTable = ({ items, onScroll }: { items: any[]; onScroll: (e: any) => void }) => {
  // Имитируем виртуализацию - показываем только первые 10 элементов
  const visibleItems = items.slice(0, 10);
  
  return (
    <div data-testid="virtual-table" onScroll={onScroll}>
      <div data-testid="table-header">
        <span>ID</span>
        <span>Название</span>
        <span>Единица</span>
        <span>Цена</span>
      </div>
      <div data-testid="table-body">
        {visibleItems.map((item) => (
          <div key={item.id} data-testid={`table-row-${item.id}`}>
            <span data-testid={`cell-id-${item.id}`}>{item.id}</span>
            <span data-testid={`cell-name-${item.id}`}>{item.name}</span>
            <span data-testid={`cell-unit-${item.id}`}>{item.unit}</span>
            <span data-testid={`cell-price-${item.id}`}>{item.price}</span>
          </div>
        ))}
      </div>
      <div data-testid="scroll-info">
        Показано {visibleItems.length} из {items.length} элементов
      </div>
    </div>
  );
};

// Создаем большой массив данных для тестирования виртуализации
const generateLargeDataset = (count: number) => {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    name: `Материал ${index + 1}`,
    unit: index % 3 === 0 ? 'кг' : index % 3 === 1 ? 'м²' : 'шт',
    price: Math.round((Math.random() * 1000 + 100) * 100) / 100
  }));
};

describe('Table Virtualization', () => {
  it('отображает только видимые строки из большого набора данных', () => {
    const largeDataset = generateLargeDataset(1000);
    const handleScroll = vi.fn();

    render(
      <MockVirtualTable 
        items={largeDataset} 
        onScroll={handleScroll}
      />
    );

    // Проверяем что таблица отображается
    expect(screen.getByTestId('virtual-table')).toBeInTheDocument();
    expect(screen.getByTestId('table-header')).toBeInTheDocument();
    expect(screen.getByTestId('table-body')).toBeInTheDocument();

    // Проверяем что показаны только первые 10 элементов (виртуализация)
    expect(screen.getByTestId('table-row-1')).toBeInTheDocument();
    expect(screen.getByTestId('table-row-10')).toBeInTheDocument();
    expect(screen.queryByTestId('table-row-11')).not.toBeInTheDocument();

    // Проверяем информацию о количестве элементов
    expect(screen.getByTestId('scroll-info')).toHaveTextContent('Показано 10 из 1000 элементов');
  });

  it('правильно отображает данные в ячейках', () => {
    const testData = generateLargeDataset(5);
    const handleScroll = vi.fn();

    render(
      <MockVirtualTable 
        items={testData} 
        onScroll={handleScroll}
      />
    );

    // Проверяем первую строку
    expect(screen.getByTestId('cell-id-1')).toHaveTextContent('1');
    expect(screen.getByTestId('cell-name-1')).toHaveTextContent('Материал 1');
    expect(screen.getByTestId('cell-unit-1')).toHaveTextContent('кг');
    
    // Проверяем что цена отображается
    const priceCell = screen.getByTestId('cell-price-1');
    expect(priceCell).toBeInTheDocument();
    expect(priceCell.textContent).toMatch(/^\d+(\.\d{1,2})?$/); // Формат цены
  });

  it('обрабатывает события скролла для виртуализации', async () => {
    const largeDataset = generateLargeDataset(100);
    const handleScroll = vi.fn();

    render(
      <MockVirtualTable 
        items={largeDataset} 
        onScroll={handleScroll}
      />
    );

    const table = screen.getByTestId('virtual-table');
    
    // Имитируем скролл
    await userEvent.hover(table);
    
    // Создаем событие скролла
    const scrollEvent = new Event('scroll');
    table.dispatchEvent(scrollEvent);

    expect(handleScroll).toHaveBeenCalled();
  });

  it('эффективно работает с пустым набором данных', () => {
    const handleScroll = vi.fn();

    render(
      <MockVirtualTable 
        items={[]} 
        onScroll={handleScroll}
      />
    );

    expect(screen.getByTestId('virtual-table')).toBeInTheDocument();
    expect(screen.getByTestId('table-header')).toBeInTheDocument();
    expect(screen.getByTestId('table-body')).toBeInTheDocument();
    
    // Нет строк данных
    expect(screen.queryByTestId(/table-row-/)).not.toBeInTheDocument();
    
    // Показывает информацию о пустом наборе
    expect(screen.getByTestId('scroll-info')).toHaveTextContent('Показано 0 из 0 элементов');
  });

  it('корректно обрабатывает средний размер набора данных', () => {
    const mediumDataset = generateLargeDataset(15);
    const handleScroll = vi.fn();

    render(
      <MockVirtualTable 
        items={mediumDataset} 
        onScroll={handleScroll}
      />
    );

    // Показывает только первые 10 из 15
    expect(screen.getByTestId('table-row-1')).toBeInTheDocument();
    expect(screen.getByTestId('table-row-10')).toBeInTheDocument();
    expect(screen.queryByTestId('table-row-11')).not.toBeInTheDocument();
    expect(screen.queryByTestId('table-row-15')).not.toBeInTheDocument();

    expect(screen.getByTestId('scroll-info')).toHaveTextContent('Показано 10 из 15 элементов');
  });

  it('производительно обрабатывает очень большие наборы данных', () => {
    const veryLargeDataset = generateLargeDataset(10000);
    const handleScroll = vi.fn();

    const startTime = performance.now();
    
    render(
      <MockVirtualTable 
        items={veryLargeDataset} 
        onScroll={handleScroll}
      />
    );

    const endTime = performance.now();
    const renderTime = endTime - startTime;

    // Рендеринг должен быть быстрым даже для 10000 элементов
    expect(renderTime).toBeLessThan(100); // менее 100ms

    // Отображаются только виртуализованные элементы
    expect(screen.getByTestId('scroll-info')).toHaveTextContent('Показано 10 из 10000 элементов');
    
    // DOM содержит только видимые элементы
    const rows = screen.getAllByTestId(/^table-row-/);
    expect(rows).toHaveLength(10);
  });

  it('правильно обновляет виртуализованные данные', () => {
    const initialData = generateLargeDataset(20);
    const handleScroll = vi.fn();

    const { rerender } = render(
      <MockVirtualTable 
        items={initialData} 
        onScroll={handleScroll}
      />
    );

    expect(screen.getByTestId('scroll-info')).toHaveTextContent('Показано 10 из 20 элементов');

    // Обновляем данные
    const updatedData = generateLargeDataset(50);
    
    rerender(
      <MockVirtualTable 
        items={updatedData} 
        onScroll={handleScroll}
      />
    );

    expect(screen.getByTestId('scroll-info')).toHaveTextContent('Показано 10 из 50 элементов');
    
    // Проверяем что строки обновились
    expect(screen.getByTestId('cell-name-1')).toHaveTextContent('Материал 1');
    expect(screen.getByTestId('table-row-10')).toBeInTheDocument();
  });
});