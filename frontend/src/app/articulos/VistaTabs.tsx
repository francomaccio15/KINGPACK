import Link from 'next/link';

/**
 * Conmutador de vista de la pantalla de Artículos: "Precios" (listas y precios)
 * y "Stock" (edición de cantidades). La pestaña Stock solo aparece para roles
 * que pueden ajustar stock (administrador / supervisor).
 */
export default function VistaTabs({
  vista, puedeEditarStock,
}: {
  vista: 'precios' | 'stock';
  puedeEditarStock: boolean;
}) {
  const tabs: { label: string; href: string; key: 'precios' | 'stock' }[] = [
    { label: 'Precios', href: '/articulos', key: 'precios' },
  ];
  if (puedeEditarStock) {
    tabs.push({ label: 'Stock', href: '/articulos?vista=stock', key: 'stock' });
  }

  return (
    <div className="flex gap-1 border-b border-kp-border">
      {tabs.map(t => {
        const activo = t.key === vista;
        return (
          <Link
            key={t.key}
            href={t.href}
            className={[
              'px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors',
              activo
                ? 'border-kp-red text-kp-white'
                : 'border-transparent text-kp-gray hover:text-kp-white',
            ].join(' ')}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
