const lines = [
  { sku:'223010', description:'Carpeta Vinil 1 1/2 Blanca', qty:'120', unit:'PZA', sat:'44122003', price:'$84.50', po:'450009821', poLine:'10' },
  { sku:'00005098', description:'Batería Cocina 21pz', qty:'4', unit:'PZA', sat:'52141500', price:'$2,150.00', po:'450009821', poLine:'20' },
];

export default function OrdersPage(){
  return <main className="content" style={{maxWidth:1200,margin:'0 auto'}}>
    <header><div><p className="eyebrow">SALES LITE · PEDIDO</p><h1>XSO-000184</h1><p className="muted">Todo lo que llegará al CFDI se define aquí. Después de liberar, la factura queda en modo sólo lectura.</p></div><button className="primary">Validar y liberar</button></header>
    <section className="panel">
      <div className="panelTitle"><h2>Cliente</h2><span>Origen fiscal</span></div>
      <div className="cards">
        <article><div><h3>GENERAL DE SEGUROS</h3><p>RFC · CP · Régimen · Uso CFDI</p></div><span className="tag green">VALIDADO</span></article>
        <article><div><h3>Alta rápida</h3><p>Escanear QR SAT o captura manual de datos mínimos.</p></div><span className="tag blue">QR / MANUAL</span></article>
      </div>
    </section>
    <section className="panel" style={{marginTop:18}}>
      <div className="panelTitle"><h2>Partidas del pedido</h2><span>OC por línea</span></div>
      <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr>{['SKU','Descripción','Cant.','Unidad','Clave SAT','Precio','OC','Línea OC'].map(h=><th key={h} style={{textAlign:'left',padding:'12px 8px',borderBottom:'1px solid var(--line)'}}>{h}</th>)}</tr></thead><tbody>{lines.map(l=><tr key={l.sku}>{[l.sku,l.description,l.qty,l.unit,l.sat,l.price,l.po,l.poLine].map((v,i)=><td key={i} style={{padding:'14px 8px',borderBottom:'1px solid var(--line)'}}>{v}</td>)}</tr>)}</tbody></table></div>
    </section>
    <div className="grid" style={{marginTop:18}}>
      <section className="panel"><div className="panelTitle"><h2>Validación previa</h2><span>Antes del timbrado</span></div>{['Cliente fiscal completo','Partidas con clave SAT','Unidad SAT','Objeto de impuesto','OC por línea','Totales e impuestos'].map(x=><div className="row" key={x}><b>{x}</b><span className="tag green">OK</span></div>)}</section>
      <section className="panel"><div className="panelTitle"><h2>Transformación fiscal</h2><span>Bloqueada</span></div><p className="note">Al liberar el pedido se genera un borrador CFDI 4.0 inmutable. Complementos habilitados se incorporan antes de validar XSD y enviar al PAC.</p><div className="row"><b>CFDI 4.0</b><span className="tag green">BASE</span></div><div className="row"><b>Complemento Detallista</b><span className="tag blue">DISPONIBLE</span></div><div className="row"><b>XOLUM Addendas</b><span className="tag gray">SE CONTRATA APARTE</span></div></section>
    </div>
  </main>
}
