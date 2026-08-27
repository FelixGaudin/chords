/**
 * URL-safe slugs. Kept free of node imports so client components can use it
 * to build links without dragging the filesystem layer into the bundle.
 */
export function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}
