import pg from 'pg';

const { Client } = pg;
const url = process.env.LOCAL_RLS_DATABASE_URL || 'postgresql://xolum_local_app:xolum_app_local_2026@localhost:54329/xolum_fiscal';
const tenantOne = '11111111-1111-4111-8111-111111111111';
const tenantTwo = '22222222-2222-4222-8222-222222222222';

async function count(client, table) {
  const result = await client.query(`select count(*)::int as count from ${table}`);
  return result.rows[0].count;
}

async function visibleForTenant(tenantId) {
  const client = new Client({ connectionString:url });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query("select set_config('app.tenant_id',$1,true)",[tenantId]);
    const summary = {
      customers: await count(client,'customers'),
      products: await count(client,'products'),
      orders: await count(client,'sales_orders'),
      documents: await count(client,'fiscal_documents'),
      attempts: await count(client,'stamp_attempts'),
      audit: await count(client,'audit_log'),
    };
    await client.query('ROLLBACK');
    return summary;
  } finally {
    await client.end();
  }
}

const one = await visibleForTenant(tenantOne);
const two = await visibleForTenant(tenantTwo);
console.log('Tenant XOLUM DEMO:', one);
console.log('Tenant ACME DEMO:', two);

if (one.customers < 5 || one.orders < 5 || one.documents < 6) throw new Error('LOCAL_SEED_INCOMPLETE_TENANT_ONE');
if (two.customers !== 1 || two.orders !== 1 || two.documents !== 1) throw new Error('LOCAL_RLS_OR_SEED_INVALID_TENANT_TWO');
console.log('✅ PostgreSQL local, seed y aislamiento RLS responden como se espera.');
