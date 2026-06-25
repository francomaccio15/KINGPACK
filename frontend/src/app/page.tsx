import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/requireAuth';
import { landingPath } from '@/lib/permissions';

export default function HomePage() {
  // requireAuth redirige a /login si no hay sesión; si la hay, mandamos al
  // landing según el rol (cajero → ventas, resto → dashboard).
  const user = requireAuth();
  redirect(landingPath(user.rol));
}
