export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export function buildPlayerProfilePath(name: string, id: string): string {
  return `/players/${slugify(name)}-${id}`;
}

export function parsePlayerProfilePath(pathname: string): { slug: string; id: string } | null {
  const path = pathname.toLowerCase().replace(/\/+$/, '');
  if (!path.startsWith('/players/')) return null;
  const tail = path.slice('/players/'.length);
  if (!tail) return null;
  const lastDash = tail.lastIndexOf('-');
  if (lastDash <= 0 || lastDash === tail.length - 1) return null;
  return { slug: tail.slice(0, lastDash), id: tail.slice(lastDash + 1) };
}
