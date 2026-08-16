export const site = {
  name: 'Новосибирск-2035',
  shortName: 'НСК—2035',
  description: 'Независимый редакционный проект о возможных сценариях развития Новосибирска.',
  locale: 'ru_RU',
  language: 'ru',
};

export function resolveSiteUrl(env = process.env) {
  const candidate = env.URL || env.SITE_URL || 'https://novosibirsk-2035.netlify.app';

  let url;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error(`SITE_URL должен быть абсолютным URL, получено: ${candidate}`);
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error(`SITE_URL должен использовать http или https, получено: ${url.protocol}`);
  }

  return url.toString().replace(/\/$/, '');
}

