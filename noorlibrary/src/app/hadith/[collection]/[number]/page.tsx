import { redirect } from 'next/navigation';

export default async function HadithItemRedirectPage({
  params,
}: {
  params: Promise<{ collection: string; number: string }>;
}) {
  const { collection, number } = await params;
  redirect(`/hadith?collection=${encodeURIComponent(collection)}&number=${encodeURIComponent(number)}`);
}
