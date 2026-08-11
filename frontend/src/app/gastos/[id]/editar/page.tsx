import Link from 'next/link';
import { serverFetch } from '@/lib/serverFetch';
import { requireAuth } from '@/lib/requireAuth';
import EgresoForm, { EgresoEdicion } from '../../EgresoForm';

export const dynamic = 'force-dynamic';

// Solo Compra de Mercadería y Gasto Varios son editables desde este formulario.
const TIPOS_EDITABLES = ['compra_mercaderia', 'compra_gasto'];

export default async function EditarEgresoPage({ params }: { params: { id: string } }) {
  const user = requireAuth('/gastos');

  if (user.rol !== 'administrador') {
    return (
      <section className="flex flex-col items-center justify-center py-24 gap-4">
        <p className="text-kp-gray text-lg">Solo un administrador puede editar egresos.</p>
        <Link href={`/gastos/${params.id}`} className="text-kp-red hover:underline text-sm">← Volver al egreso</Link>
      </section>
    );
  }

  const res = await serverFetch(`/api/egresos/${params.id}`, { cache: 'no-store' });
  if (!res.ok) {
    return (
      <section className="flex flex-col items-center justify-center py-24 gap-4">
        <p className="text-kp-gray text-lg">Egreso no encontrado.</p>
        <Link href="/gastos" className="text-kp-red hover:underline text-sm">← Volver a Egresos</Link>
      </section>
    );
  }

  const data = await res.json();
  const egreso = data.egreso;
  const items = data.items ?? [];
  const pagos = data.pagos ?? [];
  const pedido = data.pedido ?? null;

  // Guardas: mismo criterio que el backend. Si no cumple, se explica por qué.
  let motivoBloqueo: string | null = null;
  if (!TIPOS_EDITABLES.includes(egreso.tipo_operacion)) {
    motivoBloqueo = 'Este tipo de egreso no se puede editar desde acá.';
  } else if (egreso.anticipo_id) {
    motivoBloqueo = 'No se puede editar un egreso vinculado a un anticipo.';
  } else if (pagos.length > 0) {
    motivoBloqueo = 'Este egreso ya tiene pagos registrados. Anulá los pagos antes de editarlo.';
  } else if (pedido?.stock_acreditado) {
    motivoBloqueo = 'El stock de este pedido ya fue recibido. Revertí la recepción antes de editar.';
  }

  if (motivoBloqueo) {
    return (
      <section className="flex flex-col items-center justify-center py-24 gap-4 text-center px-6">
        <p className="text-kp-gray text-lg max-w-md">{motivoBloqueo}</p>
        <Link href={`/gastos/${params.id}`} className="text-kp-red hover:underline text-sm">← Volver al egreso</Link>
      </section>
    );
  }

  const edicion: EgresoEdicion = {
    id: egreso.id,
    tipo_operacion: egreso.tipo_operacion,
    tipo_comprobante: egreso.tipo_comprobante,
    punto_venta: egreso.punto_venta,
    numero_comprobante: egreso.numero_comprobante,
    fecha_emision: egreso.fecha_emision,
    proveedor_id: egreso.proveedor_id,
    sucursal_id: egreso.sucursal_id,
    subrubro_gasto_id: egreso.subrubro_gasto_id,
    descripcion: egreso.descripcion,
    neto_gravado: egreso.neto_gravado,
    neto_no_gravado: egreso.neto_no_gravado,
    iva_21: egreso.iva_21,
    iva_105: egreso.iva_105,
    percepciones_ib: egreso.percepciones_ib,
    otros_impuestos: egreso.otros_impuestos,
    total: egreso.total,
    fecha_vencimiento_pago: egreso.fecha_vencimiento_pago,
    bonificaciones: Array.isArray(egreso.bonificaciones) ? egreso.bonificaciones : [],
    items: items.map((it: any) => ({
      articulo_id: it.articulo_id,
      descripcion: it.articulo_nombre ?? it.descripcion,
      cantidad: it.cantidad,
      precio_unitario: it.precio_unitario,
      descuento_pct: it.descuento_pct,
      sucursal_imputacion_id: it.sucursal_imputacion_id,
    })),
  };

  return <EgresoForm edicion={edicion} />;
}
