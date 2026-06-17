-- MIPL PPC Module - PostgreSQL Schema
-- Version: 1.0.0

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ROLES
-- ============================================================
CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role_id INTEGER NOT NULL REFERENCES roles(id),
  is_active BOOLEAN DEFAULT TRUE,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PROCESS CATEGORIES
-- ============================================================
CREATE TABLE IF NOT EXISTS process_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  sequence_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- MACHINES
-- ============================================================
CREATE TABLE IF NOT EXISTS machines (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  machine_code VARCHAR(50) UNIQUE NOT NULL,
  process_category_id INTEGER REFERENCES process_categories(id),
  speed_mpm NUMERIC(10,2) DEFAULT 0,
  width_mm INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SHIFTS
-- ============================================================
CREATE TABLE IF NOT EXISTS shifts (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  shift_no INTEGER UNIQUE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CUSTOMERS
-- ============================================================
CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  code VARCHAR(50) UNIQUE NOT NULL,
  contact_person VARCHAR(100),
  email VARCHAR(150),
  phone VARCHAR(20),
  address TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- RAW MATERIALS
-- ============================================================
CREATE TABLE IF NOT EXISTS raw_materials (
  id SERIAL PRIMARY KEY,
  item_code VARCHAR(100) UNIQUE NOT NULL,
  item_name VARCHAR(300) NOT NULL,
  item_type VARCHAR(50),
  item_subtype VARCHAR(50),
  gsm NUMERIC(8,2),
  width_mm INTEGER,
  micron NUMERIC(8,2),
  uom VARCHAR(20) DEFAULT 'KG',
  supplier VARCHAR(200),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- STOCK
-- ============================================================
CREATE TABLE IF NOT EXISTS stock (
  id SERIAL PRIMARY KEY,
  raw_material_id INTEGER UNIQUE NOT NULL REFERENCES raw_materials(id),
  store_stock NUMERIC(12,3) DEFAULT 0,
  qc_hold NUMERIC(12,3) DEFAULT 0,
  process_stock NUMERIC(12,3) DEFAULT 0,
  pending_movement NUMERIC(12,3) DEFAULT 0,
  total_stock NUMERIC(12,3) GENERATED ALWAYS AS (store_stock + process_stock) STORED,
  last_30_cons NUMERIC(12,3) DEFAULT 0,
  pending_po NUMERIC(12,3) DEFAULT 0,
  qc_pending NUMERIC(12,3) DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- STOCK IMPORTS
-- ============================================================
CREATE TABLE IF NOT EXISTS stock_imports (
  id SERIAL PRIMARY KEY,
  filename VARCHAR(300) NOT NULL,
  imported_by UUID REFERENCES users(id),
  record_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  errors JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- FG CODES
-- ============================================================
CREATE TABLE IF NOT EXISTS fg_codes (
  id SERIAL PRIMARY KEY,
  fg_code VARCHAR(100) UNIQUE NOT NULL,
  description VARCHAR(500),
  customer_id INTEGER REFERENCES customers(id),
  fg_type VARCHAR(50),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SPEC SHEETS
-- ============================================================
CREATE TABLE IF NOT EXISTS spec_sheets (
  id SERIAL PRIMARY KEY,
  fg_code_id INTEGER NOT NULL REFERENCES fg_codes(id),
  version INTEGER NOT NULL DEFAULT 1,
  is_current BOOLEAN DEFAULT TRUE,
  total_gsm NUMERIC(8,2),
  width_mm INTEGER,
  job_name VARCHAR(300),
  no_of_colors INTEGER DEFAULT 0,
  no_of_ups INTEGER DEFAULT 1,
  reel_width_mm INTEGER,
  repeat_length_mm NUMERIC(8,2),
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(fg_code_id, version)
);

-- ============================================================
-- SPEC SHEET FILMS (layers)
-- ============================================================
CREATE TABLE IF NOT EXISTS spec_sheet_films (
  id SERIAL PRIMARY KEY,
  spec_sheet_id INTEGER NOT NULL REFERENCES spec_sheets(id) ON DELETE CASCADE,
  layer_no INTEGER NOT NULL,
  raw_material_id INTEGER REFERENCES raw_materials(id),
  item_code VARCHAR(100),
  item_name VARCHAR(300),
  gsm NUMERIC(8,2),
  width_mm INTEGER,
  micron NUMERIC(8,2),
  std_wastage NUMERIC(6,2) DEFAULT 5,
  notes VARCHAR(300)
);

-- ============================================================
-- SPEC SHEET CYLINDERS
-- ============================================================
CREATE TABLE IF NOT EXISTS spec_sheet_cylinders (
  id SERIAL PRIMARY KEY,
  spec_sheet_id INTEGER NOT NULL REFERENCES spec_sheets(id) ON DELETE CASCADE,
  cylinder_type VARCHAR(50),
  circumference_mm NUMERIC(8,2),
  cylinder_code VARCHAR(100),
  supplier VARCHAR(200),
  remarks TEXT
);

-- ============================================================
-- SPEC SHEET PROCESS
-- ============================================================
CREATE TABLE IF NOT EXISTS spec_sheet_process (
  id SERIAL PRIMARY KEY,
  spec_sheet_id INTEGER NOT NULL REFERENCES spec_sheets(id) ON DELETE CASCADE,
  has_printing BOOLEAN DEFAULT FALSE,
  printing_machine_id INTEGER REFERENCES machines(id),
  has_ecl BOOLEAN DEFAULT FALSE,
  ecl_machine_id INTEGER REFERENCES machines(id),
  has_lam1 BOOLEAN DEFAULT FALSE,
  lam1_machine_id INTEGER REFERENCES machines(id),
  has_lam2 BOOLEAN DEFAULT FALSE,
  lam2_machine_id INTEGER REFERENCES machines(id),
  has_slitting BOOLEAN DEFAULT FALSE,
  slitting_machine_id INTEGER REFERENCES machines(id),
  has_pouching BOOLEAN DEFAULT FALSE,
  pouching_machine_id INTEGER REFERENCES machines(id),
  special_instructions TEXT
);

-- ============================================================
-- SALES ORDERS
-- ============================================================
CREATE TABLE IF NOT EXISTS sales_orders (
  id SERIAL PRIMARY KEY,
  so_number VARCHAR(50) UNIQUE NOT NULL,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  fg_code_id INTEGER NOT NULL REFERENCES fg_codes(id),
  job_name VARCHAR(300),
  order_type VARCHAR(20) DEFAULT 'NEW' CHECK (order_type IN ('NEW','REPEAT')),
  qty_kg NUMERIC(12,3) NOT NULL,
  qty_rolls INTEGER,
  delivery_date DATE NOT NULL,
  priority VARCHAR(20) DEFAULT 'NORMAL' CHECK (priority IN ('LOW','NORMAL','HIGH','URGENT')),
  status VARCHAR(30) DEFAULT 'PENDING' CHECK (status IN ('PENDING','CONFIRMED','IN_PROGRESS','COMPLETED','CANCELLED','ON_HOLD')),
  so_date DATE DEFAULT CURRENT_DATE,
  remarks TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- WORK ORDERS
-- ============================================================
CREATE TABLE IF NOT EXISTS work_orders (
  id SERIAL PRIMARY KEY,
  wo_number VARCHAR(50) UNIQUE NOT NULL,
  sales_order_id INTEGER NOT NULL REFERENCES sales_orders(id),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PRODUCTION ORDERS
-- ============================================================
CREATE TABLE IF NOT EXISTS production_orders (
  id SERIAL PRIMARY KEY,
  work_order_id INTEGER NOT NULL REFERENCES work_orders(id),
  sales_order_id INTEGER NOT NULL REFERENCES sales_orders(id),
  spec_sheet_id INTEGER REFERENCES spec_sheets(id),
  spec_overridden BOOLEAN DEFAULT FALSE,
  target_output_kg NUMERIC(12,3),
  target_output_km NUMERIC(12,3),
  status VARCHAR(30) DEFAULT 'OPEN' CHECK (status IN ('OPEN','IN_PROGRESS','COMPLETED','ON_HOLD')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PRODUCTION STAGE TRACKING
-- ============================================================
CREATE TABLE IF NOT EXISTS production_stage_tracking (
  id SERIAL PRIMARY KEY,
  production_order_id INTEGER NOT NULL REFERENCES production_orders(id) ON DELETE CASCADE,
  stage VARCHAR(30) NOT NULL CHECK (stage IN ('PRINTING','ECL','LAM1','LAM2','SLITTING','POUCHING')),
  machine_id INTEGER REFERENCES machines(id),
  target_km NUMERIC(12,3) DEFAULT 0,
  ptd_km NUMERIC(12,3) DEFAULT 0,
  ptd_kg NUMERIC(12,3) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING','IN_PROGRESS','COMPLETED')),
  pass_no INTEGER DEFAULT 1,
  sequence_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(production_order_id, stage, pass_no)
);

-- ============================================================
-- PRODUCTION RM ALLOCATION
-- ============================================================
CREATE TABLE IF NOT EXISTS production_rm_allocation (
  id SERIAL PRIMARY KEY,
  production_order_id INTEGER NOT NULL REFERENCES production_orders(id) ON DELETE CASCADE,
  raw_material_id INTEGER NOT NULL REFERENCES raw_materials(id),
  layer_no INTEGER,
  bom_qty NUMERIC(12,3),
  allocated_qty NUMERIC(12,3) DEFAULT 0,
  issued_qty NUMERIC(12,3) DEFAULT 0,
  rm_status VARCHAR(20) DEFAULT 'UNKNOWN' CHECK (rm_status IN ('AVAILABLE','APO','SHORT','UNKNOWN')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- MACHINE PLANS
-- ============================================================
CREATE TABLE IF NOT EXISTS machine_plans (
  id SERIAL PRIMARY KEY,
  plan_date DATE NOT NULL,
  machine_id INTEGER NOT NULL REFERENCES machines(id),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(plan_date, machine_id)
);

-- ============================================================
-- MACHINE PLAN JOBS
-- ============================================================
CREATE TABLE IF NOT EXISTS machine_plan_jobs (
  id SERIAL PRIMARY KEY,
  machine_plan_id INTEGER NOT NULL REFERENCES machine_plans(id) ON DELETE CASCADE,
  production_order_id INTEGER NOT NULL REFERENCES production_orders(id),
  stage VARCHAR(30),
  pass_no INTEGER DEFAULT 1,
  sequence_no INTEGER NOT NULL,
  shift_no INTEGER,
  from_time TIMESTAMPTZ,
  to_time TIMESTAMPTZ,
  run_hrs NUMERIC(8,4),
  target_km NUMERIC(12,3),
  remarks TEXT,
  is_manually_edited BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PTD ENTRIES (Production To Date)
-- ============================================================
CREATE TABLE IF NOT EXISTS ptd_entries (
  id SERIAL PRIMARY KEY,
  production_order_id INTEGER NOT NULL REFERENCES production_orders(id),
  stage VARCHAR(30) NOT NULL,
  machine_id INTEGER REFERENCES machines(id),
  shift_no INTEGER,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  actual_output_kg NUMERIC(12,3) DEFAULT 0,
  actual_output_km NUMERIC(12,3) DEFAULT 0,
  waste_kg NUMERIC(12,3) DEFAULT 0,
  operator_name VARCHAR(100),
  remarks TEXT,
  entered_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- EXPORT LAYOUTS
-- ============================================================
CREATE TABLE IF NOT EXISTS export_layouts (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  sheet_name VARCHAR(100) NOT NULL,
  column_config JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, sheet_name)
);

-- ============================================================
-- AUDIT LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  action VARCHAR(50) NOT NULL,
  table_name VARCHAR(100),
  record_id VARCHAR(100),
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_raw_materials_item_code ON raw_materials(item_code);
CREATE INDEX IF NOT EXISTS idx_raw_materials_type ON raw_materials(item_type, item_subtype);
CREATE INDEX IF NOT EXISTS idx_stock_rm_id ON stock(raw_material_id);
CREATE INDEX IF NOT EXISTS idx_fg_codes_customer ON fg_codes(customer_id);
CREATE INDEX IF NOT EXISTS idx_spec_sheets_fg ON spec_sheets(fg_code_id, is_current);
CREATE INDEX IF NOT EXISTS idx_sales_orders_status ON sales_orders(status);
CREATE INDEX IF NOT EXISTS idx_sales_orders_customer ON sales_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_delivery ON sales_orders(delivery_date);
CREATE INDEX IF NOT EXISTS idx_production_orders_so ON production_orders(sales_order_id);
CREATE INDEX IF NOT EXISTS idx_production_orders_status ON production_orders(status);
CREATE INDEX IF NOT EXISTS idx_pst_po_id ON production_stage_tracking(production_order_id);
CREATE INDEX IF NOT EXISTS idx_machine_plans_date ON machine_plans(plan_date, machine_id);
CREATE INDEX IF NOT EXISTS idx_ptd_entries_date ON ptd_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_ptd_entries_po ON ptd_entries(production_order_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_table ON audit_log(table_name, record_id);

-- ============================================================
-- SEED DATA
-- ============================================================

-- Roles
INSERT INTO roles (name, description) VALUES
  ('admin', 'System Administrator - Full access'),
  ('ppc_planner', 'PPC Planner - Production planning and scheduling'),
  ('store_inventory', 'Store & Inventory - Stock management'),
  ('machine_operator', 'Machine Operator - PTD entry and machine plans'),
  ('sales', 'Sales - Order booking and customer management'),
  ('management', 'Management - Read-only dashboards and reports')
ON CONFLICT (name) DO NOTHING;

-- Process Categories
INSERT INTO process_categories (name, sequence_order) VALUES
  ('Printing', 1),
  ('ECL', 2),
  ('Lamination', 3),
  ('Slitting', 4),
  ('Pouching', 5)
ON CONFLICT (name) DO NOTHING;

-- Shifts
INSERT INTO shifts (name, shift_no, start_time, end_time) VALUES
  ('Morning', 1, '07:00:00', '15:00:00'),
  ('Afternoon', 2, '15:00:00', '23:00:00'),
  ('Night', 3, '23:00:00', '07:00:00')
ON CONFLICT (shift_no) DO NOTHING;

-- Admin user (password: Admin@1234)
-- bcrypt hash generated with cost factor 10
INSERT INTO users (name, email, password_hash, role_id)
SELECT
  'System Administrator',
  'admin@mipl.com',
  -- bcrypt hash of 'Admin@1234' (rounds=10)
  '$2a$10$Xk5Y1QkX8e5e5e5e5e5e5uQkX8e5e5e5e5e5e5e5e5e5e5e5e5e5e',
  r.id
FROM roles r WHERE r.name = 'admin'
ON CONFLICT (email) DO NOTHING;
