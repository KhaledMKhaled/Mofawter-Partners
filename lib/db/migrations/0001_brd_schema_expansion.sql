-- ============================================================================
-- Migration: 0001_brd_schema_expansion
-- Description: Expand schema to fully support BRD v1 requirements:
--   - Users: add OPERATIONS role, phone, internalCode, status, updatedAt
--   - Clients: add ownershipRuleType, ownershipStatus, updatedAt
--   - Orders: expand to 11 statuses, add orderType, updatedAt
--   - Commissions: 5 statuses, clientId, baseAmount, commissionType, appliedRuleId, paymentBatchId, updatedAt
--   - Packages: add ownershipDurationMonths
--   - New tables: commission_rules, payment_batches, payment_batch_items, audit_logs
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. USERS: add new columns
-- ============================================================================
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS internal_code TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Migrate existing role constraint: drop old CHECK and recreate with OPERATIONS
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('ADMIN', 'OPERATIONS', 'DISTRIBUTOR', 'SALES'));

ALTER TABLE users ADD CONSTRAINT users_status_check
  CHECK (status IN ('ACTIVE', 'INACTIVE'));

-- ============================================================================
-- 2. CLIENTS: add ownership config columns + updatedAt
-- ============================================================================
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS ownership_rule_type TEXT NOT NULL DEFAULT 'FIXED',
  ADD COLUMN IF NOT EXISTS ownership_status TEXT NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE clients ADD CONSTRAINT clients_ownership_rule_type_check
  CHECK (ownership_rule_type IN ('FIXED', 'RENEWABLE', 'MANUAL_OVERRIDE'));

ALTER TABLE clients ADD CONSTRAINT clients_ownership_status_check
  CHECK (ownership_status IN ('ACTIVE', 'EXPIRED', 'OVERRIDDEN'));

-- ============================================================================
-- 3. ORDERS: rename old statuses, expand to 11, add orderType + updatedAt
-- ============================================================================
-- Rename existing PENDING → NEW, COMPLETED → COLLECTED for data continuity
UPDATE orders SET status = 'NEW' WHERE status = 'PENDING';
UPDATE orders SET status = 'COLLECTED' WHERE status = 'COMPLETED';

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN (
    'NEW', 'UNDER_REVIEW', 'APPROVED', 'REJECTED',
    'IN_EXECUTION', 'EXECUTED', 'COLLECTED',
    'COMMISSION_PENDING', 'COMMISSION_READY', 'COMMISSION_PAID', 'CANCELLED'
  ));

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS order_type TEXT NOT NULL DEFAULT 'NEW_SUBSCRIPTION',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE orders ADD CONSTRAINT orders_order_type_check
  CHECK (order_type IN ('NEW_SUBSCRIPTION', 'RENEWAL', 'UPGRADE', 'ADD_ON'));

-- ============================================================================
-- 4. COMMISSIONS: expand statuses, add required columns
-- ============================================================================
-- Migrate UNPAID → PENDING, PAID → PAID (name unchanged)
UPDATE commissions SET status = 'PENDING' WHERE status = 'UNPAID';

ALTER TABLE commissions DROP CONSTRAINT IF EXISTS commissions_status_check;
ALTER TABLE commissions ADD CONSTRAINT commissions_status_check
  CHECK (status IN ('PENDING', 'APPROVED', 'READY_FOR_PAYOUT', 'PAID', 'CANCELLED'));

ALTER TABLE commissions
  ADD COLUMN IF NOT EXISTS client_id INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS base_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_type TEXT NOT NULL DEFAULT 'NEW_SUBSCRIPTION',
  ADD COLUMN IF NOT EXISTS applied_rule_id INTEGER,
  ADD COLUMN IF NOT EXISTS payment_batch_id INTEGER,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Backfill client_id and base_amount from order data
UPDATE commissions c
SET client_id = o.client_id,
    base_amount = o.amount
FROM orders o
WHERE c.order_id = o.id
  AND c.client_id = 0;

ALTER TABLE commissions ADD CONSTRAINT commissions_commission_type_check
  CHECK (commission_type IN ('NEW_SUBSCRIPTION', 'RENEWAL', 'UPGRADE', 'ADD_ON'));

-- ============================================================================
-- 5. PACKAGES: add ownershipDurationMonths
-- ============================================================================
ALTER TABLE packages
  ADD COLUMN IF NOT EXISTS ownership_duration_months INTEGER NOT NULL DEFAULT 60;

-- ============================================================================
-- 6. NEW TABLE: commission_rules
-- ============================================================================
CREATE TABLE IF NOT EXISTS commission_rules (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  package_id INTEGER,
  event_type TEXT NOT NULL,
  beneficiary_type TEXT NOT NULL,
  percentage NUMERIC(5,2) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT commission_rules_event_type_check
    CHECK (event_type IN ('NEW_SUBSCRIPTION', 'RENEWAL', 'UPGRADE', 'ADD_ON')),
  CONSTRAINT commission_rules_beneficiary_type_check
    CHECK (beneficiary_type IN ('DISTRIBUTOR', 'SALES'))
);

-- ============================================================================
-- 7. NEW TABLE: payment_batches
-- ============================================================================
CREATE TABLE IF NOT EXISTS payment_batches (
  id SERIAL PRIMARY KEY,
  beneficiary_type TEXT NOT NULL,
  beneficiary_id INTEGER NOT NULL,
  beneficiary_name TEXT NOT NULL,
  payment_date TIMESTAMPTZ,
  payment_reference TEXT,
  total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  payment_method TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  notes TEXT,
  created_by_id INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT payment_batches_beneficiary_type_check
    CHECK (beneficiary_type IN ('DISTRIBUTOR', 'SALES')),
  CONSTRAINT payment_batches_status_check
    CHECK (status IN ('DRAFT', 'CONFIRMED', 'CANCELLED'))
);

-- ============================================================================
-- 8. NEW TABLE: payment_batch_items
-- ============================================================================
CREATE TABLE IF NOT EXISTS payment_batch_items (
  id SERIAL PRIMARY KEY,
  batch_id INTEGER NOT NULL REFERENCES payment_batches(id),
  commission_id INTEGER NOT NULL UNIQUE,  -- Enforces one-commission-per-batch rule
  client_id INTEGER NOT NULL,
  order_id INTEGER NOT NULL,
  commission_value NUMERIC(14,2) NOT NULL,
  commission_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT payment_batch_items_commission_type_check
    CHECK (commission_type IN ('NEW_SUBSCRIPTION', 'RENEWAL', 'UPGRADE', 'ADD_ON'))
);

-- ============================================================================
-- 9. NEW TABLE: audit_logs
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id INTEGER NOT NULL,
  action_type TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  user_name TEXT NOT NULL,
  user_role TEXT NOT NULL,
  previous_value TEXT,   -- JSON string
  new_value TEXT,        -- JSON string
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT audit_logs_entity_type_check
    CHECK (entity_type IN ('client', 'order', 'commission', 'payment_batch',
                           'commission_rule', 'package', 'settings', 'user')),
  CONSTRAINT audit_logs_action_type_check
    CHECK (action_type IN (
      'CLIENT_CREATED', 'CLIENT_UPDATED', 'CLIENT_REASSIGNED',
      'CLIENT_OWNERSHIP_EXTENDED', 'CLIENT_OWNERSHIP_OVERRIDDEN',
      'ORDER_CREATED', 'ORDER_STATUS_CHANGED', 'ORDER_STATUS_ADMIN_OVERRIDE',
      'COMMISSION_GENERATED', 'COMMISSION_STATUS_CHANGED', 'COMMISSION_CANCELLED',
      'PAYMENT_BATCH_CREATED', 'PAYMENT_BATCH_CONFIRMED', 'PAYMENT_BATCH_CANCELLED',
      'COMMISSION_RULE_CREATED', 'COMMISSION_RULE_UPDATED', 'COMMISSION_RULE_DEACTIVATED',
      'PACKAGE_CREATED', 'PACKAGE_UPDATED', 'PACKAGE_DELETED', 'SETTINGS_UPDATED',
      'USER_CREATED', 'USER_UPDATED', 'USER_DEACTIVATED'
    ))
);

-- Indexes for common audit log queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs (created_at DESC);

-- Indexes for new tables
CREATE INDEX IF NOT EXISTS idx_commissions_client_id ON commissions (client_id);
CREATE INDEX IF NOT EXISTS idx_commissions_payment_batch_id ON commissions (payment_batch_id);
CREATE INDEX IF NOT EXISTS idx_payment_batch_items_batch_id ON payment_batch_items (batch_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_updated_at ON orders (updated_at DESC);

COMMIT;
