import type { Metadata } from 'next';
import { getQuranSurahMetadata } from '../../../lib/server-meta';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ surahId: string }>;
}): Promise<Metadata> {
  const { surahId } = await params;
  return getQuranSurahMetadata(surahId);
}

export default function QuranSurahLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
