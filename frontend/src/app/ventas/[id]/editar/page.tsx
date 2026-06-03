import { requireAuth } from '@/lib/requireAuth';
import { serverFetch } from '@/lib/serverFetch';
import Link from 'next/link';
import EditarVentaForm from './EditarVentaForm';

export const dynamic = 'force-dynamic';

export default async function EditarVentaPage({ params }: { params: { id: string } }) {
  requireAuth('/ventas');

  const res = await serverFetch(`/api/ventas/${params.id}`, { cache: 'no-store' });
  if (!res.ok) {
    return (
      <section className="flex flex-col items-center justify-center py-24 gap-4">
        <p className="text-kp-gray text-lg">Venta no encontrada.</p>
        <Link href="/ventas" className="text-kp-red hover:underline text-sm">← Volver a Ventas</Link>
      </section>
    );
  }

  const data = await res.json();
  const { venta, items } = data;

  if (venta.estado === 'anulada') {
    return (
      <section className="flex flex-col items-center justify-center py-24 gap-4">
        <p className="text-kp-gray text-lg">No se puede editar una venta anulada.</p>
        <Link href={`/ventas/${params.id}`} className="text-kp-red hover:underline text-sm">← Volver a la venta</Link>
      </section>
    );
  }

  return (
    <section className="max-w-4xl space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-kp-gray">
        <Link href="/ventas" className="hover:text-kp-white transition-colors">Ventas</Link>
        <span>/</span>
        <Link href={`/ventas/${params.id}`} className="hover:text-kp-white transition-colors">#{venta.numero}</Link>
        <span>/</span>
        <span className="text-kp-white font-medium">Editar</span>
      </div>

      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="w-1 h-6 bg-kp-red rounded-full block" />
        <h2 className="text-2xl font-bold uppercase tracking-wide">Editar Venta #{venta.numero}</h2>
      </div>

      <EditarVentaForm
        ventaId={params.id}
        itemsIniciales={items}
        listaPrecioId={venta.lista_precio_id ?? null}
        observacionesActuales={venta.observaciones ?? ''}
      />
    </section>
  );
}
