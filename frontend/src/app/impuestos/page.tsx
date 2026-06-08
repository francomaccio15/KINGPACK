import { requireAuth } from '@/lib/requireAuth';
import { serverFetch } from '@/lib/serverFetch';
import Link from 'next/link';
import LibroIVAVentas from './LibroIVAVentas';
import LibroIVACompras from './LibroIVACompras';
import PosicionIVA from './PosicionIVA';

export const dynamic = 'force-dynamic';

// Tabs
const TABS = [
  { value: 'posicion',  label: 'Posición IVA'       },
  { value: 'ventas',    label: 'Libro IVA Ventas'    },
  { value: 'compras',   label: 'Libro IVA Compras'   },
];

interface PageProps {
  searchParams: {
    tab?: string;
    desde?: string;
    hasta?: string;
    sucursal_id?: string;
    anio?: string;
  };
}

export default async function ImpuestosPage({ searchParams }: PageProps) {
  requireAuth('/impuestos');

  const tab       = searchParams.tab       || 'posicion';
  const anio      = searchParams.anio      || String(new Date().getFullYear());
  const sucursalId = searchParams.sucursal_id || '';

  // Período por defecto: mes actual
  const now    = new Date();
  const desde  = searchParams.desde || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const hastaD = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const hasta  = searchParams.hasta || `${hastaD.getFullYear()}-${String(hastaD.getMonth() + 1).padStart(2, '0')}-${String(hastaD.getDate()).padStart(2, '0')}`;

  // Sucursales para el selector
  const sucursalesData = await serverFetch('/api/sucursales', { cache: 'no-store' })
    .then(r => r.json()).catch(() => ({ sucursales: [] }));
  const sucursales: { id: string; nombre: string }[] = sucursalesData.sucursales ?? [];

  // Fetch según tab
  let ventasData:  any = null;
  let comprasData: any = null;
  let posicionData:any = null;

  const sucQs = sucursalId ? `&sucursal_id=${sucursalId}` : '';

  if (tab === 'ventas') {
    ventasData = await serverFetch(
      `/api/impuestos/libro-iva-ventas?desde=${desde}&hasta=${hasta}${sucQs}`,
      { cache: 'no-store' }
    ).then(r => r.json()).catch(() => null);
  }

  if (tab === 'compras') {
    comprasData = await serverFetch(
      `/api/impuestos/libro-iva-compras?desde=${desde}&hasta=${hasta}${sucQs}`,
      { cache: 'no-store' }
    ).then(r => r.json()).catch(() => null);
  }

  if (tab === 'posicion') {
    posicionData = await serverFetch(
      `/api/impuestos/posicion-iva?anio=${anio}${sucQs}`,
      { cache: 'no-store' }
    ).then(r => r.json()).catch(() => null);
  }

  // Helper para construir URLs manteniendo params
  const buildUrl = (overrides: Record<string, string>) => {
    const p = new URLSearchParams({
      tab, desde, hasta, anio,
      ...(sucursalId ? { sucursal_id: sucursalId } : {}),
      ...overrides,
    });
    return `/impuestos?${p}`;
  };

  return (
    <section className="space-y-6 max-w-7xl">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-1 h-6 bg-kp-red rounded-full block" />
            <h2 className="text-2xl font-bold uppercase tracking-wide">Impuestos</h2>
          </div>
          <p className="text-sm text-kp-gray pl-3">Libro IVA Ventas · Libro IVA Compras · Posición Fiscal</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-end bg-kp-surface border border-kp-border rounded-xl px-5 py-4">

        {/* Sucursal */}
        {sucursales.length > 1 && (
          <div className="flex flex-col gap-1">
            <label className="text-xs text-kp-gray font-medium">Sucursal</label>
            <form action="/impuestos" method="get" className="flex gap-2">
              <input type="hidden" name="tab"   value={tab} />
              <input type="hidden" name="desde" value={desde} />
              <input type="hidden" name="hasta" value={hasta} />
              <input type="hidden" name="anio"  value={anio} />
              <select
                name="sucursal_id"
                defaultValue={sucursalId}
                className="h-9 px-3 text-sm rounded-md bg-kp-surface2 border border-kp-border text-kp-white focus:outline-none focus:border-kp-red"
                onChange="this.form.submit()"
              >
                <option value="">Todas las sucursales</option>
                {sucursales.map((s: any) => (
                  <option key={s.id} value={s.id}>{s.nombre}</option>
                ))}
              </select>
            </form>
          </div>
        )}

        {/* Período (para libros) */}
        {(tab === 'ventas' || tab === 'compras') && (
          <>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-kp-gray font-medium">Desde</label>
              <Link
                href="#"
                className="hidden"
              />
              <form id="periodo-form" action="/impuestos" method="get">
                <input type="hidden" name="tab" value={tab} />
                {sucursalId && <input type="hidden" name="sucursal_id" value={sucursalId} />}
                <div className="flex gap-2 items-end">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-kp-gray font-medium">Desde</label>
                    <input
                      type="date" name="desde" defaultValue={desde}
                      className="h-9 px-3 text-sm rounded-md bg-kp-surface2 border border-kp-border text-kp-white focus:outline-none focus:border-kp-red"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-kp-gray font-medium">Hasta</label>
                    <input
                      type="date" name="hasta" defaultValue={hasta}
                      className="h-9 px-3 text-sm rounded-md bg-kp-surface2 border border-kp-border text-kp-white focus:outline-none focus:border-kp-red"
                    />
                  </div>
                  <button
                    type="submit"
                    className="h-9 px-4 text-sm font-semibold rounded-md bg-kp-red text-white hover:bg-red-700 transition-colors"
                  >
                    Aplicar
                  </button>
                </div>
              </form>
            </div>
          </>
        )}

        {/* Año (para posición) */}
        {tab === 'posicion' && (
          <form action="/impuestos" method="get" className="flex gap-2 items-end">
            <input type="hidden" name="tab" value="posicion" />
            {sucursalId && <input type="hidden" name="sucursal_id" value={sucursalId} />}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-kp-gray font-medium">Año fiscal</label>
              <select
                name="anio"
                defaultValue={anio}
                className="h-9 px-3 text-sm rounded-md bg-kp-surface2 border border-kp-border text-kp-white focus:outline-none focus:border-kp-red"
              >
                {[now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="h-9 px-4 text-sm font-semibold rounded-md bg-kp-red text-white hover:bg-red-700 transition-colors"
            >
              Aplicar
            </button>
          </form>
        )}

        {/* Accesos rápidos de meses */}
        {(tab === 'ventas' || tab === 'compras') && (
          <div className="flex flex-col gap-1">
            <label className="text-xs text-kp-gray font-medium">Accesos rápidos</label>
            <div className="flex gap-1.5">
              {[-2, -1, 0].map(offset => {
                const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
                const mesDesde = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
                const ultimo   = new Date(d.getFullYear(), d.getMonth() + 1, 0);
                const mesHasta = `${ultimo.getFullYear()}-${String(ultimo.getMonth() + 1).padStart(2, '0')}-${String(ultimo.getDate()).padStart(2, '0')}`;
                const label    = d.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' });
                const activo   = desde === mesDesde && hasta === mesHasta;
                return (
                  <Link
                    key={offset}
                    href={buildUrl({ desde: mesDesde, hasta: mesHasta })}
                    className={[
                      'h-9 px-3 text-xs font-semibold rounded-md border transition-colors',
                      activo
                        ? 'bg-kp-red/10 border-kp-red text-kp-red'
                        : 'border-kp-border text-kp-gray hover:text-kp-white hover:border-kp-gray',
                    ].join(' ')}
                  >
                    {label}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-kp-border">
        {TABS.map(t => (
          <Link
            key={t.value}
            href={buildUrl({ tab: t.value })}
            className={[
              'px-5 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors whitespace-nowrap',
              tab === t.value
                ? 'border-kp-red text-kp-red'
                : 'border-transparent text-kp-gray hover:text-kp-white',
            ].join(' ')}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {/* Contenido */}
      {tab === 'posicion' && posicionData && (
        <PosicionIVA
          posicion={posicionData.posicion ?? []}
          ytd={posicionData.ytd ?? { debito_fiscal: 0, credito_fiscal: 0, saldo_neto: 0 }}
          proyeccion={posicionData.proyeccion_proximo_mes ?? 0}
          anio={parseInt(anio)}
        />
      )}

      {tab === 'ventas' && ventasData && (
        <>
          <p className="text-xs text-kp-gray">
            Período: <span className="text-kp-white font-medium">{desde}</span> al <span className="text-kp-white font-medium">{hasta}</span>
            {' · '}Solo ventas confirmadas y facturadas · Preventas y anuladas excluidas
          </p>
          <LibroIVAVentas
            ventas={ventasData.ventas ?? []}
            totales={ventasData.totales ?? { neto_21: 0, iva_21: 0, neto_105: 0, iva_105: 0, neto_exento: 0, total: 0 }}
          />
        </>
      )}

      {tab === 'compras' && comprasData && (
        <>
          <p className="text-xs text-kp-gray">
            Período: <span className="text-kp-white font-medium">{desde}</span> al <span className="text-kp-white font-medium">{hasta}</span>
            {' · '}Solo egresos con comprobante fiscal · Informales excluidos
          </p>
          <LibroIVACompras
            compras={comprasData.compras ?? []}
            totales={comprasData.totales ?? { neto_gravado: 0, neto_no_gravado: 0, iva_21: 0, iva_105: 0, percepciones_ib: 0, otros_impuestos: 0, total: 0 }}
            creditoFiscalValido={comprasData.credito_fiscal_valido ?? 0}
          />
        </>
      )}

      {(tab === 'ventas' && !ventasData) || (tab === 'compras' && !comprasData) || (tab === 'posicion' && !posicionData) ? (
        <div className="text-center py-12 text-kp-gray text-sm">
          Error al cargar datos. Verificá la conexión.
        </div>
      ) : null}

    </section>
  );
}
