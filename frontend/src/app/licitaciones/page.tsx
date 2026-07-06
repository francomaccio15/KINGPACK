import Link from 'next/link';
import { serverFetch } from '@/lib/serverFetch';
import { requireAuth } from '@/lib/requireAuth';
import NuevaLicitacion from './NuevaLicitacion';

type Licitacion = {
  id: string;
  numero: number;
  titulo: string | null;
  estado: 'borrador' | 'enviada';
  created_at: string;
  cliente_nombre: string | null;
  creado_por: string | null;
  items_count: number;
  total: string;
};

const ars = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 });
const fmt = (v: string | number | null) => {
  const n = parseFloat(String(v ?? ''));
  return isNaN(n) ? '—' : ars.format(n);
};
const fechaFmt = (d: string) => new Date(d).toLocaleDateString('es-AR', {
  day: '2-digit', month: '2-digit', year: 'numeric',
});

const ESTADO_STYLE: Record<string, string> = {
  borrador: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  enviada:  'bg-blue-500/10  text-blue-400  border-blue-500/30',
};
const ESTADO_LABEL: Record<string, string> = {
  borrador: 'Borrador',
  enviada:  'Enviada',
};

export const dynamic = 'force-dynamic';

export default async function LicitacionesPage() {
  requireAuth('/licitaciones');

  const data = await serverFetch('/api/licitaciones?limit=200', { cache: 'no-store' })
    .then(r => r.json())
    .catch(() => ({ licitaciones: [], count: 0 }));

  const licitaciones: Licitacion[] = data.licitaciones ?? [];
  const count: number = data.count ?? 0;

  return (
    <section className="space-y-5">

      {/* Encabezado */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-1 h-6 bg-kp-red rounded-full block" />
            <h2 className="text-2xl font-bold uppercase tracking-wide">Licitaciones</h2>
          </div>
          <p className="text-sm text-kp-gray pl-3">
            Ofertas de precios especiales para clientes
            {' · '}
            {count} {count === 1 ? 'registro' : 'registros'}
          </p>
        </div>
        <NuevaLicitacion />
      </div>

      {/* Tabla */}
      {licitaciones.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-kp-gray">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.25} className="w-12 h-12 opacity-30">
            <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
          <p className="text-sm">No hay licitaciones. Creá la primera.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-kp-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-kp-border bg-kp-surface2">
                <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-widest text-kp-gray">N°</th>
                <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-widest text-kp-gray">Título</th>
                <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-widest text-kp-gray hidden md:table-cell">Cliente</th>
                <th className="text-center px-4 py-3 text-xs font-bold uppercase tracking-widest text-kp-gray hidden lg:table-cell">Artículos</th>
                <th className="text-right px-4 py-3 text-xs font-bold uppercase tracking-widest text-kp-gray hidden lg:table-cell">Total</th>
                <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-widest text-kp-gray hidden md:table-cell">Estado</th>
                <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-widest text-kp-gray hidden md:table-cell">Fecha</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-kp-border">
              {licitaciones.map(lic => (
                <tr key={lic.id} className="hover:bg-kp-surface2/50 transition-colors">
                  <td className="px-4 py-3 font-mono text-kp-gray text-xs">#{lic.numero}</td>
                  <td className="px-4 py-3 font-semibold text-kp-white">
                    {lic.titulo ?? <span className="text-kp-gray italic">Sin título</span>}
                  </td>
                  <td className="px-4 py-3 text-kp-gray hidden md:table-cell">
                    {lic.cliente_nombre ?? <span className="italic">Sin cliente</span>}
                  </td>
                  <td className="px-4 py-3 text-center text-kp-gray hidden lg:table-cell">{lic.items_count}</td>
                  <td className="px-4 py-3 text-right font-mono hidden lg:table-cell">{fmt(lic.total)}</td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${ESTADO_STYLE[lic.estado] ?? ''}`}>
                      {ESTADO_LABEL[lic.estado] ?? lic.estado}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-kp-gray text-xs hidden md:table-cell">{fechaFmt(lic.created_at)}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/licitaciones/${lic.id}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-kp-border text-kp-gray hover:text-kp-white hover:border-kp-gray text-xs font-medium transition-colors"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="w-3.5 h-3.5">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                      </svg>
                      Ver
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

    </section>
  );
}
