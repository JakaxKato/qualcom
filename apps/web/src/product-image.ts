// Only replace the original demo illustrations. Merchant images pass through unchanged.
const studioImages: Record<string, string> = {
  '/images/chair.svg': '/images/studio/chair.jpg',
  '/images/sofa.svg': '/images/studio/sofa.jpg',
  '/images/coffee.svg': '/images/studio/coffee.jpg',
  '/images/mattress.svg': '/images/studio/mattress.jpg',
  '/images/pillow.svg': '/images/studio/pillow.jpg',
};

export function productImage(source: string): string {
  return studioImages[source] || source;
}
