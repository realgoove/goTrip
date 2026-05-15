'use client';
import { SavedSearch } from '@/hooks/useHistory';

interface Props {
  history: SavedSearch[];
  onSelect: (s: SavedSearch) => void;
  onDelete: (id: string) => void;
}

export function SearchHistory({ history, onSelect, onDelete }: Props) {
  if (!history.length) return null;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mt-4">
      <p className="text-xs font-semibold text-gray-600 mb-2">📋 검색 기록</p>
      <div className="space-y-1.5">
        {history.map(s => {
          const dep = (s.flightDateISO ?? s.savedAt.slice(0, 10)).replace(/-/g, '/');
          const ret = s.returnDateISO?.replace(/-/g, '/');
          const dateRange = ret ? `${dep}-${ret}` : dep;
          const h = Math.floor(s.bufferMins / 60);
          const m = s.bufferMins % 60;
          const buffer = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
          return (
            <div
              key={s.id}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-gray-100 hover:border-blue-200 hover:bg-blue-50/30 transition-colors"
            >
              <button
                type="button"
                onClick={() => onSelect(s)}
                className="flex-1 text-left min-w-0"
              >
                <div className="text-sm font-semibold text-gray-800 truncate">
                  <span className="text-blue-600 mr-2">{dateRange}</span>
                  {s.label}
                </div>
                <div className="text-[11px] text-gray-400 mt-0.5 truncate">
                  {s.homeAddress} → {s.destAddress}
                  <span className="ml-1.5">· {buffer}</span>
                </div>
              </button>
              <button
                type="button"
                onClick={() => onDelete(s.id)}
                className="text-gray-300 hover:text-red-400 shrink-0 text-base leading-none"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
