type Articulo = {
  id: string;
  codigo: string;
  nombre: string;
  precio_madre: string;
  activo: boolean;
  categoria: string;
};

type ArticulosResponse = {
  count: number;
  articulos: Articulo[];
};

async function fetchArticulos(): Promise<ArticulosResponse | { error: string }> {
  const base = process.env.API_URL_INTERNAL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  try {
    const r = await fetch(`${base}/api/articulos`, { cache: 'no-store' });
    if (!r.ok) return { error: `API respondió ${r.status}` };
    return r.json();
  } catch (err: any) {
    return { error: err.message || 'No se pudo conectar a la API' };
  }
}

const ars = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 });

export const dynamic = 'force-dynamic';

export default async function ArticulosPage() {
  const data = await fetchArticulos();

  if ('error' in data) {
    return (
      <div className="rounded-lg bg-kp-surface border border-kp-red/40 p-6 text-kp-gray-lt">
        <h2 className="font-semibold mb-2 text-kp-red uppercase tracking-wide text-sm">
          Error al cargar artículos
        </h2>
        <p className="text-sm">{data.error}</p>
        <p className="text-xs mt-2 text-kp-gray">
          Verificá <code className="bg-kp-surface2 px-1 rounded">NEXT_PUBLIC_API_URL</code> y que el backend esté corriendo.
        </p>
      </div>
    );
  }

  return (
    <section>
      {/* Encabezado de sección */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-1 h-5 bg-kp-red rounded-full block" />
            <h2 className="text-2xl font-bold uppercase tracking-wide">Artículos</h2>
          </div>
          <p className="text-sm text-kp-gray pl-3">
            {data.count} {data.count === 1 ? 'registro' : 'registros'} encontrados
          </p>
        </div>
        <span className="text-xs text-kp-gray font-mono bg-kp-surface px-3 py-1 rounded border border-kp-border">
          /api/articulos
        </span>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto rounded-lg border border-kp-border shadow-lg shadow-black/40">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-kp-surface2 border-b border-kp-border">
              <th className="text-left px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold">
                Código
              </th>
              <th className="text-left px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold">
                Nombre
              </th>
              <th className="text-left px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold">
                Categoría
              </th>
              <th className="text-right px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold">
                Precio Madre
              </th>
              <th className="text-center px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold">
                Estado
              </th>
            </tr>
          </thead>
          <tbody className="bg-kp-surface divide-y divide-kp-border">
            {data.articulos.map((a) => (
              <tr
                key={a.id}
                className="hover:bg-kp-surface2 transition-colors duration-100 group"
              >
                <td className="px-4 py-3 font-mono text-xs text-kp-gray-lt">
                  {a.codigo}
                </td>
                <td className="px-4 py-3 font-medium text-kp-white group-hover:text-kp-red transition-colors duration-100">
                  {a.nombre}
                </td>
                <td className="px-4 py-3 text-kp-gray">
                  {a.categoria}
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-semibold text-kp-gray-lt">
                  {ars.format(Number(a.precio_madre))}
                </td>
                <td className="px-4 py-3 text-center">
                  {a.activo ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-kp-red">
                      <span className="w-1.5 h-1.5 rounded-full bg-kp-red inline-block" />
                      Activo
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-kp-gray">
                      <span className="w-1.5 h-1.5 rounded-full bg-kp-border inline-block" />
                      Inactivo
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {data.articulos.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-kp-gray">
                  No hay artículos cargados todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
