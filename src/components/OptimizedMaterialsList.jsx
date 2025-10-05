/**
 * OptimizedMaterialsList Component
 * Оптимизированный компонент списка материалов с виртуализацией и lazy loading
 */
import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, Typography, Box, Chip, Skeleton, TextField, InputAdornment } from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';
import VirtualizedList from './VirtualizedList';
import OptimizedImage from './OptimizedImage';
import { useDebounce } from 'hooks/usePerformanceOptimization';

const MaterialCard = ({ material, index }) => {
  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ position: 'relative' }}>
        <OptimizedImage src={material.image_url} alt={material.name} height={200} placeholder={true} />
        {material.is_tenant_override && (
          <Chip
            label="Переопределено"
            size="small"
            color="primary"
            sx={{
              position: 'absolute',
              top: 8,
              right: 8
            }}
          />
        )}
      </Box>

      <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        <Typography
          variant="h6"
          component="h3"
          sx={{
            fontSize: '0.9rem',
            fontWeight: 600,
            mb: 1,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            minHeight: '2.5em'
          }}
        >
          {material.name}
        </Typography>

        <Box sx={{ mt: 'auto' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Цена за {material.unit}:
            </Typography>
            <Typography variant="h6" color="primary" sx={{ fontWeight: 600 }}>
              {parseFloat(material.unit_price).toLocaleString('ru-RU')} ₽
            </Typography>
          </Box>

          {material.expenditure && (
            <Typography variant="body2" color="text.secondary">
              Расход: {material.expenditure} {material.unit}
            </Typography>
          )}

          {material.weight && (
            <Typography variant="body2" color="text.secondary">
              Вес: {material.weight} кг
            </Typography>
          )}
        </Box>
      </CardContent>
    </Card>
  );
};

const OptimizedMaterialsList = ({ materials = [], loading = false, onSearch, containerHeight = 600 }) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Debounced search для оптимизации
  const debouncedSearch = useDebounce((term) => {
    if (onSearch) {
      onSearch(term);
    }
  }, 300);

  const handleSearchChange = useCallback(
    (event) => {
      const value = event.target.value;
      setSearchTerm(value);
      debouncedSearch(value);
    },
    [debouncedSearch]
  );

  // Мемоизированный список материалов
  const memoizedMaterials = useMemo(() => {
    if (loading) {
      // Показываем скелетоны во время загрузки
      return Array.from({ length: 20 }, (_, index) => ({
        id: `skeleton-${index}`,
        isSkeleton: true
      }));
    }
    return materials;
  }, [materials, loading]);

  const renderItem = useCallback((item, index) => {
    if (item.isSkeleton) {
      return (
        <Card>
          <Skeleton variant="rectangular" height={200} />
          <CardContent>
            <Skeleton variant="text" height={32} />
            <Skeleton variant="text" height={24} />
            <Skeleton variant="text" height={20} />
          </CardContent>
        </Card>
      );
    }

    return <MaterialCard material={item} index={index} />;
  }, []);

  return (
    <Box>
      {/* Поиск */}
      <Box sx={{ mb: 3 }}>
        <TextField
          fullWidth
          placeholder="Поиск материалов..."
          value={searchTerm}
          onChange={handleSearchChange}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            )
          }}
          sx={{ maxWidth: 400 }}
        />
      </Box>

      {/* Виртуализированный список */}
      <VirtualizedList
        items={memoizedMaterials}
        itemHeight={400}
        containerHeight={containerHeight}
        overscan={3}
        renderItem={renderItem}
        sx={{
          '& .MuiListItem-root': {
            padding: 1,
            '&:nth-of-type(odd)': {
              backgroundColor: 'rgba(0, 0, 0, 0.02)'
            }
          }
        }}
      />

      {/* Информация о количестве */}
      {!loading && (
        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            Показано {materials.length} материалов
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default OptimizedMaterialsList;
