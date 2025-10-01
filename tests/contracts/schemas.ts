import { z } from 'zod';

export const Material = z.object({
  id: z.number(),
  name: z.string(),
  unit: z.string().optional(),
  unit_price: z.number().optional(),
  // Дополнительные поля из реального API
  code: z.string().optional(),
  category: z.string().optional(),
  group_name: z.string().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional()
});

export const Materials = z.array(Material);

export const Work = z.object({
  id: z.number(),
  name: z.string(),
  code: z.string().optional(),
  // Дополнительные поля из реального API
  unit: z.string().optional(),
  category: z.string().optional(),
  group_name: z.string().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional()
});

export const Works = z.array(Work);

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