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

// Player ids in this app are either:
//   - a numeric Sleeper externalId (e.g. "6803"), or
//   - a UUID v4 from generateId() (e.g. "e72f0bdc-2987-4d0c-9e31-4f8c6abc8f13").
// UUIDs contain hyphens, so naive lastIndexOf('-') splitting truncates them.
// We detect a trailing UUID first, then fall back to splitting on the last
// hyphen for short numeric ids.
const TRAILING_UUID = /-([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/;

export function parsePlayerProfilePath(pathname: string): { slug: string; id: string } | null {
  const path = pathname.toLowerCase().replace(/\/+$/, '');
  if (!path.startsWith('/players/')) return null;
  const tail = path.slice('/players/'.length);
  if (!tail) return null;

  const uuid = tail.match(TRAILING_UUID);
  if (uuid) {
    const slug = tail.slice(0, tail.length - uuid[0].length);
    if (!slug) return null;
    return { slug, id: uuid[1] };
  }

  const lastDash = tail.lastIndexOf('-');
  if (lastDash <= 0 || lastDash === tail.length - 1) return null;
  return { slug: tail.slice(0, lastDash), id: tail.slice(lastDash + 1) };
}

