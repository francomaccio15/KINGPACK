'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';

type Lista = { id: string; nombre: string; tipo: string };

const TIPO_LABEL: Record<string, string> = {
  madre:            'Base',
  publica:          'Público',
  revendedor:       'Reventa',
  cuenta_corriente: 'Cta. Cte.',
};

export default function TabsListas({
  listas,
  listaActivaId,
}: {
  listas: Lista[];
  listaActivaId: string;
}) {
  const router    = useRouter();
  const pathname  = usePathname();
  const params    = useSearchParams();

  const navTo = (id: string) => {
    const next = new URLSearchParams(params.toString());
    next.set('lista_id', id);
    next.delete('offset');
    router.push(`${pathname}?${next.toString()}`);
  };

  return (
    <div className="flex items-center gap-1 border-b border-kp-border">
      {listas.map(l => {
        const isActive = l.id === listaActivaId;
        return (
          <button
            key={l.id}
            onClick={() => navTo(l.id)}
            className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wide transition-colors relative
              ${isActive
                ? 'text-kp-white'
                : 'text-kp-gray hover:text-kp-gray-lt'
              }`}
          >
            {TIPO_LABEL[l.tipo] ?? l.nombre}
            {isActive && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-kp-red rounded-t-full" />
            )}
          </button>
        );
      })}
    </div>
  );
}
