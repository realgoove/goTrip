'use client';
import { useState, useEffect } from 'react';
import { SavedSearch } from '@/lib/kv';

export type { SavedSearch };

const LS_KEY = 'gotrip_history';

function lsLoad(): SavedSearch[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]') ?? []; } catch { return []; }
}

function lsSave(data: SavedSearch[]) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch {}
}

export function useHistory(loggedIn: boolean) {
  const [history, setHistory] = useState<SavedSearch[]>([]);

  useEffect(() => {
    if (!loggedIn) { setHistory([]); return; }
    (async () => {
      const local = lsLoad();
      try {
        const r = await fetch('/api/history');
        // 서버 장애(KV 미연결 등) → 이 기기의 localStorage로 대체
        if (!r.ok) { setHistory(local); return; }
        const data = await r.json();
        const server: SavedSearch[] = Array.isArray(data) ? data : [];

        // 이 기기에만 있는 이력은 서버로 올려 다른 기기에서도 보이게 한다
        const serverIds = new Set(server.map(s => s.id));
        const missing = local.filter(s => !serverIds.has(s.id));
        if (missing.length) {
          const up = await fetch('/api/history', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(missing),
          }).catch(() => null);
          if (!up?.ok) console.error('[useHistory] localStorage 이력 업로드 실패');
        }

        const merged = [...server, ...missing]
          .sort((a, b) => (b.savedAt ?? '').localeCompare(a.savedAt ?? ''))
          .slice(0, 20);
        setHistory(merged);
        lsSave(merged);
      } catch {
        setHistory(local);
      }
    })();
  }, [loggedIn]);

  // 서버 저장에 실패해도 이 기기에는 남기고, 호출한 쪽이 알 수 있게 예외를 던진다
  async function save(search: Omit<SavedSearch, 'id' | 'savedAt'>) {
    if (!loggedIn) return;
    const id = [search.flightDateISO, search.returnDateISO].filter(Boolean).join('_');
    const full: SavedSearch = { ...search, id, savedAt: new Date().toISOString() };
    const res = await fetch('/api/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(full),
    }).catch(() => null);
    setHistory(prev => {
      const next = [full, ...prev.filter(s => s.id !== full.id)].slice(0, 20);
      lsSave(next);
      return next;
    });
    if (!res?.ok) throw new Error('SERVER_SAVE_FAILED');
  }

  async function remove(id: string) {
    if (!loggedIn) return;
    await fetch('/api/history', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    }).catch(() => {});
    setHistory(prev => {
      const next = prev.filter(s => s.id !== id);
      lsSave(next);
      return next;
    });
  }

  return { history, save, remove };
}
