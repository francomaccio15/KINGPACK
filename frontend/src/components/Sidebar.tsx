'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { puedeAcceder } from '@/lib/permissions';

// ─── Íconos ──────────────────────────────────────────────────────────────────
const ChevronLeft = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <path d="M15 18l-6-6 6-6" />
  </svg>
);
const ChevronRight = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <path d="M9 18l6-6-6-6" />
  </svg>
);

const IcoVentas = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 flex-shrink-0">
    <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" />
  </svg>
);
const IcoClientes = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 flex-shrink-0">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);
const IcoPedidos = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 flex-shrink-0">
    <path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
  </svg>
);
const IcoGastos = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 flex-shrink-0">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);
const IcoCaja = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 flex-shrink-0">
    <rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" />
  </svg>
);
const IcoArticulos = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 flex-shrink-0">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 2 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
  </svg>
);
const IcoListas = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 flex-shrink-0">
    <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
);
const IcoCategorias = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 flex-shrink-0">
    <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
  </svg>
);
const IcoEmpleados = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 flex-shrink-0">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
  </svg>
);
const IcoUsuarios = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 flex-shrink-0">
    <circle cx="12" cy="8" r="4" />
    <path d="M6 20v-1a6 6 0 0 1 12 0v1" />
    <line x1="18" y1="8" x2="23" y2="8" /><line x1="20.5" y1="5.5" x2="20.5" y2="10.5" />
  </svg>
);
const IcoReportes = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 flex-shrink-0">
    <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
  </svg>
);
const IcoDashboard = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 flex-shrink-0">
    <rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" />
    <rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" />
  </svg>
);
const IcoNotas = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 flex-shrink-0">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);
const IcoNC = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 flex-shrink-0">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="9" y1="15" x2="15" y2="15"/>
    <line x1="12" y1="12" x2="12" y2="18"/>
  </svg>
);
const IcoTraspasos = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 flex-shrink-0">
    <path d="M5 12h14M12 5l7 7-7 7" />
  </svg>
);
// ─── Datos de navegación ──────────────────────────────────────────────────────
type NavItem  = { label: string; href: string; icon: React.ReactNode; disabled?: boolean };
type NavGroup = { label: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Inicio',
    items: [
      { label: 'Resumen diario', href: '/dashboard', icon: <IcoDashboard /> },
    ],
  },
  {
    label: 'Operaciones',
    items: [
      { label: 'Ventas',                href: '/ventas',               icon: <IcoVentas /> },
      { label: 'Clientes',              href: '/clientes',             icon: <IcoClientes /> },
      { label: 'Gastos',                 href: '/gastos',               icon: <IcoGastos /> },
      { label: 'Pedidos Proveedores',   href: '/pedidos-proveedores',  icon: <IcoPedidos /> },
      { label: 'Traspasos',             href: '/traspasos',            icon: <IcoTraspasos /> },
      { label: 'Caja',                  href: '/caja',                 icon: <IcoCaja /> },
      { label: 'Notas de equipo',       href: '/notas',                icon: <IcoNotas /> },
      { label: 'Notas de Crédito',      href: '/notas-credito',        icon: <IcoNC /> },
    ],
  },
  {
    label: 'Catálogo',
    items: [
      { label: 'Artículos',         href: '/articulos',      icon: <IcoArticulos />   },
      { label: 'Administración de Listas', href: '/listas-precios', icon: <IcoListas />      },
      { label: 'Categorías',        href: '/categorias',     icon: <IcoCategorias /> },
    ],
  },
  {
    label: 'Gestión',
    items: [
      { label: 'Usuarios',   href: '/usuarios',  icon: <IcoUsuarios />  },
      { label: 'Empleados',  href: '/empleados', icon: <IcoEmpleados /> },
      { label: 'Reportes',   href: '/reportes',  icon: <IcoReportes />,  disabled: true },
    ],
  },
];

// ─── Componente ───────────────────────────────────────────────────────────────
export default function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();

  // Persistir estado en localStorage
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    setCollapsed(localStorage.getItem('kp_sidebar_collapsed') === '1');
  }, []);

  const toggle = () => {
    setCollapsed(c => {
      const next = !c;
      localStorage.setItem('kp_sidebar_collapsed', next ? '1' : '0');
      return next;
    });
  };

  return (
    <aside
      className={[
        'relative flex flex-col flex-shrink-0 z-10',
        'bg-kp-surface border-r border-kp-border',
        'transition-[width] duration-200 ease-in-out',
        collapsed ? 'w-16' : 'w-60',
      ].join(' ')}
    >
      {/* Toggle en el borde derecho */}
      <button
        onClick={toggle}
        aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
        className="absolute -right-3 top-5 z-20 w-6 h-6 rounded-full flex items-center justify-center bg-kp-surface border border-kp-border text-kp-gray hover:text-kp-white hover:border-kp-red transition-colors duration-150"
      >
        {collapsed ? <ChevronRight /> : <ChevronLeft />}
      </button>

      {/* Nav scrollable */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 space-y-5">
        {NAV_GROUPS.map(group => {
          const visibles = group.items.filter(item =>
            !user || puedeAcceder(user.rol, item.href)
          );
          if (visibles.length === 0) return null;
          return (
          <div key={group.label}>
            {/* Label del grupo o separador */}
            {collapsed ? (
              <hr className="border-kp-border mx-3 mb-2" />
            ) : (
              <p className="px-4 mb-1 text-[10px] font-bold uppercase tracking-widest text-kp-gray select-none">
                {group.label}
              </p>
            )}

            <ul className="space-y-0.5">
              {visibles.map(item => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                const cls = [
                  'group relative flex items-center gap-3 px-3 py-2.5 mx-1 rounded-md',
                  'text-sm font-medium transition-colors duration-150 border-l-2',
                  isActive
                    ? 'bg-kp-red/10 border-kp-red text-kp-red'
                    : item.disabled
                      ? 'border-transparent text-kp-gray/40 cursor-not-allowed'
                      : 'border-transparent text-kp-gray-lt hover:bg-kp-surface2 hover:text-kp-white',
                ].join(' ');

                const inner = (
                  <>
                    <span className={isActive ? 'text-kp-red' : ''}>{item.icon}</span>
                    {!collapsed && <span className="truncate leading-none">{item.label}</span>}
                    {/* Tooltip en modo colapsado */}
                    {collapsed && (
                      <span className="pointer-events-none absolute left-full ml-3 px-2.5 py-1.5 z-50 bg-kp-surface2 border border-kp-border rounded-md text-xs font-semibold text-kp-white whitespace-nowrap opacity-0 group-hover:opacity-100 translate-x-1 group-hover:translate-x-0 transition-all duration-150">
                        {item.label}
                      </span>
                    )}
                  </>
                );

                return (
                  <li key={item.href}>
                    {item.disabled ? (
                      <div className={cls}>{inner}</div>
                    ) : (
                      <Link href={item.href} className={cls}>{inner}</Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
          );
        })}
      </nav>

    </aside>
  );
}
