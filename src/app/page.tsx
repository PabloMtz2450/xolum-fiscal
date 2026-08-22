const modules = [
  ['Documentos fiscales','CFDI, notas de crédito, REP y expediente fiscal.','ACTIVO'],
  ['Cancelaciones SAT','Validación, motivo, sustitución, solicitud y seguimiento.','ACTIVO'],
  ['Conciliación','Cruce asistido de pagos; automático sólo con referencias confiables.','ACTIVO'],
  ['Importación XML','Integra CFDI externos sin perder trazabilidad.','PREPARADO'],
  ['XOLUM TMS','POD, evidencias y validación de entrega. Se contrata por separado.','OPCIONAL'],
  ['XOLUM Sales','Pedidos y ventas para clientes sin ERP. Se contrata por separado.','OPCIONAL'],
];

export default function Home() {
  return <main className="shell">
    <aside className="sidebar">
      <div className="brand"><span className="mark">X</span><div><strong>XOLUM</strong><small>FISCAL</small></div></div>
      <nav>{['Centro de control','Documentos fiscales','Cancelaciones','REP','Conciliación','Clientes','Addendas','Importar XML','Integraciones','Auditoría','Configuración'].map((x,i)=><button className={i===0?'active':''} key={x}>{x}</button>)}</nav>
      <div className="principle">Si no simplifica,<br/><b>no sirve.</b></div>
    </aside>
    <section className="content">
      <header><div><p className="eyebrow">CENTRO DE CONTROL</p><h1>Tu operación fiscal, conectada.</h1><p className="muted">Lo que necesita atención hoy, sin obligarte a perseguir información entre sistemas.</p></div><button className="primary">+ Nuevo CFDI</button></header>
      <div className="metrics">
        <article><span>Facturado este mes</span><strong>$18.4 M</strong><small>128 CFDI</small></article>
        <article><span>Por cobrar</span><strong>$4.82 M</strong><small>42 documentos</small></article>
        <article><span>Revisión fiscal</span><strong>12</strong><small>requieren atención</small></article>
        <article><span>REP por generar</span><strong>9</strong><small>pagos identificados</small></article>
      </div>
      <div className="grid">
        <section className="panel attention"><div className="panelTitle"><h2>Atención prioritaria</h2><span>Hoy</span></div>
          <div className="row"><b>Cancelación requiere revisión fiscal</b><span className="tag amber">REVISAR</span></div>
          <div className="row"><b>3 pagos con coincidencia alta</b><span className="tag blue">CONCILIAR</span></div>
          <div className="row"><b>9 REP listos para generar</b><span className="tag green">LISTOS</span></div>
          <div className="row"><b>Integración TMS no contratada</b><span className="tag gray">OPCIONAL</span></div>
        </section>
        <section className="panel"><div className="panelTitle"><h2>Flujo fiscal</h2><span>Estado</span></div><div className="flow">{['Datos','Validación','Timbrado','Entrega','Cobranza','Pago','REP','Cierre'].map((x,i)=><div key={x}><i>{i+1}</i><span>{x}</span></div>)}</div><p className="note">La entrega logística se valida automáticamente sólo cuando existe una integración contratada con TMS.</p></section>
      </div>
      <section className="panel modules"><div className="panelTitle"><h2>Capacidades</h2><span>Arquitectura modular</span></div><div className="cards">{modules.map(([title,desc,status])=><article key={title}><div><h3>{title}</h3><p>{desc}</p></div><span className={`status ${status.toLowerCase()}`}>{status}</span></article>)}</div></section>
    </section>
  </main>;
}
