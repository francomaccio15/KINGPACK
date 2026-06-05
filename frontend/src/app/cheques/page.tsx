import Link from 'next/link';
import { serverFetch } from '@/lib/serverFetch';
import { requireAuth } from '@/lib/requireAuth';
import ChequesResumen from './ChequesResumen';
import ChequesTabla from './ChequesTabla';
import FiltrosCheques from './FiltrosCheques';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: {
    tipo?: string;
    estado?: string;
    banco?: string;
    fecha_venc_desde?: string;
    fecha_venc_hasta?: string;
  };
}

export default async function ChequesPage({ searchParams }: PageProps) {
  requireAuth('/cheques');

  const { tipo, estado, banco, fecha_venc_desde, fecha_venc_hasta } = searchParams;

  const qs = new URLSearchParams();
  if (tipo)             qs.set('tipo',             tipo);
  if (estado)           qs.set('estado',           estado);
  if (banco)            qs.set('banco',            banco);
  if (fecha_venc_desde) qs.set('fecha_venc_desde', fecha_venc_desde);
  if (fecha_venc_hasta) qs.set('fecha_venc_hasta', fecha_venc_hasta);
  qs.set('limit', '200');

  const [{ cheques = [], count = 0 }, resumen] = await Promise.all([
    serverFetch(`/api/cheques?${qs}`, { cache: 'no-store' }).then(r => r.json()).catch(() => ({ cheques: [], count: 0 })),
    serverFetch('/api/cheques/resumen', { cache: 'no-store' }).then(r => r.json()).catch(() => ({})),
  ]);

  const tipoActivo = tipo || 'todos';

  const chequesRecibidos = cheques.filter((c: any) => c.tipo === 'recibido');
  const chequesEmitidos  = cheques.filter((c: any) => c.tipo === 'emitido');

  return (
    <section className="space-y-6">
      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-kp-white">Cheques</h2>
          <p className="text-sm text-kp-gray mt-0.5">Gestión de cheques recibidos y emitidos</p>
        </div>
      </div>

      {/* Tarjetas de resumen */}
      <ChequesResumen resumen={resumen} />

      {/* Tabs por tipo */}
      <div className="flex gap-1 border-b border-kp-border">
        {[
          { label: 'Todos', value: 'todos', count },
          { label: 'Recibidos', value: 'recibido', count: chequesRecibidos.length },
          { label: 'Emitidos',  value: 'emitido',  count: chequesEmitidos.length  },
        ].map(tab => {
          const params = new URLSearchParams(searchParams as Record<string, string>);
          if (tab.value === 'todos') params.delete('tipo');
          else params.set('tipo', tab.value);

          const activo = tipoActivo === tab.value;
          return (
            <Link
              key={tab.value}
              href={`/cheques?${params}`}
              className={[
                'px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors',
                activo
                  ? 'border-kp-red text-kp-red'
                  : 'border-transparent text-kp-gray hover:text-kp-white',
              ].join(' ')}
            >
              {tab.label}
              <span className="ml-1.5 text-xs opacity-60">({tab.count})</span>
            </Link>
          );
        })}
      </div>

      {/* Filtros */}
      <FiltrosCheques
        defaultBanco={banco}
        defaultEstado={estado}
        defaultFechaDesde={fecha_venc_desde}
        defaultFechaHasta={fecha_venc_hasta}
        tipoActivo={tipoActivo}
      />

      {/* Tabla */}
      <ChequesTabla cheques={cheques} tipoActivo={tipoActivo} />
    </section>
  );
}
