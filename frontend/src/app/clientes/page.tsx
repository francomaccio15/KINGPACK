import { Suspense } from 'react';
import Link from 'next/link';
import NuevoCliente from './NuevoCliente';
import ClientesFiltros from './ClientesFiltros';

const API = process.env.API_URL_INTERNAL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type Cliente = {
  id: string; razon_social: string; cuit: string | null; telefono: string | null;
  cond_iva: string; lista_precio: string | null; sucursal_nombre: string | null;
  limite_credito: string; descuento_adicional: string; saldo_actual: string; activo: boolean;
};

const ars = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 });
const fmt = (v: string | number | null) => { const n = parseFloat(String(v ?? '')); return isNaN(n) ? '—' : ars.format(n); };

async function fetchAll(q?: string, activo?: string, sucursal_id?: string) {
  const params = new URLSearchParams({ limit: '500' });
  if (q)           params.set('q', q);
  if (activo)      params.set('activo', activo);
  if (sucursal_id) params.set('sucursal_id', sucursal_id);

  const [clientes, condIva, listas, sucursales] = await Promise.all([
    fetch(`${API}/api/clientes?${params}`,  { cache: 'no-store' }).then(r => r.json()).then(d => d.clientes ?? []).catch(() => []),
    fetch(`${API}/api/clientes/cond-iva`,   { cache: 'no-store' }).then(r => r.json()).then(d => d.cond_iva ?? []).catch(() => []),
    fetch(`${API}/api/listas-precios`,      { cache: 'no-store' }).then(r => r.json()).then(d => d.listas ?? []).catch(() => []),
    fetch(`${API}/api/sucursales`,          { cache: 'no-store' }).then(r => r.json()).then(d => d.sucursales ?? []).catch(() => []),
  ]);
  return { clientes, condIva, listas, sucursales };
}

export const dynamic = 'force-dynamic';

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: { q?: string; activo?: string; sucursal_id?: string };
}) {
  const { clientes, condIva, listas, sucursales } = await fetchAll(
    searchParams.q,
    searchParams.activo,
    searchParams.sucursal_id,
  );

  const hayFiltros = !!(searchParams.q || searchParams.activo || searchParams.sucursal_id);

  return (
    <section className="space-y-5">

      {/* Encabezado */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-1 h-6 bg-kp-red rounded-full block" />
            <h2 className="text-2xl font-bold uppercase tracking-wide">Clientes</h2>
          </div>
          <p className="text-sm text-kp-gray pl-3">
            {clientes.length} {clientes.length === 1 ? 'registro' : 'registros'}
            {hayFiltros && <span className="ml-1 text-kp-gray/60">(filtrado)</span>}
          </p>
        </div>
        <NuevoCliente condIva={condIva} listas={listas} sucursales={sucursales} />
      </div>

      {/* Filtros */}
      <Suspense>
        <ClientesFiltros sucursales={sucursales} />
      </Suspense>

      {/* Tabla */}
      <div className="overflow-x-auto rounded-xl border border-kp-border shadow-lg shadow-black/40">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-kp-surface2 border-b border-kp-border">
              <th className="text-left px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold">Razón Social</th>
              <th className="text-left px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold whitespace-nowrap">CUIT</th>
              <th className="text-left px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold">Cond. IVA</th>
              <th className="text-left px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold">Lista</th>
              <th className="text-right px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold whitespace-nowrap">Límite Crédito</th>
              <th className="text-right px-4 py-3 uppercase tracking-widest text-xs font-semibold whitespace-nowrap">
                <span className="text-kp-red">Saldo</span>
              </th>
              <th className="text-center px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold">Estado</th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody className="bg-kp-surface divide-y divide-kp-border">
            {clientes.map((c: Cliente) => {
              const saldo = parseFloat(c.saldo_actual || '0');
              return (
                <tr key={c.id} className="hover:bg-kp-surface2 transition-colors group">
                  <td className="px-4 py-3 font-medium text-kp-white group-hover:text-kp-red transition-colors">
                    {c.razon_social}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-kp-gray whitespace-nowrap">{c.cuit || '—'}</td>
                  <td className="px-4 py-3 text-xs text-kp-gray-lt">{c.cond_iva}</td>
                  <td className="px-4 py-3">
                    {c.lista_precio
                      ? <span className="text-xs bg-kp-surface2 border border-kp-border rounded px-2 py-0.5 text-kp-gray-lt">{c.lista_precio}</span>
                      : <span className="text-xs text-kp-border">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-xs text-kp-gray">{fmt(c.limite_credito)}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-bold whitespace-nowrap">
                    {(() => {
                      const limite = parseFloat(c.limite_credito || '0');
                      const excede = limite > 0 && saldo > limite;
                      return (
                        <span className={`inline-flex items-center gap-1.5 ${excede ? 'text-kp-red' : saldo > 0 ? 'text-amber-400' : saldo < 0 ? 'text-green-400' : 'text-kp-gray'}`}>
                          {excede && (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3 flex-shrink-0">
                              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                            </svg>
                          )}
                          {fmt(saldo)}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {c.activo
                      ? <span className="inline-flex items-center gap-1 text-xs font-medium text-kp-red"><span className="w-1.5 h-1.5 rounded-full bg-kp-red" />Activo</span>
                      : <span className="inline-flex items-center gap-1 text-xs font-medium text-kp-gray"><span className="w-1.5 h-1.5 rounded-full bg-kp-border" />Inactivo</span>}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <Link href={`/clientes/${c.id}`}
                      className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1
                        text-xs text-kp-gray hover:text-kp-white px-2 py-1 rounded border border-transparent
                        hover:border-kp-border hover:bg-kp-surface2">
                      Ver →
                    </Link>
                  </td>
                </tr>
              );
            })}
            {clientes.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-kp-gray">
                  {hayFiltros ? 'No hay clientes que coincidan con los filtros.' : 'No hay clientes cargados todavía.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

    </section>
  );
}
