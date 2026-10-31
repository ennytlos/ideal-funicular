import type { Metadata } from 'next';
import { getDynamicDocMetadata } from '../../../lib/server-meta';
import { getSeriesUrl } from '../../../lib/links';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return getDynamicDocMetadata({
    collection: 'series',
    id,
    fallbackTitle: 'Islamic Series',
    fallbackDescription: 'Explore serialized Islamic lessons, articles, and knowledge on Noor Library.',
    urlBuilder: getSeriesUrl,
    creatorField: 'author',
  });
}

export default function SeriesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
