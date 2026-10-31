import type { Metadata } from 'next';
import { getDynamicDocMetadata } from '../../../lib/server-meta';
import { getBookUrl } from '../../../lib/links';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return getDynamicDocMetadata({
    collection: 'books',
    id,
    fallbackTitle: 'Islamic Book',
    fallbackDescription: 'Read authentic Islamic literature and publications on Noor Library.',
    urlBuilder: getBookUrl,
    creatorField: 'author',
  });
}

export default function BookLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
