import type { Metadata } from 'next';
import { getDynamicDocMetadata } from '../../../lib/server-meta';
import { getSocietyUrl } from '../../../lib/links';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return getDynamicDocMetadata({
    collection: 'societies',
    id,
    fallbackTitle: 'Islamic Society & Creator Community',
    fallbackDescription: 'Join and engage with Islamic communities, scholars, and creators on Noor Library.',
    urlBuilder: getSocietyUrl,
  });
}

export default function SocietyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
