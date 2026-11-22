import { useState } from "react";

export default function App() {
  const [cliente, setCliente] = useState("Cliente de mostrador");
  const [codigo, setCodigo] = useState("ART001");
  const [cantidad, setCantidad] = useState(1);
  const [precio, setPrecio] = useState(45);
  const [mensaje, setMensaje] = useState("Maqueta inicial: formulario visual pendiente de conexión completa con el backend.");
  const subtotal = cantidad * precio;
  const igv = subtotal * 0.18;
  return <main>
    <header><p className="eyebrow">ERP · TRIBU 2 — INGRESOS</p><h1>Ventas Físicas</h1><p>Registro inicial de ventas presenciales</p></header>
    <section className="panel">
      <h2>Nueva venta</h2>
      <label>Cliente<input value={cliente} onChange={e => setCliente(e.target.value)} /></label>
      <div className="grid">
        <label>Código de artículo<input value={codigo} onChange={e => setCodigo(e.target.value)} /></label>
        <label>Cantidad<input type="number" min="1" value={cantidad} onChange={e => setCantidad(Number(e.target.value))} /></label>
        <label>Precio unitario (S/)<input type="number" min="0" step="0.01" value={precio} onChange={e => setPrecio(Number(e.target.value))} /></label>
      </div>
      <div className="totals"><span>Subtotal: S/ {subtotal.toFixed(2)}</span><span>IGV referencial: S/ {igv.toFixed(2)}</span><strong>Total: S/ {(subtotal + igv).toFixed(2)}</strong></div>
      <button onClick={() => setMensaje(`Vista previa preparada para ${cliente}: ${cantidad} x ${codigo}. Aún falta conectar este formulario con POST /api/ventas/.`)}>Preparar venta (demo)</button>
      <p className="notice">{mensaje}</p>
    </section>
    <section className="panel"><h2>Integraciones consideradas</h2><ul>
      <li>Almacén: consulta de stock (mock en el backend).</li>
      <li>Ventas Virtuales: coordinación de códigos y stock compartido.</li>
      <li>Distribución: despacho opcional, contrato pendiente.</li>
    </ul></section>
    <footer>Prototipo académico · No usar para operaciones reales</footer>
  </main>;
}
