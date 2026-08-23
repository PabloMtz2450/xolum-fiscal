BEGIN;

CREATE TYPE order_status AS ENUM ('DRAFT','VALIDATION_ERROR','READY','RELEASED','INVOICED','CANCELLED');
CREATE TYPE receivable_status AS ENUM ('OPEN','PARTIAL','PAID','CANCELLED');

CREATE TABLE customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code text NOT NULL,
  legal_name text NOT NULL,
  rfc varchar(13) NOT NULL,
  postal_code varchar(5) NOT NULL,
  fiscal_regime varchar(3) NOT NULL,
  cfdi_use varchar(3) NOT NULL,
  email citext,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id,code),
  UNIQUE(tenant_id,rfc),
  UNIQUE(id,tenant_id)
);
CREATE INDEX customers_tenant_name_idx ON customers(tenant_id,legal_name);

CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sku text NOT NULL,
  description text NOT NULL,
  product_service_key varchar(8) NOT NULL,
  commercial_unit text NOT NULL,
  sat_unit_key varchar(3) NOT NULL,
  tax_object varchar(2) NOT NULL DEFAULT '02',
  vat_rate numeric(12,6) NOT NULL DEFAULT 0,
  unit_price numeric(20,6) NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id,sku),
  UNIQUE(id,tenant_id)
);

CREATE TABLE sales_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  folio text NOT NULL,
  customer_id uuid NOT NULL,
  status order_status NOT NULL DEFAULT 'DRAFT',
  currency varchar(3) NOT NULL DEFAULT 'MXN',
  payment_method varchar(3) NOT NULL DEFAULT 'PUE',
  payment_form varchar(2) NOT NULL DEFAULT '03',
  notes text,
  created_by uuid REFERENCES users(id),
  released_by uuid REFERENCES users(id),
  released_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(customer_id,tenant_id) REFERENCES customers(id,tenant_id),
  UNIQUE(tenant_id,folio),
  UNIQUE(id,tenant_id)
);
CREATE INDEX sales_orders_tenant_status_idx ON sales_orders(tenant_id,status,created_at DESC);

CREATE TABLE sales_order_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sales_order_id uuid NOT NULL,
  line_no integer NOT NULL CHECK(line_no > 0),
  product_id uuid,
  sku text,
  description text NOT NULL,
  quantity numeric(20,6) NOT NULL CHECK(quantity > 0),
  commercial_unit text NOT NULL,
  product_service_key varchar(8) NOT NULL,
  sat_unit_key varchar(3) NOT NULL,
  unit_price numeric(20,6) NOT NULL CHECK(unit_price >= 0),
  discount numeric(20,6) NOT NULL DEFAULT 0 CHECK(discount >= 0),
  tax_object varchar(2) NOT NULL,
  vat_rate numeric(12,6) NOT NULL DEFAULT 0,
  purchase_order text,
  purchase_order_line text,
  FOREIGN KEY(sales_order_id,tenant_id) REFERENCES sales_orders(id,tenant_id) ON DELETE CASCADE,
  FOREIGN KEY(product_id,tenant_id) REFERENCES products(id,tenant_id),
  UNIQUE(tenant_id,sales_order_id,line_no)
);
CREATE INDEX sales_order_lines_order_idx ON sales_order_lines(tenant_id,sales_order_id,line_no);

CREATE TABLE receivables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  fiscal_document_id uuid,
  customer_id uuid NOT NULL,
  reference text,
  original_amount numeric(20,6) NOT NULL CHECK(original_amount >= 0),
  balance numeric(20,6) NOT NULL CHECK(balance >= 0),
  due_date date,
  status receivable_status NOT NULL DEFAULT 'OPEN',
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(fiscal_document_id,tenant_id) REFERENCES fiscal_documents(id,tenant_id),
  FOREIGN KEY(customer_id,tenant_id) REFERENCES customers(id,tenant_id),
  UNIQUE(id,tenant_id)
);
CREATE INDEX receivables_tenant_status_idx ON receivables(tenant_id,status,due_date);

CREATE TABLE bank_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  booked_at timestamptz NOT NULL,
  amount numeric(20,6) NOT NULL,
  reference text,
  sender_name text,
  sender_rfc varchar(13),
  matched_receivable_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(matched_receivable_id,tenant_id) REFERENCES receivables(id,tenant_id),
  UNIQUE(id,tenant_id)
);
CREATE INDEX bank_movements_tenant_date_idx ON bank_movements(tenant_id,booked_at DESC);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers FORCE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE products FORCE ROW LEVEL SECURITY;
ALTER TABLE sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_orders FORCE ROW LEVEL SECURITY;
ALTER TABLE sales_order_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_order_lines FORCE ROW LEVEL SECURITY;
ALTER TABLE receivables ENABLE ROW LEVEL SECURITY;
ALTER TABLE receivables FORCE ROW LEVEL SECURITY;
ALTER TABLE bank_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_movements FORCE ROW LEVEL SECURITY;

CREATE POLICY customers_tenant_isolation ON customers USING(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
CREATE POLICY products_tenant_isolation ON products USING(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
CREATE POLICY orders_tenant_isolation ON sales_orders USING(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
CREATE POLICY order_lines_tenant_isolation ON sales_order_lines USING(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
CREATE POLICY receivables_tenant_isolation ON receivables USING(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
CREATE POLICY bank_movements_tenant_isolation ON bank_movements USING(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);

COMMIT;
