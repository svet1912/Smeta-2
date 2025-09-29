-- Миграция для параметров объекта, помещений, конструктивных элементов, инженерных систем
-- Учитывает многопользовательскую систему и роли

CREATE TABLE IF NOT EXISTS object_parameters (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES construction_projects(id) ON DELETE CASCADE,
    building_type VARCHAR(255),
    construction_category INTEGER,
    floors_above_ground INTEGER,
    floors_below_ground INTEGER,
    height_above_ground DECIMAL(10,2),
    height_below_ground DECIMAL(10,2),
    total_area DECIMAL(12,2),
    building_area DECIMAL(12,2),
    estimated_cost DECIMAL(15,2),
    construction_complexity VARCHAR(100),
    seismic_zone INTEGER,
    wind_load INTEGER,
    snow_load INTEGER,
    soil_conditions VARCHAR(255),
    groundwater_level DECIMAL(10,2),
    climate_zone VARCHAR(100),
    tenant_id VARCHAR(255) NOT NULL,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS project_rooms (
    id SERIAL PRIMARY KEY,
    object_parameters_id INTEGER REFERENCES object_parameters(id) ON DELETE CASCADE,
    room_name VARCHAR(255),
    area DECIMAL(10,2),
    height DECIMAL(8,2),
    volume DECIMAL(12,2),
    finish_class VARCHAR(100),
    purpose VARCHAR(255),
    tenant_id VARCHAR(255) NOT NULL,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS constructive_elements (
    id SERIAL PRIMARY KEY,
    object_parameters_id INTEGER REFERENCES object_parameters(id) ON DELETE CASCADE,
    element_type VARCHAR(100),
    material VARCHAR(255),
    characteristics TEXT,
    quantity DECIMAL(12,2),
    unit VARCHAR(50),
    tenant_id VARCHAR(255) NOT NULL,
    created_by INTEGER REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS engineering_systems (
    id SERIAL PRIMARY KEY,
    object_parameters_id INTEGER REFERENCES object_parameters(id) ON DELETE CASCADE,
    system_type VARCHAR(100),
    characteristics TEXT,
    capacity VARCHAR(255),
    notes TEXT,
    tenant_id VARCHAR(255) NOT NULL,
    created_by INTEGER REFERENCES users(id)
);

-- Таблица пользователей и ролей (если еще нет)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    tenant_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Индексы для производительности
CREATE INDEX IF NOT EXISTS idx_object_parameters_tenant ON object_parameters(tenant_id);
CREATE INDEX IF NOT EXISTS idx_project_rooms_tenant ON project_rooms(tenant_id);
CREATE INDEX IF NOT EXISTS idx_constructive_elements_tenant ON constructive_elements(tenant_id);
CREATE INDEX IF NOT EXISTS idx_engineering_systems_tenant ON engineering_systems(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);

-- Пример ролей: admin, manager, viewer
-- Можно расширить таблицей roles и permissions при необходимости
