# Современные альтернативы проблемным библиотекам

## 1. Замена react-transition-group → framer-motion

```bash
npm uninstall react-transition-group
npm install framer-motion
```

**Преимущества framer-motion:**
- ✅ Полная совместимость с React 18
- ✅ Более простой API
- ✅ Лучшая производительность
- ✅ Больше возможностей анимации

## 2. Замена MUI v7 → MUI v5 LTS

```bash
npm install @mui/material@^5.16.7 @mui/system@^5.16.7 @mui/icons-material@^5.16.7
```

**Преимущества MUI v5:**
- ✅ Стабильная LTS версия
- ✅ Проверенная совместимость с React 18
- ✅ Меньше багов и проблем совместимости

## 3. Замена @emotion → styled-components

```bash
npm uninstall @emotion/react @emotion/styled
npm install styled-components
```

**Преимущества styled-components:**
- ✅ Нативная поддержка React 18
- ✅ Отсутствие UMD зависимостей с AsyncMode
- ✅ Лучшая типизация в TypeScript

## 4. Альтернатива Ant Design → Mantine

```bash
npm uninstall antd @ant-design/icons @ant-design/colors
npm install @mantine/core @mantine/hooks @mantine/form @mantine/dates @tabler/icons-react
```

**Преимущества Mantine:**
- ✅ Разработан специально для React 18
- ✅ Отсутствие legacy зависимостей
- ✅ Современный дизайн и компоненты
- ✅ Отличная документация

## 5. Полная замена на Chakra UI

```bash
npm uninstall antd @ant-design/icons @mui/material @mui/system @emotion/react @emotion/styled
npm install @chakra-ui/react @emotion/react@^11 @emotion/styled@^11 framer-motion
```

**Преимущества Chakra UI:**
- ✅ Построен на современной архитектуре
- ✅ Использует совместимые версии emotion
- ✅ Встроенная поддержка темизации
- ✅ Простой и понятный API

## 6. Минимальная замена только проблемных пакетов

### Убираем hoist-non-react-statics:
```bash
npm uninstall hoist-non-react-statics
```

### Заменяем в коде на React.forwardRef:
```javascript
// Вместо:
import hoistNonReactStatics from 'hoist-non-react-statics';
const WrappedComponent = hoistNonReactStatics(withSomething(Component), Component);

// Используем:
const WrappedComponent = React.forwardRef((props, ref) => {
  const EnhancedComponent = withSomething(Component);
  return <EnhancedComponent {...props} ref={ref} />;
});
```

## Рекомендуемая стратегия:

1. **Немедленно**: Проверить работу current deploy с нашими патчами
2. **Если не помогает**: Заменить MUI v7 → v5 LTS
3. **Радикальный вариант**: Полный переход на Mantine или Chakra UI

Выберите подход в зависимости от критичности проблемы и времени на рефакторинг.