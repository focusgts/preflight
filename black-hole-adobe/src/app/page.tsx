import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { LandingPageClient } from '@/components/landing/landing-page-client';

export default async function HomePage() {
  const cookieStore = await cookies();
  const session = cookieStore.get('bh_session');

  if (session?.value) {
    redirect('/overview');
  }

  return <LandingPageClient />;
}
