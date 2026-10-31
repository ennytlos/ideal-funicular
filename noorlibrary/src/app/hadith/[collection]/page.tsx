import { redirect } from 'next/navigation';

export default async function HadithCollectionRedirectPage({
  params,
}: {
  params: Promise<{ collection: string }>;
}) {
  const { collection } = await params;
  redirect(`/hadith?collection=${encodeURIComponent(collection)}`);
}
