// src/app/series/page.tsx
// Redirects /series directly to the series tab in the main catalog, preventing 404 errors.

import { redirect } from 'next/navigation';

export default function SeriesCatalogPage() {
  redirect('/books?tab=series');
}
