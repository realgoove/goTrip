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
    fetch('/api/history')
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        const server = Array.isArray(data) ? data : [];
        if (server.length > 0) {
          setHistory(server);
          lsSave(server);
        } else {
          // KV 미설정 등으로 서버에 없으면 localStorage에서 복원
          const local = lsLoad();
          setHistory(local);
        }
      })
      .catch(() => setHistory(lsLoad()));
  }, [loggedIn]);

  async function save(search: Omit<SavedSearch, 'id' | 'savedAt'>) {
    if (!loggedIn) return;
    const id = [search.flightDateISO, search.returnDateISO].filter(Boolean).join('_');
    const full: SavedSearch = { ...search, id, savedAt: new Date().toISOString() };
    await fetch('/api/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(full),
    }).catch(() => {});
    setHistory(prev => {
      const next = [full, ...prev.filter(s => s.id !== full.id)].slice(0, 20);
      lsSave(next);
      return next;
    });
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
