import { requireAuth } from '@/lib/requireAuth';
import { serverFetch } from '@/lib/serverFetch';
import NotasView from './NotasView';
import type { Nota } from './NotasView';

export const dynamic = 'force-dynamic';

export default async function NotasPage() {
  const user = requireAuth('/notas');

  let notas: Nota[] = [];
  try {
    const r = await serverFetch('/api/notas', { cache: 'no-store' });
    if (r.ok) notas = (await r.json()).notas ?? [];
  } catch { /* notas = [] */ }

  return <NotasView notasIniciales={notas} rol={user.rol} userId={user.id} />;
}
