import ListaEditor from './ListaEditor';

type Lista = {
  id: string;
  nombre: string;
  tipo: string;
  descuento_base_pct: string;
  articulos_count: number;
};

const API = process.env.API_URL_INTERNAL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function fetchListas(): Promise<Lista[] | { error: string }> {
  try {
    const r = await fetch(`${API}/api/listas-precios`, { cache: 'no-store' });
    if (!r.ok) return { error: `API respondió ${r.status}` };
    return (await r.json()).listas ?? [];
  } catch (e: any) {
    return { error: e.message || 'No se pudo conectar a la API' };
  }
}

export const dynamic = 'force-dynamic';

export default async function ListasPreciosPage() {
  const listas = await fetchListas();

  if (!Array.isArray(listas)) {
    return (
      <div className="rounded-xl bg-kp-surface border border-kp-red/40 p-6">
        <h2 className="font-bold text-kp-red uppercase tracking-wide text-sm mb-2">Error al cargar listas</h2>
        <p className="text-sm text-kp-gray-lt">{listas.error}</p>
      </div>
    );
  }

  const totalArticulos = listas[0]?.articulos_count ?? 0;

  return (
    <section className="space-y-6 max-w-2xl">

      {/* Encabezado */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="w-1 h-6 bg-kp-red rounded-full block" />
          <h2 className="text-2xl font-bold uppercase tracking-wide">Listas de Precios</h2>
        </div>
        <p className="text-sm text-kp-gray pl-3">
          {listas.length} listas activas &nbsp;·&nbsp; {totalArticulos} artículos por lista
        </p>
      </div>

      {/* Explicación */}
      <div className="bg-kp-surface2 border border-kp-border rounded-xl p-4 text-xs text-kp-gray space-y-1.5">
        <p className="font-semibold text-kp-gray-lt uppercase tracking-wide text-[10px]">¿Cómo funciona?</p>
        <p>
          Cada lista tiene un descuento que se aplica sobre el <strong className="text-kp-gray-lt">Precio Base</strong> de cada artículo.
          Al guardar un descuento, todos los precios de esa lista se actualizan automáticamente.
        </p>
        <p>
          El <strong className="text-kp-gray-lt">Precio Base</strong> se calcula a partir del costo + margen + IVA de cada artículo y no tiene descuento.
        </p>
      </div>

      {/* Cards por lista */}
      <div className="space-y-4">
        {listas.map(l => (
          <ListaEditor key={l.id} lista={l} />
        ))}
      </div>

    </section>
  );
}
