BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TYPE fiscal_status AS ENUM (
  'DRAFT','READY','STAMPING','UNKNOWN','STAMPED',
  'CANCEL_REQUESTED','CANCEL_PENDING','CANCELLED','REJECTED','SAFE_TO_RETRY'
);
CREATE TYPE user_role AS ENUM ('OWNER','ADMIN','FISCAL_MANAGER','BILLER','COLLECTIONS','AUDITOR','READ_ONLY');

CREATE TABLE tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  rfc varchar(13) NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email citext NOT NULL UNIQUE,
  password_hash text NOT NULL,
  mfa_secret_encrypted text,
  mfa_enabled boolean NOT NULL DEFAULT false,
  disabled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE memberships (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role user_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(tenant_id,user_id)
);
CREATE INDEX memberships_user_idx ON memberships(user_id,tenant_id);

-- sessions es tabla de frontera de autenticación. Se resuelve primero por token_hash;
-- active_tenant_id + FK a memberships impiden seleccionar un tenant ajeno.
CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  active_tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  token_hash char(64) NOT NULL UNIQUE,
  csrf_hash char(64) NOT NULL,
  mfa_verified_at timestamptz,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(active_tenant_id,user_id) REFERENCES memberships(tenant_id,user_id) ON DELETE CASCADE
);
CREATE INDEX sessions_user_active_idx ON sessions(user_id,expires_at) WHERE revoked_at IS NULL;
CREATE INDEX sessions_expiry_idx ON sessions(expires_at) WHERE revoked_at IS NULL;

CREATE TABLE fiscal_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  source_id text NOT NULL,
  type char(1) NOT NULL CHECK(type IN('I','E','T','P')),
  status fiscal_status NOT NULL DEFAULT 'DRAFT',
  issuer_rfc varchar(13) NOT NULL,
  receiver_rfc varchar(13),
  total numeric(20,6) NOT NULL DEFAULT 0,
  uuid uuid,
  xml_object_key text,
  xml_sha256 char(64),
  pdf_object_key text,
  pdf_sha256 char(64),
  row_version bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id,source_id),
  UNIQUE(tenant_id,uuid),
  UNIQUE(id,tenant_id)
);
CREATE INDEX fiscal_documents_tenant_status_idx ON fiscal_documents(tenant_id,status,created_at DESC);
CREATE INDEX fiscal_documents_tenant_receiver_idx ON fiscal_documents(tenant_id,receiver_rfc,created_at DESC);

CREATE TABLE stamp_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  fiscal_document_id uuid NOT NULL,
  idempotency_key char(64) NOT NULL,
  provider text NOT NULL,
  status fiscal_status NOT NULL CHECK(status IN('STAMPING','UNKNOWN','STAMPED','REJECTED','SAFE_TO_RETRY')),
  provider_code text,
  provider_message text,
  uuid uuid,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  FOREIGN KEY(fiscal_document_id,tenant_id) REFERENCES fiscal_documents(id,tenant_id) ON DELETE CASCADE,
  UNIQUE(tenant_id,idempotency_key)
);
CREATE INDEX stamp_attempts_document_idx ON stamp_attempts(tenant_id,fiscal_document_id,started_at DESC);
CREATE INDEX stamp_attempts_recovery_idx ON stamp_attempts(tenant_id,status,started_at) WHERE status IN('STAMPING','UNKNOWN');

CREATE TABLE audit_log (
  id bigserial PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  actor_user_id uuid REFERENCES users(id),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  correlation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_tenant_created_idx ON audit_log(tenant_id,created_at DESC);
CREATE INDEX audit_log_correlation_idx ON audit_log(correlation_id);

-- RLS se activa en datos tenant-scoped DESPUÉS de resolver la sesión.
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE fiscal_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_documents FORCE ROW LEVEL SECURITY;
ALTER TABLE stamp_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE stamp_attempts FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log FORCE ROW LEVEL SECURITY;

CREATE POLICY memberships_tenant_isolation ON memberships
  USING(tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid)
  WITH CHECK(tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid);

CREATE POLICY fiscal_tenant_isolation ON fiscal_documents
  USING(tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid)
  WITH CHECK(tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid);

CREATE POLICY attempts_tenant_isolation ON stamp_attempts
  USING(tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid)
  WITH CHECK(tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid);

CREATE POLICY audit_tenant_isolation ON audit_log
  USING(tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid)
  WITH CHECK(tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid);

COMMIT;
