import type { EventEmitter } from 'node:events';

export interface BuildDirectories {
  root: string;
  src: string;
  package: string;
  build: string;
  nodeModules: string;
}

export interface AssetHashFlags {
  STARTED?: boolean;
  REWRITING?: boolean;
  IMAGES: boolean;
  CSS: boolean;
  JS: boolean;
  DONE: boolean;
}

export interface CompletionFlags {
  JS_IS_MINIFIED: boolean;
  CSS_IS_MINIFIED: boolean;
  HTML_IS_MINIFIED: boolean;
  IMAGES_ARE_MOVED: boolean;
  VIDEOS_ARE_MOVED: boolean;
  ASSETS_ARE_MOVED?: boolean;
  FAVICON_ICO?: boolean;
  ASSET_HASH: AssetHashFlags;
  SITE_MAP: boolean;
  GZIP: boolean;
  PREVIEW_READY: boolean;
}

export interface BuildEventsMap {
  assetHashCssListed: string;
  assetHashImagesListed: string;
  assetHashJsListed: string;
  assetsMoved: string;
  gzipDone: string;
  hashingDone: string;
  htmlMinified: string;
  imagesMoved: string;
  indexCssForHashing: string;
  jsMinified: string;
  jsMoved: string;
  pageMappingDataCompiled: string;
  previewReady: string;
  sitemapDone: string;
  stylesMoved: string;
  templatesMoved: string;
  videosMoved: string;
}

export interface OgImageRecipe {
  selector: string;
  alt?: string;
  fit?: 'cover' | 'contain';
  position?: string;
  padding?: number;
  width?: number;
  height?: number;
  scale?: number;
  hideFixed?: boolean;
  wait?: number;
  actions?: Array<Record<string, unknown>>;
}

export interface MusicVenue {
  name?: string;
  mapsQuery?: string;
  mapsUrl?: string;
  note?: string;
}

export interface MusicConcertArchive {
  url?: string;
  label?: string;
}

export interface MusicBandNote {
  band: string;
  note: string;
}

export interface MusicBand {
  name: string;
  note?: string;
  setlistUrl?: string;
  setlistLabel?: string;
}

export interface MusicReference {
  label: string;
  url: string;
}

export interface PageFrontMatter {
  title?: string;
  altTitle?: string;
  metaTitle?: string;
  description?: string;
  metaDescription?: string;
  date?: string | Date;
  dateNote?: string;
  priority?: number;
  robots?: boolean | string;
  redirectTo?: string;
  musicPinOrder?: number;
  musicSummary?: string;
  tour?: string;
  location?: string;
  venue?: MusicVenue;
  concertArchive?: MusicConcertArchive;
  bandsSummary?: string;
  festivalBillNote?: string;
  tourHistory?: string[];
  bandNotes?: MusicBandNote[];
  bands?: MusicBand[];
  references?: MusicReference[];
  flagged?: boolean;
  flagNote?: string;
  schemaType?: string;
  layout?: string;
  styles?: string[];
  scripts?: string[];
  pageClasses?: string[];
  ogImage?: OgImageRecipe;
  [key: string]: unknown;
}

export interface PageMappingEntry {
  url: string;
  data: PageFrontMatter;
}

export interface SiteData {
  author: string;
  jobTitle: string;
  locale: string;
  ogLocale: string;
  domain: string;
  siteName: string;
  siteDescription: string;
  social: Record<string, string>;
  commitHash: string;
  buildDateTime: string;
  buildRandom: () => () => number;
  production: boolean;
  [key: string]: unknown;
}

export interface BuildConfigs {
  BUILD_EVENTS: BuildEventsMap;
  buildEvents: EventEmitter;
  completionFlags: CompletionFlags;
  debug: boolean;
  dir: BuildDirectories;
  hashingFileNameList: Record<string, string>;
  pageMappingData: PageMappingEntry[];
  isGoldenBuild: boolean;
}
