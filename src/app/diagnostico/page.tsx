import fs from 'node:fs';
import path from 'node:path';
import { Client } from 'pg';

export const dynamic = 'force-dynamic';

type Check = { name:string; ok:boolean; detail:string };

async function databaseChecks(): Promise<Check[]> {
  const url = process.env.DATABASE_URL;
  if (!url) return [{ name:'PostgreSQL', ok:false, detail:'DATABASE_URL no configurada' }];
  const client = new Client({ connectionString:url, ssl:process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized:true } : false });
  try {
    await client.connect();
    const result = await client.query(`select
      (select count(*) from tenants)::int tenants,
      (select count(*) from users)::int users,
      (select count(*) from customers)::int customers,
      (select count(*) from products)::int products,
      (select count(*) from sales_orders)::int orders,
      (select count(*) from fiscal_documents)::int documents,
      (select count(*) from stamp_attempts)::int attempts`);
    const r = result.rows[0];
    return [
      { name:'PostgreSQL', ok:true, detail:'Conexión correcta' },
      { name:'Seed local', ok:r.tenants >= 2 && r.users >= 7, detail:`${r.tenants} tenants · ${r.users} usuarios` },
      { name:'Sales Lite', ok:r.customers >= 6 && r.products >= 6 && r.orders >= 6, detail:`${r.customers} clientes · ${r.products} productos · ${r.orders} pedidos` },
      { name:'Estados fiscales', ok:r.documents >= 7 && r.attempts >= 2, detail:`${r.documents} CFDI demo · ${r.attempts} intentos PAC` },
    ];
  } catch (error) {
    return [{ name:'PostgreSQL', ok:false, detail:error instanceof Error ? error.message : 'Error desconocido' }];
  } finally {
    await client.end().catch(()=>undefined);
  }
}

function fileConfigured(envName:string) {
  const value = process.env[envName];
  return Boolean(value && fs.existsSync(path.resolve(value)));
}

export default async function DiagnosticoPage() {
  const db = await databaseChecks();
  const checks: Check[] = [
    ...db,
    { name:'Finkok DEMO', ok:Boolean(process.env.FINKOK_USERNAME && process.env.FINKOK_PASSWORD), detail:process.env.FINKOK_USERNAME ? 'Credenciales configuradas' : 'Pendiente credenciales DEMO' },
    { name:'CSD de prueba', ok:fileConfigured('CSD_CERTIFICATE_PATH') && fileConfigured('CSD_PRIVATE_KEY_PATH'), detail:fileConfigured('CSD_CERTIFICATE_PATH') ? 'Archivos configurados' : 'Pendiente CSD de pruebas' },
    { name:'Cadena original SAT', ok:fileConfigured('SAT_CADENA_XSLT_PATH'), detail:process.env.SAT_CADENA_XSLT_PATH ?? 'Ruta no configurada' },
    { name:'XSD SAT local', ok:Boolean(process.env.SAT_XSD_BUNDLE_DIR && fs.existsSync(path.resolve(process.env.SAT_XSD_BUNDLE_DIR))), detail:process.env.SAT_XSD_BUNDLE_DIR ?? 'Ruta no configurada' },
    { name:'Endpoints Sales Lite', ok:false, detail:'Pendiente conectar UI a repositorios PostgreSQL' },
    { name:'Object Storage/KMS', ok:false, detail:'No requerido para demo local; obligatorio antes de producción' },
    { name:'Finkok E2E I/E/T/P', ok:false, detail:'Se habilita cuando existan credenciales DEMO + CSD de prueba' },
  ];

  return <main style={{maxWidth:1100,margin:'0 auto',padding:'40px 24px',fontFamily:'Arial, sans-serif'}}>
    <p style={{fontWeight:700,color:'#0b9f85',letterSpacing:1}}>XOLUM FISCAL · LOCAL</p>
    <h1 style={{fontSize:38,margin:'8px 0'}}>Diagnóstico de preparación</h1>
    <p style={{color:'#667085',marginBottom:28}}>Muestra qué ya funciona en el entorno local y qué falta conectar. No utiliza datos reales.</p>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))',gap:14}}>
      {checks.map((check)=><section key={check.name} style={{border:'1px solid #dfe6ef',borderRadius:14,padding:18,background:'#fff'}}>
        <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center'}}>
          <strong>{check.name}</strong>
          <span style={{fontWeight:800,color:check.ok?'#087d4d':'#9a5e00'}}>{check.ok?'✓ LISTO':'• PENDIENTE'}</span>
        </div>
        <p style={{color:'#667085',fontSize:14,marginBottom:0}}>{check.detail}</p>
      </section>)}
    </div>
    <p style={{marginTop:28,color:'#667085'}}>Para reconstruir todo: <code>npm run local:reset</code> · Para validar RLS: <code>npm run local:check</code></p>
  </main>;
}
