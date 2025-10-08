# План замены проблемных библиотек на React 18 совместимые

## Проблемные библиотеки и их замены:

### 1. react-transition-group@4.4.5 → framer-motion
**Проблема**: Старая версия react-transition-group использует AsyncMode
**Решение**: Современная библиотека анимаций Framer Motion
```bash
npm uninstall react-transition-group
npm install framer-motion
```

### 2. @emotion/react@11.14.0 → @emotion/react@11.15.0+
**Проблема**: Версия 11.14.0 содержит UMD файлы с AsyncMode
**Решение**: Обновить до последней версии или заменить на styled-components
```bash
npm install @emotion/react@latest @emotion/styled@latest
# ИЛИ
npm uninstall @emotion/react @emotion/styled
npm install styled-components
```

### 3. hoist-non-react-statics@3.3.2 → удалить или заменить
**Проблема**: Прямое использование AsyncMode в коде
**Решение**: Использовать React.forwardRef и современные паттерны
```bash
npm uninstall hoist-non-react-statics
```

### 4. @mui/material → альтернативы
**Проблема**: MUI использует все вышеперечисленные библиотеки
**Решения**:
- Обновить MUI до последней версии
- Заменить на Mantine, Chakra UI или Ant Design (только antd без @ant-design/icons)

## Рекомендуемый подход:
1. Заменить react-transition-group на framer-motion
2. Обновить @emotion до последней версии
3. Убрать прямые зависимости от hoist-non-react-statics
4. Обновить MUI или заменить на современную альтернативу