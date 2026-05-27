import { serverFetch } from '@/lib/serverFetch';
import { requireAuth } from '@/lib/requireAuth';
import type { NotaCredito, NcItem } from '../page';
import PrintTrigger from './PrintTrigger';
import PrintButton from './PrintButton';

export const dynamic = 'force-dynamic';

// ─── Datos del emisor (King Pack) ─────────────────────────────────────────────
const EMISOR = {
  razon_social:  'KING PACK S.R.L.',
  cuit:          '30-XXXXXXXX-X',       // ← actualizar con el CUIT real
  cond_iva:      'Responsable Inscripto',
  domicilio:     'Salta, Argentina',
  telefono:      '',
};

async function fetchNota(id: string): Promise<NotaCredito | null> {
  try {
    const r = await serverFetch(`/api/notas-credito/${id}`, { cache: 'no-store' });
    if (!r.ok) return null;
    return (await r.json()).nota ?? null;
  } catch { return null; }
}

const ars = (n: number) =>
  n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 });

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-2 text-sm">
      <span className="text-gray-500 font-medium w-40 flex-shrink-0">{label}:</span>
      <span className="text-gray-900 font-semibold">{value}</span>
    </div>
  );
}

export default async function NotaCreditoPage({ params }: { params: { id: string } }) {
  requireAuth('/notas-credito');
  const nota = await fetchNota(params.id);

  if (!nota) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-kp-gray">Nota de crédito no encontrada.</p>
      </div>
    );
  }

  const items: NcItem[] = nota.items ?? [];
  const letra   = nota.tipo_letra ?? '?';
  const numero  = nota.numero ? String(nota.numero).padStart(8, '0') : '—';
  const fecha   = new Date(nota.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });

  return (
    <>
      <PrintTrigger />

      {/* ── Barra de acciones (no se imprime) ── */}
      <div className="print:hidden fixed top-0 left-0 right-0 z-50 bg-gray-900 text-white px-6 py-3 flex items-center justify-between">
        <a href="/notas-credito" className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-1.5">
          ← Volver a Notas de Crédito
        </a>
        <div className="flex items-center gap-3">
          {nota.estado === 'anulada' && (
            <span className="text-rose-400 text-sm font-bold uppercase">⚠ Anulada</span>
          )}
          <PrintButton />
        </div>
      </div>

      {/* ── Documento imprimible ── */}
      <div className="print:mt-0 mt-16 min-h-screen bg-white">
        <div className="max-w-[210mm] mx-auto p-10 font-sans text-gray-900" id="nc-document">

          {/* ══ ENCABEZADO ══════════════════════════════════════════════════════ */}
          <div className="flex items-start justify-between mb-8 pb-6 border-b-2 border-gray-200">
            {/* Emisor */}
            <div>
              <h1 className="text-2xl font-black uppercase tracking-wide text-gray-900 mb-1">
                {EMISOR.razon_social}
              </h1>
              <p className="text-sm text-gray-500">CUIT: {EMISOR.cuit}</p>
              <p className="text-sm text-gray-500">Cond. IVA: {EMISOR.cond_iva}</p>
              <p className="text-sm text-gray-500">{EMISOR.domicilio}</p>
              {EMISOR.telefono && <p className="text-sm text-gray-500">Tel: {EMISOR.telefono}</p>}
            </div>

            {/* Tipo de documento + número */}
            <div className="text-right">
              <div className="inline-flex flex-col items-center border-2 border-gray-900 rounded-lg px-6 py-3">
                <span className="text-4xl font-black leading-none">{letra}</span>
                <span className="text-[9px] uppercase tracking-widest font-bold text-gray-500 mt-0.5">
                  {nota.tipo_comprobante ?? 'Nota de Crédito'}
                </span>
              </div>
              <p className="text-sm font-bold mt-2 text-gray-700">N° {numero}</p>
              <p className="text-sm text-gray-500">{fecha}</p>
              {nota.cae && (
                <p className="text-[10px] text-gray-400 font-mono mt-1">CAE: {nota.cae}</p>
              )}
            </div>
          </div>

          {/* ══ SECCIÓN 1: PARTES ═══════════════════════════════════════════════ */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            {/* Emisor detalle */}
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">Emisor</p>
              <Row label="Razón Social" value={EMISOR.razon_social} />
              <Row label="CUIT" value={EMISOR.cuit} />
              <Row label="Cond. IVA" value={EMISOR.cond_iva} />
              <Row label="Domicilio" value={EMISOR.domicilio} />
              {nota.sucursal_nombre && <Row label="Sucursal" value={nota.sucursal_nombre} />}
            </div>

            {/* Receptor */}
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">Receptor</p>
              <Row label="Razón Social" value={nota.cliente_razon_social ?? 'Consumidor Final'} />
              {nota.cliente_cuit && <Row label="CUIT" value={nota.cliente_cuit} />}
              {nota.cliente_direccion && <Row label="Domicilio" value={nota.cliente_direccion} />}
              <Row label="Cond. IVA" value="—" />
            </div>
          </div>

          {/* ══ SECCIÓN 2: DOCUMENTO DE REFERENCIA ══════════════════════════════ */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-[10px] font-black uppercase tracking-widest text-blue-500 mb-2">
              Documento de referencia
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Row
                label="Comprobante original"
                value={
                  nota.factura_numero
                    ? `Factura N° ${String(nota.factura_punto_venta ?? '').padStart(4,'0')}-${String(nota.factura_numero).padStart(8,'0')}`
                    : nota.numero_referencia ?? '—'
                }
              />
              <Row label="Fecha emisión NC" value={fecha} />
            </div>
          </div>

          {/* ══ SECCIÓN 3: MOTIVO ════════════════════════════════════════════════ */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 mb-2">
              Concepto / Motivo
            </p>
            <p className="text-sm text-gray-800 leading-relaxed">{nota.motivo}</p>
          </div>

          {/* ══ SECCIÓN 4: DETALLE DE ÍTEMS ════════════════════════════════════ */}
          {items.length > 0 && (
            <div className="mb-6">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">
                Detalle de artículos / servicios
              </p>
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-900 text-white">
                    <th className="text-left px-3 py-2 font-semibold rounded-tl-lg">Descripción</th>
                    <th className="text-center px-3 py-2 font-semibold w-20">Cant.</th>
                    <th className="text-right px-3 py-2 font-semibold w-32">Precio unit.</th>
                    <th className="text-right px-3 py-2 font-semibold w-32 rounded-tr-lg">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-3 py-2 border-b border-gray-100">{it.descripcion}</td>
                      <td className="px-3 py-2 border-b border-gray-100 text-center tabular-nums">{it.cantidad}</td>
                      <td className="px-3 py-2 border-b border-gray-100 text-right tabular-nums">{ars(it.precio_unitario)}</td>
                      <td className="px-3 py-2 border-b border-gray-100 text-right tabular-nums font-medium">{ars(it.cantidad * it.precio_unitario)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ══ SECCIÓN 5: TOTALES ═══════════════════════════════════════════════ */}
          <div className="flex justify-end mb-8">
            <div className="w-72">
              <div className="bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
                <div className="flex justify-between px-4 py-2.5 border-b border-gray-200">
                  <span className="text-sm text-gray-600 font-medium">Subtotal (neto)</span>
                  <span className="text-sm tabular-nums font-semibold">{ars(nota.subtotal)}</span>
                </div>
                <div className="flex justify-between px-4 py-2.5 border-b border-gray-200">
                  <span className="text-sm text-gray-600 font-medium">IVA {nota.iva_pct}%</span>
                  <span className="text-sm tabular-nums font-semibold">{ars(nota.iva_monto)}</span>
                </div>
                <div className="flex justify-between px-4 py-3 bg-gray-900 rounded-b-lg">
                  <span className="text-base font-black text-white uppercase tracking-wide">Total a favor</span>
                  <span className="text-base font-black text-white tabular-nums">{ars(nota.total)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ══ FIRMA ═══════════════════════════════════════════════════════════ */}
          <div className="grid grid-cols-2 gap-12 mt-12 pt-6 border-t border-gray-200">
            <div className="text-center">
              <div className="border-t border-gray-400 mt-8 pt-2">
                <p className="text-xs text-gray-500">Firma autorizada — {EMISOR.razon_social}</p>
              </div>
            </div>
            <div className="text-center">
              <div className="border-t border-gray-400 mt-8 pt-2">
                <p className="text-xs text-gray-500">Aclaración / Sello receptor</p>
              </div>
            </div>
          </div>

          {/* ══ PIE ══════════════════════════════════════════════════════════════ */}
          <div className="mt-8 pt-4 border-t border-gray-100 text-center">
            <p className="text-[9px] text-gray-400 uppercase tracking-widest">
              {EMISOR.razon_social} · {EMISOR.cuit} · Documento emitido el {fecha}
              {nota.emitida_por_nombre ? ` · Emitido por ${nota.emitida_por_nombre}` : ''}
            </p>
            {nota.estado === 'anulada' && (
              <p className="text-sm font-black text-red-600 mt-2 uppercase tracking-widest">
                ⚠ DOCUMENTO ANULADO — SIN VALIDEZ FISCAL
              </p>
            )}
          </div>

        </div>
      </div>
    </>
  );
}
