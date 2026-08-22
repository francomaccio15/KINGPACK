'use client';

import { cn } from '@/lib/ui';

/**
 * Barra de acciones de un formulario largo.
 *
 * En mobile queda pegada al pie de la pantalla (sticky) para que Guardar y
 * Cancelar esten siempre a la vista sin scrollear un formulario de 40 campos;
 * en escritorio vuelve a ser una fila normal alineada a la derecha, igual que
 * hoy.
 *
 * Los botones se escriben SIEMPRE en el orden [secundaria, primaria]: el
 * flex-col-reverse de mobile pone la primaria arriba y ambas a ancho completo,
 * y en escritorio flex-row las devuelve al orden Cancelar → Guardar.
 *
 * Dentro de un <Modal> este rol lo cumple la prop footer: no anidar los dos.
 */
export function FormActions({
  children,
  sticky = true,
  className,
}: {
  children: React.ReactNode;
  sticky?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col-reverse gap-2 md:flex-row md:justify-end md:items-center',
        sticky && [
          // -mx-4 compensa el px-4 del contenedor de pagina para que la barra
          // ocupe todo el ancho de la pantalla.
          'sticky bottom-0 z-30 -mx-4 px-4 py-3 pb-safe',
          'bg-kp-bg/95 backdrop-blur border-t border-kp-border',
          'md:static md:mx-0 md:px-0 md:py-0 md:bg-transparent md:backdrop-blur-none md:border-0',
        ],
        'print:hidden',
        className,
      )}
    >
      {children}
    </div>
  );
}

export default FormActions;
