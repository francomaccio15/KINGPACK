import { requireAuth } from '@/lib/requireAuth';
import Trazabilidad from './Trazabilidad';

export const dynamic = 'force-dynamic';

export default function TrazabilidadPage() {
  requireAuth('/trazabilidad');

  return (
    <section className="space-y-5">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="w-1 h-6 bg-kp-red rounded-full block" />
          <h2 className="text-2xl font-bold uppercase tracking-wide">Seguimiento de Artículos</h2>
        </div>
        <p className="text-sm text-kp-gray pl-3">
          Rastreá en qué ventas aparece un artículo y a qué cliente se le vendió.
        </p>
      </div>

      <Trazabilidad />
    </section>
  );
}
