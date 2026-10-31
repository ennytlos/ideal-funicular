/**
 * Noor Library - Central Canonical Link Resolver
 * Production Base Domain: https://noorlibrary.com.ng
 */

export const APP_BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL || 'https://noorlibrary.com.ng';

export const getBookUrl = (bookId: string | number) =>
  `${APP_BASE_URL}/books/${bookId}`;

export const getSeriesUrl = (seriesId: string | number) =>
  `${APP_BASE_URL}/series/${seriesId}`;

export const getCourseUrl = (courseId: string | number) =>
  `${APP_BASE_URL}/courses/${courseId}`;

export const getQuranUrl = (surahId: string | number, ayahId?: string | number) =>
  ayahId
    ? `${APP_BASE_URL}/quran/${surahId}?ayah=${ayahId}`
    : `${APP_BASE_URL}/quran/${surahId}`;

export const getHadithUrl = (collection: string, hadithNumber: string | number) =>
  `${APP_BASE_URL}/hadith/${collection}/${hadithNumber}`;

export const getSocietyUrl = (societyId: string | number) =>
  `${APP_BASE_URL}/societies/${societyId}`;

export const getReminderUrl = (reminderId?: string | number) =>
  reminderId
    ? `${APP_BASE_URL}/reminder?id=${reminderId}`
    : `${APP_BASE_URL}/reminder`;

export const getAdhkaarUrl = (collectionId?: string | number) =>
  collectionId
    ? `${APP_BASE_URL}/adhkaar/collection/${collectionId}`
    : `${APP_BASE_URL}/adhkaar`;
