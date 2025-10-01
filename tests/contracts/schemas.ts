import { z } from 'zod';

export const Material = z.object({
  id: z.string(), // ID как строка в реальном API (например "m.84")
  name: z.string(),
  unit: z.string().optional(),
  unit_price: z.string().optional(), // Цена как строка в реальном API
  // Дополнительные поля из реального API
  image_url: z.string().optional(),
  item_url: z.string().optional(),
  expenditure: z.string().nullable().optional(),
  weight: z.string().nullable().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  tenant_id: z.string().nullable().optional()
});

// Пагинированный ответ для материалов
export const MaterialsResponse = z.object({
  data: z.array(Material),
  pagination: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    totalPages: z.number()
  }),
  lastUpdated: z.string().optional()
});

export const Work = z.object({
  id: z.string(), // ID как строка в реальном API (например "w.1")
  name: z.string(),
  unit: z.string(),
  unit_price: z.string(), // Цена как строка в реальном API
  // Дополнительные поля из реального API  
  phase_id: z.string(),
  stage_id: z.string(),
  substage_id: z.string().nullable(),
  sort_order: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
  tenant_id: z.string().nullable(),
  phase_name: z.string(),
  stage_name: z.string(),
  substage_name: z.string().nullable()
});

// Пагинированный ответ для работ
export const WorksResponse = z.object({
  data: z.array(Work),
  pagination: z.object({
    page: z.number(),
    limit: z.number(), 
    total: z.number(),
    totalPages: z.number()
  }),
  lastUpdated: z.string()
});

export const Estimate = z.object({
  id: z.number(),
  name: z.string(),
  status: z.enum(['draft','active','completed']).optional(),
  total_amount: z.number().nullable().optional(),
  // Дополнительные поля
  user_id: z.number().optional(),
  description: z.string().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional()
});

export const Estimates = z.array(Estimate);

// Health endpoint контракт
export const HealthCheck = z.object({
  status: z.literal('OK'),
  message: z.string(),
  timestamp: z.string()
});

// User profile контракт
export const UserProfile = z.object({
  id: z.number(),
  email: z.string().email(),
  firstname: z.string(),
  lastname: z.string(),
  company: z.string().optional(),
  phone: z.string().optional(),
  position: z.string().optional(),
  location: z.string().optional(),
  bio: z.string().optional(),
  is_active: z.boolean().optional(),
  email_verified: z.boolean().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional()
});

// API Response обертки
export const ApiResponse = <T extends z.ZodTypeAny>(dataSchema: T) => z.object({
  success: z.boolean().optional(),
  data: dataSchema.optional(),
  message: z.string().optional(),
  error: z.string().optional()
});

export const PaginatedResponse = <T extends z.ZodTypeAny>(itemSchema: T) => z.object({
  items: z.array(itemSchema),
  total: z.number().optional(),
  page: z.number().optional(),
  limit: z.number().optional(),
  has_more: z.boolean().optional()
});