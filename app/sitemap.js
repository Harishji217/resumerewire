export default function sitemap() {
  const base = process.env.SITE_URL || 'http://localhost:3000';
  return [
    { url: base, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/dashboard`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/create`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
  ];
}
