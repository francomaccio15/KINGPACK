import { requireAuth } from '@/lib/requireAuth';
import { serverFetch } from '@/lib/serverFetch';
import CategoriasView from './CategoriasView';

export const dynamic = 'force-dynamic';

export type Categoria = {
  id: string;
  nombre: string;
  margen_default: number;
  activo: boolean;
  created_at: string;
  updated_at: string;
  articulos_count: number;
};

async function fetchCategorias(): Promise<Categoria[]> {
  try {
    const r = await serverFetch('/api/categorias?activo=all', { cache: 'no-store' });
    if (!r.ok) return [];
    return (await r.json()).categorias ?? [];
  } catch { return []; }
}

export default async function CategoriasPage() {
  requireAuth('/categorias');
  const categorias = await fetchCategorias();
  return <CategoriasView categoriasIniciales={categorias} />;
}
