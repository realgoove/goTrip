import { kv } from '@vercel/kv';

export interface SavedSearch {
  id: string;
  savedAt: string;
  flightDateISO: string;
  returnDateISO?: string;
  label: string;
  itinerary: string;
  homeAddress: string;
  destAddress: string;
  bufferMins: number;
}

function key(userId: string, type: string) {
  return `addr:${type}:${userId}`;
}

export async function getAddresses(userId: string, type: string): Promise<string[]> {
  try {
    const data = await kv.get<string[]>(key(userId, type));
    return data ?? [];
  } catch {
    return [];
  }
}

export async function saveAddress(userId: string, type: string, address: string): Promise<void> {
  try {
    const current = await getAddresses(userId, type);
    const next = [address, ...current.filter(a => a !== address)].slice(0, 20);
    await kv.set(key(userId, type), next);
  } catch {}
}

export async function deleteAddress(userId: string, type: string, address: string): Promise<void> {
  try {
    const current = await getAddresses(userId, type);
    await kv.set(key(userId, type), current.filter(a => a !== address));
  } catch {}
}

// ── Search history ────────────────────────────────────────────────────────────

export async function getHistory(userId: string): Promise<SavedSearch[]> {
  try {
    return await kv.get<SavedSearch[]>(`history:${userId}`) ?? [];
  } catch {
    return [];
  }
}

export async function saveToHistory(userId: string, search: SavedSearch): Promise<void> {
  try {
    const current = await getHistory(userId);
    const next = [search, ...current.filter(s => s.id !== search.id)].slice(0, 20);
    await kv.set(`history:${userId}`, next);
  } catch {}
}

export async function deleteFromHistory(userId: string, id: string): Promise<void> {
  try {
    const current = await getHistory(userId);
    await kv.set(`history:${userId}`, current.filter(s => s.id !== id));
  } catch {}
}
