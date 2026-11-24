import type { PageMappingEntry } from '../types.ts';

export interface AdjacentShows {
  previous: PageMappingEntry | null;
  next: PageMappingEntry | null;
}

export interface MusicHelpers {
  normalizePageUrl: (pageUrl?: string | null) => string;
  formatShowDate: (dateValue?: string | number | Date) => string;
  getPinnedMusicPages: (pageMappingData: PageMappingEntry[]) => PageMappingEntry[];
  getMusicShows: (pageMappingData: PageMappingEntry[]) => PageMappingEntry[];
  getAdjacentShows: (orderedShows: PageMappingEntry[], currentPath: string) => AdjacentShows;
  buildGoogleMapsUrl: (venueQuery?: string | null) => string;
  buildSetlistSearchUrl: (artistName: string, location?: string, year?: string | number) => string;
  buildConcertArchivesSearchUrl: (query?: string | null) => string;
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
];

/**
 * Normalizes a page URL by stripping any leading or trailing slashes so
 * comparisons stay consistent across templates and tests.
 *
 * @param pageUrl - Relative page URL from `pageMappingData` or template locals.
 * @returns URL without leading or trailing slashes (e.g. `'music/show/2006-06-21-bonner-springs'`).
 */
function normalizePageUrl(pageUrl?: string | null): string {
  if (!pageUrl) {
    return '';
  }
  return String(pageUrl).replace(/^\/+/, '').replace(/\/+$/, '');
}

/**
 * Converts a front-matter date value into a UTC timestamp in milliseconds for
 * deterministic chronological sorting regardless of host timezone.
 *
 * @param dateValue - Front-matter date value.
 * @returns UTC epoch milliseconds, or `0` if missing or invalid.
 */
function toUtcTimestamp(dateValue?: string | number | Date): number {
  if (dateValue === undefined) {
    return 0;
  }
  const parsed = new Date(dateValue);
  const time = parsed.getTime();
  if (Number.isNaN(time)) {
    return 0;
  }
  return time;
}

/**
 * Formats a show date in UTC as a human-readable string (e.g. `'June 21, 2006'`).
 * Using UTC prevents local timezones from shifting midnight front-matter dates
 * backward by one day and keeps golden builds deterministic.
 *
 * @param dateValue - The show date.
 * @returns Human-readable UTC date string.
 */
function formatShowDate(dateValue?: string | number | Date): string {
  if (dateValue === undefined) {
    return '';
  }
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }
  const monthName = MONTHS[parsed.getUTCMonth()];
  const day = parsed.getUTCDate();
  const year = parsed.getUTCFullYear();
  return `${monthName} ${day}, ${year}`;
}

/**
 * Returns the pinned music section pages (direct children under `music/` such
 * as Last.fm trends, listening history, and music news), ordered by their
 * numeric `musicPinOrder` front-matter field and then alphabetically by title.
 *
 * @param pageMappingData - Full site page index.
 * @returns Pinned music pages in display order.
 */
function getPinnedMusicPages(pageMappingData: PageMappingEntry[]): PageMappingEntry[] {
  const pinnedPages = pageMappingData.filter((page) => {
    const normalized = normalizePageUrl(page.url);
    const segments = normalized.split('/');
    if (segments.length !== 2 || segments[0] !== 'music') {
      return false;
    }
    if (page.data.robots === false || page.data.redirectTo) {
      return false;
    }
    return typeof page.data.musicPinOrder === 'number';
  });

  return pinnedPages.sort((pageA, pageB) => {
    const orderA = pageA.data.musicPinOrder ?? 0;
    const orderB = pageB.data.musicPinOrder ?? 0;
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    const titleA = String(pageA.data.title || '');
    const titleB = String(pageB.data.title || '');
    return titleA.localeCompare(titleB);
  });
}

/**
 * Returns all concert show pages under `music/show/`, sorted chronologically
 * from oldest to newest. Ties on the same date break deterministically by URL.
 *
 * @param pageMappingData - Full site page index.
 * @returns Show pages sorted oldest to newest.
 */
function getMusicShows(pageMappingData: PageMappingEntry[]): PageMappingEntry[] {
  const showPages = pageMappingData.filter((page) => {
    const normalized = normalizePageUrl(page.url);
    const segments = normalized.split('/');
    if (segments.length !== 3 || segments[0] !== 'music' || segments[1] !== 'show') {
      return false;
    }
    if (page.data.robots === false || page.data.redirectTo) {
      return false;
    }
    return true;
  });

  return showPages.sort((showA, showB) => {
    const timeDifference = toUtcTimestamp(showA.data.date) - toUtcTimestamp(showB.data.date);
    if (timeDifference !== 0) {
      return timeDifference;
    }
    return normalizePageUrl(showA.url).localeCompare(normalizePageUrl(showB.url));
  });
}

/**
 * Finds the immediately older (`previous`) and newer (`next`) shows around a
 * given show page URL inside the chronologically ordered show list.
 *
 * @param orderedShows - Shows sorted oldest to newest.
 * @param currentPath - Current show page URL.
 * @returns Adjacent show entries.
 */
function getAdjacentShows(orderedShows: PageMappingEntry[], currentPath: string): AdjacentShows {
  const targetUrl = normalizePageUrl(currentPath);
  const currentIndex = orderedShows.findIndex(
    (entry) => normalizePageUrl(entry.url) === targetUrl
  );

  if (currentIndex === -1) {
    return { previous: null, next: null };
  }

  let previous: PageMappingEntry | null = null;
  let next: PageMappingEntry | null = null;
  if (currentIndex > 0) {
    previous = orderedShows[currentIndex - 1];
  }
  if (currentIndex < orderedShows.length - 1) {
    next = orderedShows[currentIndex + 1];
  }

  return { previous, next };
}

/**
 * Builds a Google Maps search URL for a venue query (address + venue name) so
 * visitors can locate the physical site even if the venue changed names or was
 * demolished.
 *
 * @param venueQuery - Human-readable address or venue search string.
 * @returns Encoded Google Maps search URL.
 */
function buildGoogleMapsUrl(venueQuery?: string | null): string {
  if (!venueQuery) {
    return '';
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venueQuery)}`;
}

/**
 * Builds a targeted Setlist.fm search URL for a band at a specific location and
 * year, used when no direct per-show Setlist.fm page has been confirmed.
 *
 * @param artistName - Band or performer name.
 * @param location - City/venue context for narrowing results.
 * @param year - Four-digit concert year.
 * @returns Encoded Setlist.fm search URL.
 */
function buildSetlistSearchUrl(
  artistName: string,
  location = '',
  year: string | number = '',
): string {
  const parts = [artistName, location, year].filter(Boolean);
  return `https://www.setlist.fm/search?query=${encodeURIComponent(parts.join(' '))}`;
}

/**
 * Builds a Concert Archives search URL for shows that do not yet have a
 * confirmed direct Concert Archives event page.
 *
 * @param query - Concert search query (artist, venue, or tour + year).
 * @returns Encoded Concert Archives search URL.
 */
function buildConcertArchivesSearchUrl(query?: string | null): string {
  if (!query) {
    return 'https://www.concertarchives.org/';
  }
  return `https://www.concertarchives.org/concerts?search=${encodeURIComponent(query)}`;
}

// Bind exports to MusicHelpers so TypeScript verifies CJS consumers stay in sync.
const musicHelpers: MusicHelpers = {
  normalizePageUrl,
  formatShowDate,
  getPinnedMusicPages,
  getMusicShows,
  getAdjacentShows,
  buildGoogleMapsUrl,
  buildSetlistSearchUrl,
  buildConcertArchivesSearchUrl,
};

module.exports = musicHelpers;
