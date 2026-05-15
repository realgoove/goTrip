'use client';
import { useState, useEffect } from 'react';

export function useAddresses(type: 'home' | 'dest', loggedIn: boolean) {
  const [saved, setSaved] = useState<string[]>([]);

  useEffect(() => {
    if (!loggedIn) { setSaved([]); return; }
    fetch(`/api/addresses?type=${type}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setSaved(Array.isArray(data) ? data : []))
      .catch(() => setSaved([]));
  }, [type, loggedIn]);

  async function save(address: string) {
    if (!address.trim() || !loggedIn) return;
    await fetch('/api/addresses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, address }),
    }).catch(() => {});
    setSaved(prev => [address, ...prev.filter(a => a !== address)].slice(0, 20));
  }

  async function remove(address: string) {
    if (!loggedIn) return;
    await fetch('/api/addresses', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, address }),
    }).catch(() => {});
    setSaved(prev => prev.filter(a => a !== address));
  }

  return { saved, save, remove };
}
