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
  // Server Component: fetch corre en el VPS → usar URL interna del backend.
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
      <div className="rounded-lg bg-red-50 border border-red-200 p-6 text-red-800">
        <h2 className="font-semibold mb-2">No pude cargar los artículos</h2>
        <p className="text-sm">Detalle: {data.error}</p>
        <p className="text-sm mt-2 opacity-80">
          Verificá <code>NEXT_PUBLIC_API_URL</code> y que el backend esté corriendo.
        </p>
      </div>
    );
  }

  return (
    <section>
      <div className="flex items-end justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold">Artículos</h2>
          <p className="text-sm text-slate-500">Total: {data.count}</p>
        </div>
        <p className="text-xs text-slate-400">Endpoint: <code>/api/articulos</code></p>
      </div>

      <div className="overflow-x-auto bg-white rounded-lg shadow-sm border border-slate-200">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 text-slate-700">
            <tr>
              <th className="text-left px-4 py-2">Código</th>
              <th className="text-left px-4 py-2">Nombre</th>
              <th className="text-left px-4 py-2">Categoría</th>
              <th className="text-right px-4 py-2">Precio Madre</th>
              <th className="text-center px-4 py-2">Activo</th>
            </tr>
          </thead>
          <tbody>
            {data.articulos.map((a) => (
              <tr key={a.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-2 font-mono text-xs">{a.codigo}</td>
                <td className="px-4 py-2">{a.nombre}</td>
                <td className="px-4 py-2 text-slate-600">{a.categoria}</td>
                <td className="px-4 py-2 text-right tabular-nums">{ars.format(Number(a.precio_madre))}</td>
                <td className="px-4 py-2 text-center">
                  {a.activo ? <span className="text-green-600">●</span> : <span className="text-slate-300">○</span>}
                </td>
              </tr>
            ))}
            {data.articulos.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
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
