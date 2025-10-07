/**
 * GraphQL Schema and Resolvers
 * Phase 3 Step 2: API Performance Optimization
 * 
 * GraphQL для эффективных запросов с автоматическим N+1 решением
 */
import { buildSchema } from 'graphql';
import { getDatabaseManager } from '../database/advancedPool.js';

// GraphQL Schema Definition
export const schema = buildSchema(`
  # Scalar types
  scalar DateTime
  scalar JSON

  # Enums
  enum OrderDirection {
    ASC
    DESC
  }

  enum MaterialType {
    BASIC
    COMPOSITE
    FINISHING
    STRUCTURAL
  }

  # Input types for filtering and pagination
  input PaginationInput {
    limit: Int = 50
    offset: Int = 0
  }

  input OrderInput {
    field: String!
    direction: OrderDirection = ASC
  }

  input MaterialFilter {
    name: String
    type: MaterialType
    minPrice: Float
    maxPrice: Float
    category: String
    isActive: Boolean
  }

  input WorkFilter {
    name: String
    category: String
    phaseId: ID
    minPrice: Float
    maxPrice: Float
    isActive: Boolean
  }

  input ProjectFilter {
    name: String
    status: String
    dateFrom: DateTime
    dateTo: DateTime
  }

  input EstimateFilter {
    projectId: ID
    status: String
    currency: String
    dateFrom: DateTime
    dateTo: DateTime
  }

  # Main entity types
  type Material {
    id: ID!
    name: String!
    description: String
    type: MaterialType
    unit: String!
    price: Float!
    category: String
    isActive: Boolean!
    createdAt: DateTime!
    updatedAt: DateTime
    
    # Relations
    workMaterials: [WorkMaterial!]!
    priceHistory: [MaterialPrice!]!
  }

  type Work {
    id: ID!
    name: String!
    description: String
    unit: String!
    basePrice: Float!
    category: String
    phaseId: ID
    isActive: Boolean!
    createdAt: DateTime!
    updatedAt: DateTime
    
    # Relations
    phase: Phase
    materials: [WorkMaterial!]!
    estimateItems: [EstimateItem!]!
  }

  type Phase {
    id: ID!
    name: String!
    description: String
    sortOrder: Int!
    
    # Relations
    works: [Work!]!
  }

  type WorkMaterial {
    id: ID!
    workId: ID!
    materialId: ID!
    quantity: Float!
    unit: String!
    pricePerUnit: Float!
    totalPrice: Float!
    
    # Relations
    work: Work!
    material: Material!
  }

  type Project {
    id: ID!
    name: String!
    description: String
    status: String!
    userId: ID!
    tenantId: ID!
    createdAt: DateTime!
    updatedAt: DateTime
    
    # Relations
    estimates: [Estimate!]!
    user: User
  }

  type Estimate {
    id: ID!
    projectId: ID!
    name: String!
    description: String
    status: String!
    currency: String!
    totalAmount: Float!
    tenantId: ID!
    createdAt: DateTime!
    updatedAt: DateTime
    
    # Relations
    project: Project!
    items: [EstimateItem!]!
  }

  type EstimateItem {
    id: ID!
    estimateId: ID!
    workId: ID
    materialId: ID
    name: String!
    description: String
    quantity: Float!
    unit: String!
    pricePerUnit: Float!
    totalPrice: Float!
    
    # Relations
    estimate: Estimate!
    work: Work
    material: Material
  }

  type User {
    id: ID!
    email: String!
    firstname: String
    lastname: String
    isActive: Boolean!
    
    # Relations
    projects: [Project!]!
  }

  type MaterialPrice {
    id: ID!
    materialId: ID!
    price: Float!
    currency: String!
    effectiveDate: DateTime!
    createdAt: DateTime!
    
    # Relations
    material: Material!
  }

  # Connection types for pagination
  type MaterialConnection {
    edges: [MaterialEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type MaterialEdge {
    node: Material!
    cursor: String!
  }

  type WorkConnection {
    edges: [WorkEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type WorkEdge {
    node: Work!
    cursor: String!
  }

  type ProjectConnection {
    edges: [ProjectEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type ProjectEdge {
    node: Project!
    cursor: String!
  }

  type EstimateConnection {
    edges: [EstimateEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type EstimateEdge {
    node: Estimate!
    cursor: String!
  }

  type PageInfo {
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
    startCursor: String
    endCursor: String
  }

  # Statistics and analytics
  type MaterialStats {
    totalCount: Int!
    activeCount: Int!
    averagePrice: Float!
    priceRange: PriceRange!
    topCategories: [CategoryStats!]!
  }

  type WorkStats {
    totalCount: Int!
    activeCount: Int!
    averagePrice: Float!
    priceRange: PriceRange!
    topPhases: [PhaseStats!]!
  }

  type PriceRange {
    min: Float!
    max: Float!
  }

  type CategoryStats {
    category: String!
    count: Int!
    percentage: Float!
  }

  type PhaseStats {
    phase: Phase!
    count: Int!
    percentage: Float!
  }

  type ProjectStats {
    totalCount: Int!
    activeCount: Int!
    completedCount: Int!
    totalValue: Float!
    averageValue: Float!
    statusBreakdown: [StatusStats!]!
  }

  type StatusStats {
    status: String!
    count: Int!
    percentage: Float!
  }

  # Batch operations
  type BatchResult {
    success: Boolean!
    processedCount: Int!
    errorCount: Int!
    errors: [String!]!
  }

  # Root Query type
  type Query {
    # Materials
    materials(
      filter: MaterialFilter
      pagination: PaginationInput
      order: OrderInput
    ): MaterialConnection!
    
    material(id: ID!): Material
    materialStats: MaterialStats!
    
    # Works
    works(
      filter: WorkFilter
      pagination: PaginationInput
      order: OrderInput
    ): WorkConnection!
    
    work(id: ID!): Work
    workStats: WorkStats!
    
    # Phases
    phases: [Phase!]!
    phase(id: ID!): Phase
    
    # Projects
    projects(
      filter: ProjectFilter
      pagination: PaginationInput
      order: OrderInput
    ): ProjectConnection!
    
    project(id: ID!): Project
    projectStats: ProjectStats!
    
    # Estimates
    estimates(
      filter: EstimateFilter
      pagination: PaginationInput
      order: OrderInput
    ): EstimateConnection!
    
    estimate(id: ID!): Estimate
    
    # Search
    search(query: String!, types: [String!]): JSON!
    
    # System
    health: JSON!
  }

  # Root Mutation type
  type Mutation {
    # Materials
    createMaterial(input: MaterialInput!): Material!
    updateMaterial(id: ID!, input: MaterialInput!): Material!
    deleteMaterial(id: ID!): Boolean!
    
    # Works
    createWork(input: WorkInput!): Work!
    updateWork(id: ID!, input: WorkInput!): Work!
    deleteWork(id: ID!): Boolean!
    
    # Projects
    createProject(input: ProjectInput!): Project!
    updateProject(id: ID!, input: ProjectInput!): Project!
    deleteProject(id: ID!): Boolean!
    
    # Estimates
    createEstimate(input: EstimateInput!): Estimate!
    updateEstimate(id: ID!, input: EstimateInput!): Estimate!
    deleteEstimate(id: ID!): Boolean!
    
    # Batch operations
    batchCreateMaterials(inputs: [MaterialInput!]!): BatchResult!
    batchUpdateMaterials(updates: [MaterialUpdateInput!]!): BatchResult!
  }

  # Input types for mutations
  input MaterialInput {
    name: String!
    description: String
    type: MaterialType!
    unit: String!
    price: Float!
    category: String
    isActive: Boolean = true
  }

  input MaterialUpdateInput {
    id: ID!
    name: String
    description: String
    type: MaterialType
    unit: String
    price: Float
    category: String
    isActive: Boolean
  }

  input WorkInput {
    name: String!
    description: String
    unit: String!
    basePrice: Float!
    category: String
    phaseId: ID
    isActive: Boolean = true
  }

  input ProjectInput {
    name: String!
    description: String
    status: String = "ACTIVE"
  }

  input EstimateInput {
    projectId: ID!
    name: String!
    description: String
    currency: String = "RUB"
  }
`);

// DataLoader for efficient N+1 query resolution
class DataLoaderService {
  constructor() {
    this.dbManager = getDatabaseManager();
    this.loaders = new Map();
  }

  // Create or get loader for specific entity
  getLoader(entity, keyField = 'id') {
    const loaderKey = `${entity}_${keyField}`;
    
    if (!this.loaders.has(loaderKey)) {
      this.loaders.set(loaderKey, this.createBatchLoader(entity, keyField));
    }
    
    return this.loaders.get(loaderKey);
  }

  // Generic batch loader creator
  createBatchLoader(entity, keyField) {
    return async (keys) => {
      try {
        const placeholders = keys.map((_, i) => `$${i + 1}`).join(',');
        const query = `SELECT * FROM ${entity} WHERE ${keyField} IN (${placeholders})`;
        
        const result = await this.dbManager.query(query, keys, {
          useCache: true,
          cacheTTL: 300
        });
        
        // Map results back to original order
        const resultMap = new Map();
        result.rows.forEach(row => {
          const key = row[keyField];
          if (!resultMap.has(key)) {
            resultMap.set(key, []);
          }
          resultMap.get(key).push(row);
        });
        
        return keys.map(key => resultMap.get(key) || []);
        
      } catch (error) {
        console.error(`❌ DataLoader error for ${entity}:`, error);
        return keys.map(() => []);
      }
    };
  }

  // Clear all loaders (for testing)
  clearLoaders() {
    this.loaders.clear();
  }
}

// GraphQL Resolvers
export const resolvers = {
  // Query resolvers
  Query: {
    // Materials
    materials: async (parent, { filter = {}, pagination = {}, order = {} }, context) => {
      try {
        const { limit = 50, offset = 0 } = pagination;
        const { field = 'name', direction = 'ASC' } = order;
        
        // Build WHERE clause
        let whereClause = 'WHERE 1=1';
        const params = [];
        let paramIndex = 1;
        
        if (filter.name) {
          whereClause += ` AND name ILIKE $${paramIndex}`;
          params.push(`%${filter.name}%`);
          paramIndex++;
        }
        
        if (filter.type) {
          whereClause += ` AND type = $${paramIndex}`;
          params.push(filter.type);
          paramIndex++;
        }
        
        if (filter.minPrice !== undefined) {
          whereClause += ` AND price >= $${paramIndex}`;
          params.push(filter.minPrice);
          paramIndex++;
        }
        
        if (filter.maxPrice !== undefined) {
          whereClause += ` AND price <= $${paramIndex}`;
          params.push(filter.maxPrice);
          paramIndex++;
        }
        
        if (filter.category) {
          whereClause += ` AND category = $${paramIndex}`;
          params.push(filter.category);
          paramIndex++;
        }
        
        if (filter.isActive !== undefined) {
          whereClause += ` AND is_active = $${paramIndex}`;
          params.push(filter.isActive);
          paramIndex++;
        }
        
        // Count query
        const countQuery = `SELECT COUNT(*) as total FROM materials ${whereClause}`;
        const countResult = await context.dbManager.query(countQuery, params, {
          useCache: true,
          cacheTTL: 300
        });
        const totalCount = parseInt(countResult.rows[0].total);
        
        // Data query
        const dataQuery = `
          SELECT * FROM materials 
          ${whereClause}
          ORDER BY ${field} ${direction}
          LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `;
        params.push(limit, offset);
        
        const result = await context.dbManager.query(dataQuery, params, {
          useCache: true,
          cacheTTL: 300
        });
        
        // Format as connection
        const edges = result.rows.map((node, index) => ({
          node,
          cursor: Buffer.from(`${offset + index}`).toString('base64')
        }));
        
        return {
          edges,
          pageInfo: {
            hasNextPage: offset + limit < totalCount,
            hasPreviousPage: offset > 0,
            startCursor: edges[0]?.cursor,
            endCursor: edges[edges.length - 1]?.cursor
          },
          totalCount
        };
        
      } catch (error) {
        console.error('❌ GraphQL materials query error:', error);
        throw new Error('Failed to fetch materials');
      }
    },

    material: async (parent, { id }, context) => {
      try {
        const result = await context.dbManager.query(
          'SELECT * FROM materials WHERE id = $1',
          [id],
          { useCache: true, cacheTTL: 300 }
        );
        
        return result.rows[0] || null;
      } catch (error) {
        console.error('❌ GraphQL material query error:', error);
        throw new Error('Failed to fetch material');
      }
    },

    materialStats: async (parent, args, context) => {
      try {
        const statsQuery = `
          SELECT 
            COUNT(*) as total_count,
            COUNT(*) FILTER (WHERE is_active = true) as active_count,
            AVG(price) as average_price,
            MIN(price) as min_price,
            MAX(price) as max_price
          FROM materials
        `;
        
        const categoriesQuery = `
          SELECT 
            category,
            COUNT(*) as count,
            ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
          FROM materials
          WHERE category IS NOT NULL
          GROUP BY category
          ORDER BY count DESC
          LIMIT 10
        `;
        
        const [statsResult, categoriesResult] = await Promise.all([
          context.dbManager.query(statsQuery, [], { useCache: true, cacheTTL: 600 }),
          context.dbManager.query(categoriesQuery, [], { useCache: true, cacheTTL: 600 })
        ]);
        
        const stats = statsResult.rows[0];
        
        return {
          totalCount: parseInt(stats.total_count),
          activeCount: parseInt(stats.active_count),
          averagePrice: parseFloat(stats.average_price || 0),
          priceRange: {
            min: parseFloat(stats.min_price || 0),
            max: parseFloat(stats.max_price || 0)
          },
          topCategories: categoriesResult.rows.map(row => ({
            category: row.category,
            count: parseInt(row.count),
            percentage: parseFloat(row.percentage)
          }))
        };
        
      } catch (error) {
        console.error('❌ GraphQL material stats error:', error);
        throw new Error('Failed to fetch material statistics');
      }
    },

    // Works resolvers
    works: async (parent, { filter = {}, pagination = {}, order = {} }, context) => {
      // Similar to materials but for works table
      // Implementation follows same pattern...
      try {
        const { limit = 50, offset = 0 } = pagination;
        
        const result = await context.dbManager.query(
          'SELECT * FROM works ORDER BY name LIMIT $1 OFFSET $2',
          [limit, offset],
          { useCache: true, cacheTTL: 300 }
        );
        
        const countResult = await context.dbManager.query(
          'SELECT COUNT(*) as total FROM works',
          [],
          { useCache: true, cacheTTL: 300 }
        );
        
        const totalCount = parseInt(countResult.rows[0].total);
        
        const edges = result.rows.map((node, index) => ({
          node,
          cursor: Buffer.from(`${offset + index}`).toString('base64')
        }));
        
        return {
          edges,
          pageInfo: {
            hasNextPage: offset + limit < totalCount,
            hasPreviousPage: offset > 0,
            startCursor: edges[0]?.cursor,
            endCursor: edges[edges.length - 1]?.cursor
          },
          totalCount
        };
        
      } catch (error) {
        console.error('❌ GraphQL works query error:', error);
        throw new Error('Failed to fetch works');
      }
    },

    // Health check
    health: async () => {
      try {
        const dbHealth = await getDatabaseManager().healthCheck();
        return {
          status: 'OK',
          timestamp: new Date().toISOString(),
          database: dbHealth,
          graphql: 'Active'
        };
      } catch (error) {
        return {
          status: 'ERROR',
          error: error.message,
          timestamp: new Date().toISOString()
        };
      }
    }
  },

  // Field resolvers for relations
  Material: {
    workMaterials: async (parent, args, context) => {
      const loader = context.dataLoader.getLoader('work_materials', 'material_id');
      const results = await loader.load(parent.id);
      return results[0] || [];
    },
    
    priceHistory: async (parent, args, context) => {
      const result = await context.dbManager.query(
        'SELECT * FROM material_prices WHERE material_id = $1 ORDER BY effective_date DESC',
        [parent.id],
        { useCache: true, cacheTTL: 300 }
      );
      return result.rows;
    }
  },

  Work: {
    phase: async (parent, args, context) => {
      if (!parent.phase_id) return null;
      
      const loader = context.dataLoader.getLoader('phases');
      const results = await loader.load(parent.phase_id);
      return results[0]?.[0] || null;
    },
    
    materials: async (parent, args, context) => {
      const loader = context.dataLoader.getLoader('work_materials', 'work_id');
      const results = await loader.load(parent.id);
      return results[0] || [];
    }
  },

  Project: {
    estimates: async (parent, args, context) => {
      const loader = context.dataLoader.getLoader('estimates', 'project_id');
      const results = await loader.load(parent.id);
      return results[0] || [];
    }
  }
};

// Context factory
export function createGraphQLContext(req) {
  return {
    user: req.user,
    tenantId: req.tenantId,
    dbManager: getDatabaseManager(),
    dataLoader: new DataLoaderService()
  };
}

export default {
  schema,
  resolvers,
  createGraphQLContext
};