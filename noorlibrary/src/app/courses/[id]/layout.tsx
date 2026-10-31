import type { Metadata } from 'next';
import { getDynamicDocMetadata } from '../../../lib/server-meta';
import { getCourseUrl } from '../../../lib/links';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return getDynamicDocMetadata({
    collection: 'courses',
    id,
    fallbackTitle: 'Islamic Course',
    fallbackDescription: 'Enroll in structured Islamic courses and deepen your knowledge on Noor Library.',
    urlBuilder: getCourseUrl,
    creatorField: 'instructor',
  });
}

export default function CourseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
