import { serverFetch } from '@/lib/serverFetch';
import { requireAuth } from '@/lib/requireAuth';
import type { Devolucion, DevItem, FormaDevolucion } from '../page';
import PrintTrigger from './PrintTrigger';
import PrintButton from './PrintButton';

export const dynamic = 'force-dynamic';

async function fetchDevolucion(id: string): Promise<Devolucion | null> {
  try {
    const r = await serverFetch(`/api/devoluciones/${id}`, { cache: 'no-store' });
    if (!r.ok) return null;
    return (await r.json()).devolucion ?? null;
  } catch { return null; }
}

const ars = (n: number) =>
  n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 });

const FORMA_LABEL: Record<FormaDevolucion, string> = {
  efectivo:         'Efectivo',
  cuenta_corriente: 'Cuenta corriente (saldo a favor)',
  transferencia:    'Transferencia bancaria',
  cambio:           'Cambio de mercadería (sin dinero)',
};

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-2 text-sm">
      <span className="text-gray-500 font-medium w-40 flex-shrink-0">{label}:</span>
      <span className="text-gray-900 font-semibold">{value}</span>
    </div>
  );
}

export default async function DevolucionPage({ params }: { params: { id: string } }) {
  requireAuth('/devoluciones');
  const dev = await fetchDevolucion(params.id);

  if (!dev) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-kp-gray">Devolución no encontrada.</p>
      </div>
    );
  }

  const items: DevItem[] = dev.items ?? [];
  const numero  = dev.numero ? String(dev.numero).padStart(6, '0') : '—';
  const fecha   = new Date(dev.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });

  const emisor = {
    razon_social: 'KING PACK',
    domicilio:    dev.sucursal_direccion ?? 'Laprida 270 — Ciudad de Salta',
    telefono:     dev.sucursal_telefono ?? '',
  };

  return (
    <>
      <PrintTrigger />

      {/* ── Barra de acciones (no se imprime) ── */}
      <div className="print:hidden fixed top-0 left-0 right-0 z-50 bg-gray-900 text-white px-6 py-3 flex items-center justify-between">
        <a href="/devoluciones" className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-1.5">
          ← Volver a Devoluciones
        </a>
        <div className="flex items-center gap-3">
          {dev.estado === 'anulada' && (
            <span className="text-rose-400 text-sm font-bold uppercase">⚠ Anulada</span>
          )}
          <PrintButton />
        </div>
      </div>

      {/* ── Documento imprimible ── */}
      <div className="print:mt-0 mt-16 min-h-screen bg-white">
        <div className="max-w-[210mm] mx-auto p-10 font-sans text-gray-900" id="dev-document">

          {/* ══ ENCABEZADO ══ */}
          <div className="flex items-start justify-between mb-8 pb-6 border-b-2 border-gray-200">
            <div>
              <h1 className="text-2xl font-black uppercase tracking-wide text-gray-900 mb-1">
                {emisor.razon_social}
              </h1>
              <p className="text-sm text-gray-500">{emisor.domicilio}</p>
              {emisor.telefono && <p className="text-sm text-gray-500">Tel: {emisor.telefono}</p>}
            </div>
            <div className="text-right">
              <div className="inline-flex flex-col items-center border-2 border-gray-900 rounded-lg px-6 py-3">
                <span className="text-base font-black leading-none uppercase tracking-wide text-center">Comprobante<br/>de Devolución</span>
              </div>
              <p className="text-sm font-bold mt-2 text-gray-700">N° {numero}</p>
              <p className="text-sm text-gray-500">{fecha}</p>
              <p className="text-[10px] uppercase tracking-widest text-gray-400 mt-1">Documento no fiscal</p>
            </div>
          </div>

          {/* ══ PARTES ══ */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">Comercio</p>
              <Row label="Nombre" value={emisor.razon_social} />
              <Row label="Domicilio" value={emisor.domicilio} />
              {dev.sucursal_nombre && <Row label="Sucursal" value={dev.sucursal_nombre} />}
            </div>
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">Cliente</p>
              <Row label="Nombre" value={dev.cliente_razon_social ?? 'Consumidor Final'} />
              {dev.cliente_cuit && <Row label="CUIT" value={dev.cliente_cuit} />}
              {dev.cliente_direccion && <Row label="Domicilio" value={dev.cliente_direccion} />}
            </div>
          </div>

          {/* ══ REFERENCIA + FORMA ══ */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="grid grid-cols-2 gap-2">
              <Row label="Referencia" value={dev.numero_referencia ?? '—'} />
              <Row label="Forma de devolución" value={FORMA_LABEL[dev.forma_devolucion]} />
            </div>
          </div>

          {/* ══ MOTIVO ══ */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 mb-2">Motivo</p>
            <p className="text-sm text-gray-800 leading-relaxed">{dev.motivo}</p>
          </div>

          {/* ══ DETALLE ══ */}
          {items.length > 0 && (
            <div className="mb-6">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">
                Mercadería devuelta
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

          {/* ══ TOTALES ══ */}
          <div className="flex justify-end mb-8">
            <div className="w-72">
              <div className="bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
                <div className="flex justify-between px-4 py-2.5 border-b border-gray-200">
                  <span className="text-sm text-gray-600 font-medium">Subtotal</span>
                  <span className="text-sm tabular-nums font-semibold">{ars(dev.subtotal)}</span>
                </div>
                <div className="flex justify-between px-4 py-3 bg-gray-900 rounded-b-lg">
                  <span className="text-base font-black text-white uppercase tracking-wide">Total devuelto</span>
                  <span className="text-base font-black text-white tabular-nums">{ars(dev.total)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ══ FIRMA ══ */}
          <div className="grid grid-cols-2 gap-12 mt-12 pt-6 border-t border-gray-200">
            <div className="text-center">
              <div className="border-t border-gray-400 mt-8 pt-2">
                <p className="text-xs text-gray-500">Firma — {emisor.razon_social}</p>
              </div>
            </div>
            <div className="text-center">
              <div className="border-t border-gray-400 mt-8 pt-2">
                <p className="text-xs text-gray-500">Aclaración / Firma cliente</p>
              </div>
            </div>
          </div>

          {/* ══ PIE ══ */}
          <div className="mt-8 pt-4 border-t border-gray-100 text-center">
            <p className="text-[9px] text-gray-400 uppercase tracking-widest">
              {emisor.razon_social} · Documento generado el {fecha}
              {dev.emitida_por_nombre ? ` · Emitido por ${dev.emitida_por_nombre}` : ''}
            </p>
            <p className="text-[9px] text-gray-400 mt-1">* Documento interno. No válido como comprobante fiscal.</p>
            {dev.estado === 'anulada' && (
              <p className="text-sm font-black text-red-600 mt-2 uppercase tracking-widest">
                ⚠ DEVOLUCIÓN ANULADA
              </p>
            )}
          </div>

        </div>
      </div>
    </>
  );
}
