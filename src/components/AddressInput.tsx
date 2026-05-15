'use client';
import { useState, useRef, useEffect } from 'react';

interface Props {
  value: string;
  onChange: (v: string) => void;
  saved: string[];
  onSave: () => void;
  onDelete: (addr: string) => void;
  placeholder: string;
  loggedIn: boolean;
}

export function AddressInput({ value, onChange, saved, onSave, onDelete, placeholder, loggedIn }: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  return (
    <div className="relative" ref={wrapRef}>
      <div className="flex gap-1">
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => saved.length > 0 && setOpen(true)}
          placeholder={placeholder}
          className="flex-1 border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-0"
        />
        {loggedIn && (
          <button
            type="button"
            onClick={() => { onSave(); setOpen(false); }}
            disabled={!value.trim()}
            title="주소 저장"
            className="px-3 text-xs bg-blue-50 text-blue-600 border border-blue-200 rounded-xl hover:bg-blue-100 disabled:opacity-40 shrink-0"
          >
            저장
          </button>
        )}
        {loggedIn && saved.length > 0 && (
          <button
            type="button"
            onClick={() => setOpen(o => !o)}
            className="px-2.5 text-gray-400 border border-gray-200 rounded-xl hover:bg-gray-50 shrink-0 text-xs"
          >
            {open ? '▲' : '▼'}
          </button>
        )}
      </div>

      {open && saved.length > 0 && (
        <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          {saved.map(addr => (
            <div key={addr} className="flex items-center px-3 py-2.5 hover:bg-gray-50 border-b border-gray-50 last:border-0">
              <button
                type="button"
                className="flex-1 text-left text-sm text-gray-700 truncate"
                onClick={() => { onChange(addr); setOpen(false); }}
              >
                {addr}
              </button>
              <button
                type="button"
                onClick={e => { e.stopPropagation(); onDelete(addr); }}
                className="ml-2 text-gray-300 hover:text-red-400 shrink-0 text-base leading-none"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
