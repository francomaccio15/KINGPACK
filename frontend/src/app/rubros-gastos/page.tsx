import { requireAuth } from '@/lib/requireAuth';
import RubrosClient from './RubrosClient';

export const dynamic = 'force-dynamic';

export default function RubrosGastosPage() {
  requireAuth('/rubros-gastos');
  return <RubrosClient />;
}
