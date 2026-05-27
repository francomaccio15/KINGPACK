import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/requireAuth';
import { serverFetch } from '@/lib/serverFetch';
import DashboardView from './DashboardView';
import type { DashboardData } from './DashboardView';

export const revalidate = 0;

export default async function DashboardPage() {
  const user = requireAuth();
  if (user.rol === 'cajero') redirect('/ventas');
  const res  = await serverFetch('/api/dashboard');
  const data: DashboardData | null = res.ok ? await res.json() : null;
  return <DashboardView data={data} userName={user.nombre} />;
}
