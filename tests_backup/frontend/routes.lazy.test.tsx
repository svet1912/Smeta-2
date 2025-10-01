import React, { Suspense, lazy } from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';

// Создаем мок-компоненты для ленивой загрузки
const MockEstimatesPage = () => <div><h1>Сметы</h1><p>Страница управления сметами</p></div>;
const MockMaterialsPage = () => <div><h1>Материалы</h1><p>Справочник материалов</p></div>;

// Мокаем ленивую загрузку страниц
vi.mock('../../src/pages/calculations/estimate', () => ({
  default: MockEstimatesPage
}));

vi.mock('../../src/pages/directories/materials', () => ({
  default: MockMaterialsPage
}));

const EstimatesPage = lazy(() => import('../../src/pages/calculations/estimate'));
const MaterialsPage = lazy(() => import('../../src/pages/directories/materials'));

describe('Lazy Routes', () => {
  it('лениво подгружает страницу смет', async () => {
    render(
      <MemoryRouter initialEntries={['/estimates']}>
        <Suspense fallback={<div>Загрузка...</div>}>
          <Routes>
            <Route path="/estimates" element={<EstimatesPage />} />
          </Routes>
        </Suspense>
      </MemoryRouter>
    );

    // Сначала показывается индикатор загрузки
    expect(screen.getByText(/загрузка/i)).toBeInTheDocument();

    // Затем загружается компонент
    const heading = await screen.findByRole('heading', { name: /сметы/i });
    expect(heading).toBeInTheDocument();
    expect(screen.getByText(/страница управления сметами/i)).toBeInTheDocument();
  });

  it('лениво подгружает страницу материалов', async () => {
    render(
      <MemoryRouter initialEntries={['/materials']}>
        <Suspense fallback={<div>Загрузка страницы...</div>}>
          <Routes>
            <Route path="/materials" element={<MaterialsPage />} />
          </Routes>
        </Suspense>
      </MemoryRouter>
    );

    // Показывается индикатор загрузки
    expect(screen.getByText(/загрузка страницы/i)).toBeInTheDocument();

    // Загружается страница материалов
    const heading = await screen.findByRole('heading', { name: /материалы/i });
    expect(heading).toBeInTheDocument();
    expect(screen.getByText(/справочник материалов/i)).toBeInTheDocument();
  });

  it('показывает fallback компонент до загрузки маршрута', () => {
    // Создаем компонент который никогда не резолвится
    const NeverLoadingPage = lazy(() => new Promise(() => {}));

    render(
      <MemoryRouter initialEntries={['/never-loading']}>
        <Suspense fallback={<div>Компонент загружается...</div>}>
          <Routes>
            <Route path="/never-loading" element={<NeverLoadingPage />} />
          </Routes>
        </Suspense>
      </MemoryRouter>
    );

    // Fallback должен отображаться постоянно
    expect(screen.getByText(/компонент загружается/i)).toBeInTheDocument();
  });

  it('обрабатывает несколько ленивых маршрутов', async () => {
    render(
      <MemoryRouter initialEntries={['/app']}>
        <Suspense fallback={<div>Загрузка приложения...</div>}>
          <Routes>
            <Route path="/app/estimates" element={<EstimatesPage />} />
            <Route path="/app/materials" element={<MaterialsPage />} />
            <Route path="/app" element={<div>Главная страница приложения</div>} />
          </Routes>
        </Suspense>
      </MemoryRouter>
    );

    // Отображается статичная страница без ленивой загрузки
    expect(screen.getByText(/главная страница приложения/i)).toBeInTheDocument();
  });

  it('переключается между ленивыми маршрутами', async () => {
    const TestApp = () => {
      return (
        <MemoryRouter initialEntries={['/estimates']}>
          <Suspense fallback={<div>Переключение страниц...</div>}>
            <Routes>
              <Route path="/estimates" element={<EstimatesPage />} />
              <Route path="/materials" element={<MaterialsPage />} />
            </Routes>
          </Suspense>
        </MemoryRouter>
      );
    };

    const { rerender } = render(<TestApp />);

    // Загружается страница смет
    await screen.findByRole('heading', { name: /сметы/i });
    expect(screen.getByText(/страница управления сметами/i)).toBeInTheDocument();

    // Имитируем переход на другую страницу
    rerender(
      <MemoryRouter initialEntries={['/materials']}>
        <Suspense fallback={<div>Переключение страниц...</div>}>
          <Routes>
            <Route path="/estimates" element={<EstimatesPage />} />
            <Route path="/materials" element={<MaterialsPage />} />
          </Routes>
        </Suspense>
      </MemoryRouter>
    );

    // Загружается страница материалов
    await screen.findByRole('heading', { name: /материалы/i });
    expect(screen.getByText(/справочник материалов/i)).toBeInTheDocument();
  });
});