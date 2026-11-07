import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const url = (path: string) => `${base}${path}`;
  return [
    { url: url("/"), lastModified: new Date(), priority: 1 },
    { url: url("/lingo"), lastModified: new Date(), priority: 0.9 },
    { url: url("/karogs"), lastModified: new Date(), priority: 0.9 },
    { url: url("/statistika"), lastModified: new Date(), priority: 0.6 },
    { url: url("/ka-spelet"), lastModified: new Date(), priority: 0.6 },
    { url: url("/par-projektu"), lastModified: new Date(), priority: 0.5 },
    { url: url("/iestatijumi"), lastModified: new Date(), priority: 0.4 },
  ];
}
