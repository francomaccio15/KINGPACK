import Link from 'next/link';
import { serverFetch } from '@/lib/serverFetch';
import { requireAuth } from '@/lib/requireAuth';
import { KingPackLogoPrint } from '@/components/KingPackLogo';
import AccionesLicitacion from './AccionesLicitacion';

const ars = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 });
const fmt = (v: string | number | null) => {
  const n = parseFloat(String(v ?? ''));
  return isNaN(n) ? '—' : ars.format(n);
};
const fechaFmt = (d: string) => new Date(d).toLocaleDateString('es-AR', {
  day: '2-digit', month: '2-digit', year: 'numeric',
});
const fechaVigencia = (d: string) => {
  const fecha = new Date(d);
  fecha.setDate(fecha.getDate() + 30);
  return fechaFmt(fecha.toISOString());
};

const ESTADO_STYLE: Record<string, string> = {
  borrador:    'bg-amber-500/10  text-amber-400  border-amber-500/30',
  enviada:     'bg-blue-500/10   text-blue-400   border-blue-500/30',
  adjudicada:  'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
};
const ESTADO_LABEL: Record<string, string> = {
  borrador:   'Borrador',
  enviada:    'Enviada',
  adjudicada: 'Adjudicada',
};

export const dynamic = 'force-dynamic';

async function fetchLicitacion(id: string) {
  try {
    const res = await serverFetch(`/api/licitaciones/${id}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function fetchSucursales() {
  try {
    const res = await serverFetch('/api/sucursales', { cache: 'no-store' });
    if (!res.ok) return [];
    const json = await res.json();
    return (json.sucursales ?? json) as { id: string; nombre: string }[];
  } catch {
    return [];
  }
}

export default async function LicitacionDetallePage({ params }: { params: { id: string } }) {
  requireAuth('/licitaciones');
  const [data, sucursales] = await Promise.all([fetchLicitacion(params.id), fetchSucursales()]);

  if (!data) {
    return (
      <section className="flex flex-col items-center justify-center py-24 gap-4">
        <p className="text-kp-gray text-lg">Licitación no encontrada.</p>
        <Link href="/licitaciones" className="text-kp-red hover:underline text-sm">← Volver a Licitaciones</Link>
      </section>
    );
  }

  const { licitacion: lic, items } = data;
  const total = items.reduce((acc: number, it: any) => acc + parseFloat(it.subtotal || '0'), 0);

  return (
    <section className="space-y-6 max-w-5xl">

      {/* ── Vista pantalla ─────────────────────────────────────────────────── */}
      <div className="print:hidden">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-kp-gray mb-6">
          <Link href="/licitaciones" className="hover:text-kp-white transition-colors">Licitaciones</Link>
          <span>/</span>
          <span className="text-kp-white font-medium">#{lic.numero}</span>
        </div>

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="w-1 h-6 bg-kp-red rounded-full block" />
              <h2 className="text-2xl font-bold uppercase tracking-wide">
                Licitación #{lic.numero}
              </h2>
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${ESTADO_STYLE[lic.estado] ?? ''}`}>
                {ESTADO_LABEL[lic.estado] ?? lic.estado}
              </span>
            </div>
            {lic.titulo && <p className="text-base text-kp-white pl-3 font-medium">{lic.titulo}</p>}
            <p className="text-sm text-kp-gray pl-3 mt-0.5">{fechaFmt(lic.created_at)}</p>
          </div>
          <AccionesLicitacion
            licitacionId={params.id}
            estadoActual={lic.estado}
            ventaId={lic.venta_id ?? null}
            sucursales={sucursales}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Items */}
          <div className="lg:col-span-2 space-y-4">
            <div className="rounded-xl border border-kp-border overflow-hidden">
              <div className="bg-kp-surface2 border-b border-kp-border px-5 py-3">
                <h3 className="text-xs font-bold uppercase tracking-widest text-kp-gray">
                  Artículos ({items.length})
                </h3>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-kp-border/50">
                    <th className="text-left px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-kp-gray">Artículo</th>
                    <th className="text-center px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-kp-gray w-20">Cant.</th>
                    <th className="text-right px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-kp-gray w-32 hidden md:table-cell">P. Ref.</th>
                    <th className="text-right px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-kp-gray w-36">P. Licitación</th>
                    <th className="text-right px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-kp-gray w-28">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-kp-border/50">
                  {items.map((it: any) => (
                    <tr key={it.id} className="hover:bg-kp-surface2/30">
                      <td className="px-4 py-3">
                        <p className="font-medium text-kp-white text-sm">{it.nombre}</p>
                        {it.codigo && <p className="text-xs text-kp-gray font-mono mt-0.5">{it.codigo}</p>}
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-sm">{parseFloat(it.cantidad).toFixed(0)}</td>
                      <td className="px-4 py-3 text-right text-xs text-kp-gray font-mono hidden md:table-cell">
                        {it.precio_madre_ref != null ? fmt(it.precio_madre_ref) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm font-semibold text-kp-white">
                        {fmt(it.precio_licitacion)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm font-bold">
                        {fmt(it.subtotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-kp-border bg-kp-surface2">
                    <td colSpan={4} className="px-4 py-3 text-right text-xs font-bold uppercase tracking-widest text-kp-gray">Total</td>
                    <td className="px-4 py-3 text-right text-base font-bold font-mono">{fmt(total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Panel lateral */}
          <div className="space-y-4">
            <div className="rounded-xl border border-kp-border overflow-hidden">
              <div className="bg-kp-surface2 border-b border-kp-border px-5 py-3">
                <h3 className="text-xs font-bold uppercase tracking-widest text-kp-gray">Detalle</h3>
              </div>
              <div className="p-5 space-y-3 text-sm">
                <div>
                  <p className="text-xs text-kp-gray uppercase tracking-widest mb-0.5">Cliente</p>
                  <p className="font-medium">{lic.cliente_nombre ?? <span className="text-kp-gray italic">Sin cliente asignado</span>}</p>
                  {lic.cliente_cuit && <p className="text-xs text-kp-gray">{lic.cliente_cuit}</p>}
                </div>
                <div>
                  <p className="text-xs text-kp-gray uppercase tracking-widest mb-0.5">Creada por</p>
                  <p className="font-medium">{lic.creado_por ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-kp-gray uppercase tracking-widest mb-0.5">Fecha</p>
                  <p className="font-medium">{fechaFmt(lic.created_at)}</p>
                </div>
                {lic.observaciones && (
                  <div>
                    <p className="text-xs text-kp-gray uppercase tracking-widest mb-0.5">Observaciones</p>
                    <p className="text-kp-gray text-xs leading-relaxed">{lic.observaciones}</p>
                  </div>
                )}
                {lic.venta_id && (
                  <div className="pt-1 border-t border-kp-border">
                    <p className="text-xs text-kp-gray uppercase tracking-widest mb-1.5">Venta generada</p>
                    <Link
                      href={`/ventas/${lic.venta_id}`}
                      className="inline-flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 text-sm font-medium transition-colors"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                      Ver venta
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Estilos print ──────────────────────────────────────────────────── */}
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 0; }
          .print-layout-licitacion { display: block !important; padding: 8mm; box-sizing: border-box; }
        }
      `}</style>

      {/* ── Layout de impresión ─────────────────────────────────────────────── */}
      <div className="print-layout-licitacion hidden print:block" style={{ fontFamily: 'Arial, sans-serif', fontSize: '8px', color: '#111', background: 'white' }}>

        {/* Encabezado */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #111', paddingBottom: '4px', marginBottom: '4px' }}>
          <div style={{ fontSize: '11px', fontWeight: '900', letterSpacing: '0.3px' }}>
            LICITACIÓN <span style={{ fontSize: '9px' }}>N° {lic.numero}</span>
          </div>
          <div style={{ textAlign: 'right', fontSize: '7px', color: '#444' }}>
            <div>Fecha: {fechaFmt(lic.created_at)}</div>
            <div>Válido hasta: {fechaVigencia(lic.created_at)}</div>
          </div>
        </div>

        {/* Título */}
        {lic.titulo && (
          <div style={{ textAlign: 'center', fontSize: '8.5px', fontWeight: '700', marginBottom: '4px', color: '#333' }}>
            {lic.titulo}
          </div>
        )}

        {/* 2 columnas: Emisor | Cliente */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', border: '2px solid #111', marginBottom: '5px' }}>
          <div style={{ borderRight: '2px solid #111', padding: '4px 6px' }}>
            <div style={{ marginBottom: '2px' }}><KingPackLogoPrint height={18} /></div>
            <p style={{ fontSize: '8px', fontWeight: '800', marginBottom: '1px' }}>DISTRIBUIDORA KING PACK S.A.S.</p>
            <p style={{ fontSize: '7.5px', marginBottom: '1px' }}><strong>CUIT:</strong> 30-71792696-6</p>
            <p style={{ fontSize: '7.5px', marginBottom: '1px' }}><strong>IIBB:</strong> 30-71792696-6</p>
            <p style={{ fontSize: '7.5px', marginBottom: '1px' }}><strong>Inicio Act.:</strong> 06/01/2010</p>
            <p style={{ fontSize: '7.5px' }}><strong>Cond. IVA:</strong> Responsable Inscripto</p>
          </div>
          <div style={{ padding: '4px 6px' }}>
            <p style={{ fontSize: '7px', fontWeight: '700', textTransform: 'uppercase', color: '#555', marginBottom: '3px' }}>Cliente</p>
            {lic.cliente_nombre ? (
              <>
                <p style={{ fontSize: '8.5px', fontWeight: '800', marginBottom: '1px' }}>{lic.cliente_nombre}</p>
                {lic.cliente_cuit && <p style={{ fontSize: '7.5px', marginBottom: '1px' }}><strong>CUIT:</strong> {lic.cliente_cuit}</p>}
                {lic.cliente_cond_iva && <p style={{ fontSize: '7.5px', marginBottom: '1px' }}><strong>Cond. IVA:</strong> {lic.cliente_cond_iva}</p>}
                {lic.cliente_direccion && <p style={{ fontSize: '7.5px' }}><strong>Dom.:</strong> {lic.cliente_direccion}</p>}
              </>
            ) : (
              <p style={{ fontSize: '7.5px', color: '#666', fontStyle: 'italic' }}>Sin cliente asignado</p>
            )}
          </div>
        </div>

        {/* Tabla de artículos */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8px', marginBottom: '5px', border: '1.5px solid #111' }}>
          <thead>
            <tr style={{ background: '#111', color: 'white' }}>
              <th style={{ textAlign: 'left', padding: '3px 5px', fontSize: '7px', fontWeight: '700', textTransform: 'uppercase', borderRight: '1px solid #555' }}>Código</th>
              <th style={{ textAlign: 'left', padding: '3px 5px', fontSize: '7px', fontWeight: '700', textTransform: 'uppercase', borderRight: '1px solid #555' }}>Artículo</th>
              <th style={{ textAlign: 'center', padding: '3px 4px', fontSize: '7px', fontWeight: '700', textTransform: 'uppercase', width: '32px', borderRight: '1px solid #555' }}>Cant.</th>
              <th style={{ textAlign: 'right', padding: '3px 4px', fontSize: '7px', fontWeight: '700', textTransform: 'uppercase', width: '80px', borderRight: '1px solid #555' }}>Precio Unit.</th>
              <th style={{ textAlign: 'right', padding: '3px 5px', fontSize: '7px', fontWeight: '700', textTransform: 'uppercase', width: '80px' }}>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it: any, i: number) => (
              <tr key={it.id} style={{ borderBottom: '1px solid #bbb', background: i % 2 === 0 ? 'white' : '#f4f4f4' }}>
                <td style={{ padding: '2px 5px', fontFamily: 'monospace', fontSize: '7px', color: '#555', borderRight: '1px solid #ccc' }}>{it.codigo ?? '—'}</td>
                <td style={{ padding: '2px 5px', fontWeight: '600', borderRight: '1px solid #ccc' }}>{it.nombre}</td>
                <td style={{ padding: '2px 4px', textAlign: 'center', fontVariantNumeric: 'tabular-nums', borderRight: '1px solid #ccc' }}>{parseFloat(it.cantidad).toFixed(0)}</td>
                <td style={{ padding: '2px 4px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', borderRight: '1px solid #ccc' }}>{fmt(it.precio_licitacion)}</td>
                <td style={{ padding: '2px 5px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: '700' }}>{fmt(it.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Footer: observaciones + total */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px', alignItems: 'end' }}>
          <div style={{ fontSize: '7.5px', color: '#555' }}>
            {lic.observaciones && (
              <p><strong>Obs:</strong> {lic.observaciones}</p>
            )}
            <p style={{ marginTop: '4px', fontSize: '7px', color: '#888' }}>
              Precios expresados sin IVA. Sujeto a confirmación. Válido por 30 días desde la fecha de emisión.
            </p>
          </div>
          <div style={{ border: '1.5px solid #111', padding: '4px 10px', textAlign: 'right', minWidth: '120px' }}>
            <p style={{ fontSize: '6.5px', fontWeight: '700', textTransform: 'uppercase', color: '#555', marginBottom: '1px' }}>Total</p>
            <p style={{ fontSize: '11px', fontWeight: '900', fontVariantNumeric: 'tabular-nums' }}>{fmt(total)}</p>
          </div>
        </div>
      </div>

    </section>
  );
}
