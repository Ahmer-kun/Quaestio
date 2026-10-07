export const SITE_URL = "https://quaestio-nu.vercel.app";

export const SITE_NAME = "The Question";

export function absoluteUrl(path = "/"): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}