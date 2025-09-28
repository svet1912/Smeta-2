// API клиент для работы с связями работа-материал
const API_BASE_URL = 'http://localhost:3001';

// Получить JWT токен из localStorage
const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};

export const workMaterialsApi = {
  // Добавить материал к работе
  addMaterialToWork: async (workId, materialData) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/works/${workId}/materials`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          material_id: materialData.material_id,
          consumption_per_work_unit: materialData.consumption_per_work_unit || 1,
          waste_coeff: materialData.waste_coeff || 1
        })
      });

      if (response.ok) {
        const result = await response.json();
        return { success: true, data: result };
      } else {
        const error = await response.json();
        return { success: false, message: error.error || 'Ошибка добавления материала' };
      }
    } catch (error) {
      console.error('Ошибка при добавлении материала к работе:', error);
      return { success: false, message: 'Ошибка сети при добавлении материала' };
    }
  },

  // Обновить связь работа-материал
  updateWorkMaterial: async (workId, materialId, materialData) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/works/${workId}/materials/${materialId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          consumption_per_work_unit: materialData.consumption_per_work_unit || 1,
          waste_coeff: materialData.waste_coeff || 1
        })
      });

      if (response.ok) {
        const result = await response.json();
        return { success: true, data: result };
      } else {
        const error = await response.json();
        return { success: false, message: error.error || 'Ошибка обновления материала' };
      }
    } catch (error) {
      console.error('Ошибка при обновлении материала:', error);
      return { success: false, message: 'Ошибка сети при обновлении материала' };
    }
  },

  // Удалить материал из работы
  removeMaterialFromWork: async (workId, materialId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/works/${workId}/materials/${materialId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        }
      });

      if (response.ok) {
        return { success: true };
      } else {
        const error = await response.json();
        return { success: false, message: error.error || 'Ошибка удаления материала' };
      }
    } catch (error) {
      console.error('Ошибка при удалении материала:', error);
      return { success: false, message: 'Ошибка сети при удалении материала' };
    }
  },

  // Получить все материалы для работы
  getWorkMaterials: async (workId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/works/${workId}/materials`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        }
      });

      if (response.ok) {
        const result = await response.json();
        return { success: true, data: result };
      } else {
        const error = await response.json();
        return { success: false, message: error.error || 'Ошибка загрузки материалов' };
      }
    } catch (error) {
      console.error('Ошибка при загрузке материалов работы:', error);
      return { success: false, message: 'Ошибка сети при загрузке материалов' };
    }
  }
};

export default workMaterialsApi;