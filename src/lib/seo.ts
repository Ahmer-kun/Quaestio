import { SITE_NAME, absoluteUrl } from "./site";

export const DEFAULT_DESCRIPTION = "A quiet space for life's biggest questions.";

export const OG_IMAGE_PATH = "/og-image.jpg";

export const OG_IMAGE_ALT = "A crescent moon above a quiet hillside at dusk";

type PageSeoOptions = {
  title: string;
  description: string;
  path?: string;
  imagePath?: string;
};

export function pageSeo({ title, description, path = "/", imagePath = OG_IMAGE_PATH }: PageSeoOptions) {
  const url = absoluteUrl(path);
  const image = absoluteUrl(imagePath);
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:url", content: url },
      { property: "og:image", content: image },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: OG_IMAGE_ALT },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: image },
    ],
    links: [{ rel: "canonical", href: url }],
  };
}

export const websiteJsonLd = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NAME,
  url: absoluteUrl("/"),
  description: DEFAULT_DESCRIPTION,
});