import Link from 'next/link';
import { serverFetch } from '@/lib/serverFetch';
import { requireAuth } from '@/lib/requireAuth';
import ChequesResumen from './ChequesResumen';
import ChequesTabla from './ChequesTabla';
import FiltrosCheques from './FiltrosCheques';
import ChequesPorCliente from './ChequesPorCliente';
import ChequesEmitidosResumen from './ChequesEmitidosResumen';

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

// Tabs disponibles
const TABS = [
  { value: 'todos',       label: 'Todos'         },
  { value: 'recibido',    label: 'Recibidos'     },
  { value: 'por_cliente', label: 'Por Cliente'   },
  { value: 'emitido',     label: 'Emitidos'      },
  { value: 'a_pagar',     label: 'A Pagar'       },
];

export default async function ChequesPage({ searchParams }: PageProps) {
  requireAuth('/cheques');

  const { tipo, estado, banco, fecha_venc_desde, fecha_venc_hasta } = searchParams;
  const tipoActivo = tipo || 'todos';

  // ── Fetch según tab activa ─────────────────────────────────────────────────
  let cheques: any[]   = [];
  let count            = 0;
  let resumen: any     = {};
  let clientesCheques: any[] = [];
  let emitidosResumen: any[] = [];
  let meses: string[]  = [];

  // Resumen de cards siempre se carga
  resumen = await serverFetch('/api/cheques/resumen', { cache: 'no-store' })
    .then(r => r.json()).catch(() => ({}));

  if (tipoActivo === 'por_cliente') {
    const qs = new URLSearchParams();
    if (estado) qs.set('estado', estado);
    if (banco)  qs.set('banco',  banco);
    const data = await serverFetch(`/api/cheques/por-cliente?${qs}`, { cache: 'no-store' })
      .then(r => r.json()).catch(() => ({ clientes: [] }));
    clientesCheques = data.clientes ?? [];

  } else if (tipoActivo === 'a_pagar') {
    const data = await serverFetch('/api/cheques/emitidos-resumen', { cache: 'no-store' })
      .then(r => r.json()).catch(() => ({ cheques: [], meses: [] }));
    emitidosResumen = data.cheques ?? [];
    meses           = data.meses   ?? [];

  } else {
    // Tabs normales: todos, recibido, emitido
    const qs = new URLSearchParams();
    if (tipoActivo !== 'todos') qs.set('tipo', tipoActivo);
    if (estado)           qs.set('estado',           estado);
    if (banco)            qs.set('banco',            banco);
    if (fecha_venc_desde) qs.set('fecha_venc_desde', fecha_venc_desde);
    if (fecha_venc_hasta) qs.set('fecha_venc_hasta', fecha_venc_hasta);
    qs.set('limit', '200');

    const data = await serverFetch(`/api/cheques?${qs}`, { cache: 'no-store' })
      .then(r => r.json()).catch(() => ({ cheques: [], count: 0 }));
    cheques = data.cheques ?? [];
    count   = data.count   ?? 0;
  }

  return (
    <section className="space-y-6">
      {/* Encabezado */}
      <div>
        <h2 className="text-xl font-bold text-kp-white">Cheques</h2>
        <p className="text-sm text-kp-gray mt-0.5">Gestión de cheques recibidos y emitidos</p>
      </div>

      {/* Tarjetas de resumen */}
      <ChequesResumen resumen={resumen} />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-kp-border overflow-x-auto">
        {TABS.map(tab => {
          const params = new URLSearchParams(searchParams as Record<string, string>);
          if (tab.value === 'todos') params.delete('tipo');
          else params.set('tipo', tab.value);

          const activo = tipoActivo === tab.value;
          return (
            <Link
              key={tab.value}
              href={`/cheques?${params}`}
              className={[
                'px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors whitespace-nowrap',
                activo
                  ? 'border-kp-red text-kp-red'
                  : 'border-transparent text-kp-gray hover:text-kp-white',
              ].join(' ')}
            >
              {tab.label}
              {tab.value === 'todos' && <span className="ml-1.5 text-xs opacity-60">({count})</span>}
              {tab.value === 'recibido' && tipoActivo === 'recibido' && <span className="ml-1.5 text-xs opacity-60">({cheques.length})</span>}
              {tab.value === 'emitido'  && tipoActivo === 'emitido'  && <span className="ml-1.5 text-xs opacity-60">({cheques.length})</span>}
              {tab.value === 'por_cliente' && tipoActivo === 'por_cliente' && clientesCheques.length > 0 && (
                <span className="ml-1.5 text-xs opacity-60">({clientesCheques.length})</span>
              )}
            </Link>
          );
        })}
      </div>

      {/* Contenido según tab */}
      {(tipoActivo === 'todos' || tipoActivo === 'recibido' || tipoActivo === 'emitido') && (
        <>
          <FiltrosCheques
            defaultBanco={banco}
            defaultEstado={estado}
            defaultFechaDesde={fecha_venc_desde}
            defaultFechaHasta={fecha_venc_hasta}
            tipoActivo={tipoActivo}
          />
          <ChequesTabla cheques={cheques} tipoActivo={tipoActivo} />
        </>
      )}

      {tipoActivo === 'por_cliente' && (
        <ChequesPorCliente clientes={clientesCheques} />
      )}

      {tipoActivo === 'a_pagar' && (
        <ChequesEmitidosResumen cheques={emitidosResumen} meses={meses} />
      )}
    </section>
  );
}
