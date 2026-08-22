const modules = [
  ['Sales Lite','Clientes, productos y pedidos mínimos para dejar todo listo antes del timbrado.','ACTIVO'],
  ['Documentos fiscales','CFDI 4.0, notas de crédito, REP y expediente fiscal.','ACTIVO'],
  ['Cancelaciones SAT','Validación, motivo, sustitución, solicitud y seguimiento.','ACTIVO'],
  ['Complementos','Base preparada para complementos que viajan dentro del CFDI antes del timbrado.','PREPARADO'],
  ['Conciliación','Cruce asistido de pagos; automático sólo con referencias confiables.','ACTIVO'],
  ['Importación XML','Integra CFDI externos sin perder trazabilidad.','PREPARADO'],
  ['XOLUM Addendas','Cada addenda se diseña, valida y comercializa por separado.','OPCIONAL'],
  ['XOLUM TMS','POD, evidencias y validación de entrega. Se contrata por separado.','OPCIONAL'],
];

export default function Home() {
  return <main className="shell">
    <aside className="sidebar">
      <div className="brand"><span className="mark">X</span><div><strong>XOLUM</strong><small>FISCAL</small></div></div>
      <nav>{['Centro de control','Pedidos','Clientes','Productos','Documentos fiscales','Cancelaciones','REP','Conciliación','Complementos','Addendas','Importar XML','Integraciones','Auditoría','Configuración'].map((x,i)=><button className={i===0?'active':''} key={x}>{x}</button>)}</nav>
      <div className="principle">Si no simplifica,<br/><b>no sirve.</b></div>
    </aside>
    <section className="content">
      <header><div><p className="eyebrow">CENTRO DE CONTROL</p><h1>Qué tienes que facturar, sin volver a capturar.</h1><p className="muted">El pedido define cliente, conceptos, cantidades, precios, impuestos y OC por línea. La factura sólo transforma y timbra.</p></div><button className="primary">+ Nuevo pedido</button></header>
      <div className="metrics">
        <article><span>Listo para facturar</span><strong>$6.42 M</strong><small>87 pedidos</small></article>
        <article><span>Bloqueado</span><strong>$1.28 M</strong><small>31 pedidos</small></article>
        <article><span>Revisión fiscal</span><strong>12</strong><small>requieren atención</small></article>
        <article><span>REP por generar</span><strong>9</strong><small>pagos identificados</small></article>
      </div>
      <div className="grid">
        <section className="panel attention"><div className="panelTitle"><h2>Operaciones por facturar</h2><span>Hoy</span></div>
          <div className="row"><b>XSO-01842 · Liverpool · OC 45002918</b><span className="tag green">LISTO</span></div>
          <div className="row"><b>XSO-01843 · Stellantis · OC 868261</b><span className="tag amber">FALTA POD</span></div>
          <div className="row"><b>XSO-01844 · Cliente ABC</b><span className="tag blue">REVISAR</span></div>
          <div className="row"><b>9 REP listos para generar</b><span className="tag green">LISTOS</span></div>
        </section>
        <section className="panel"><div className="panelTitle"><h2>Flujo estándar</h2><span>CFDI 4.0</span></div><div className="flow">{['Cliente','Pedido','Validación','Bloqueo fiscal','XSD','Timbrado','Entrega CFDI','REP'].map((x,i)=><div key={x}><i>{i+1}</i><span>{x}</span></div>)}</div><p className="note">Una vez liberado el pedido, los datos fiscales y conceptos quedan bloqueados en la factura. Si algo cambia, se corrige en el origen y se vuelve a preparar.</p></section>
      </div>
      <section className="panel modules"><div className="panelTitle"><h2>Capacidades</h2><span>Arquitectura modular</span></div><div className="cards">{modules.map(([title,desc,status])=><article key={title}><div><h3>{title}</h3><p>{desc}</p></div><span className={`status ${status.toLowerCase()}`}>{status}</span></article>)}</div></section>
    </section>
  </main>;
}
