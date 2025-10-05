/**
 * VirtualizedList Component
 * Компонент для виртуализации больших списков
 */
import { useState, useEffect, useRef, useMemo } from 'react';
import { Box, List, ListItem } from '@mui/material';

const VirtualizedList = ({ items = [], itemHeight = 60, containerHeight = 400, overscan = 5, renderItem, onScroll, ...props }) => {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef(null);

  // Вычисляем видимые элементы
  const visibleItems = useMemo(() => {
    const startIndex = Math.floor(scrollTop / itemHeight);
    const endIndex = Math.min(startIndex + Math.ceil(containerHeight / itemHeight) + overscan, items.length);

    return items.slice(Math.max(0, startIndex - overscan), endIndex).map((item, index) => ({
      ...item,
      index: Math.max(0, startIndex - overscan) + index
    }));
  }, [items, itemHeight, containerHeight, scrollTop, overscan]);

  // Общая высота списка
  const totalHeight = items.length * itemHeight;

  // Смещение для виртуализации
  const offsetY = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan) * itemHeight;

  const handleScroll = (event) => {
    const newScrollTop = event.target.scrollTop;
    setScrollTop(newScrollTop);

    if (onScroll) {
      onScroll(newScrollTop);
    }
  };

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll, { passive: true });
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, []);

  return (
    <Box
      ref={containerRef}
      sx={{
        height: containerHeight,
        overflow: 'auto',
        ...props.sx
      }}
    >
      <Box
        sx={{
          height: totalHeight,
          position: 'relative'
        }}
      >
        <Box
          sx={{
            transform: `translateY(${offsetY}px)`,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0
          }}
        >
          <List>
            {visibleItems.map((item) => (
              <ListItem
                key={item.id || item.index}
                sx={{
                  height: itemHeight,
                  minHeight: itemHeight,
                  maxHeight: itemHeight
                }}
              >
                {renderItem ? renderItem(item, item.index) : item}
              </ListItem>
            ))}
          </List>
        </Box>
      </Box>
    </Box>
  );
};

export default VirtualizedList;
