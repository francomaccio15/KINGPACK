import { cn } from '@/lib/ui';

/**
 * Encabezado de pantalla: barra roja + titulo + contador, y la accion primaria.
 *
 * En mobile la accion baja a una fila propia a ancho completo. Antes quedaba
 * comprimida en la esquina superior derecha, que en 375px es donde peor cae el
 * pulgar y donde menos espacio hay.
 */
export function PageHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4', className)}>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="w-1 h-5 md:h-6 bg-kp-red rounded-full block shrink-0" />
          <h2 className="text-lg md:text-2xl font-bold uppercase tracking-wide truncate">{title}</h2>
        </div>
        {subtitle && <p className="text-2xs md:text-sm text-kp-gray pl-3 mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export default PageHeader;
