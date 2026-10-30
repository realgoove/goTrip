import { kv } from '@vercel/kv';
import { TripPlan, ParsedFlight } from '@/types';

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
  // 저장 시점에 계산된 경로 전체 — 이력 선택 시 재검색 없이 그대로 복원한다.
  plans?: TripPlan[];          // 왕복(모든 항공편)의 경로
  plan?: TripPlan;             // 구버전 호환 (단일 경로)
  parsedFlights?: ParsedFlight[];
  selectedFlight?: number;
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

// 이력 함수는 KV 오류를 삼키지 않는다 — 저장소가 사라져도 "저장됨"으로 보이던 문제 방지.
// 호출하는 API 라우트가 503으로 돌려주고, 클라이언트는 localStorage로 대체한다.
export async function getHistory(userId: string): Promise<SavedSearch[]> {
  return await kv.get<SavedSearch[]>(`history:${userId}`) ?? [];
}

export async function saveToHistory(userId: string, searches: SavedSearch[]): Promise<void> {
  const current = await getHistory(userId);
  const ids = new Set(searches.map(s => s.id));
  // 다른 기기에서 올린 옛 이력이 섞여도 최신순을 유지
  const next = [...searches, ...current.filter(s => !ids.has(s.id))]
    .sort((a, b) => (b.savedAt ?? '').localeCompare(a.savedAt ?? ''))
    .slice(0, 20);
  await kv.set(`history:${userId}`, next);
}

export async function deleteFromHistory(userId: string, id: string): Promise<void> {
  const current = await getHistory(userId);
  await kv.set(`history:${userId}`, current.filter(s => s.id !== id));
}
