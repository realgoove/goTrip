'use client';
import { useSession } from 'next-auth/react';
import { AddressInput } from './AddressInput';
import { useAddresses } from '@/hooks/useAddresses';
import { SAMPLE_ITINERARY } from '@/lib/constants';

interface Props {
  onSubmit: (itinerary: string) => void;
  itinerary: string;
  onItineraryChange: (v: string) => void;
  homeAddress: string;
  destAddress: string;
  onHomeAddressChange: (v: string) => void;
  onDestAddressChange: (v: string) => void;
  bufferMins: number;
  onBufferMinsChange: (v: number) => void;
  departureTime?: string;
  loading: boolean;
}

function subMin(hhmm: string, mins: number): string {
  const [h, m] = hhmm.split(':').map(Number);
  const t = ((h * 60 + m - mins) % 1440 + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

export function FlightInputForm({
  onSubmit, itinerary, onItineraryChange,
  homeAddress, destAddress, onHomeAddressChange, onDestAddressChange,
  bufferMins, onBufferMinsChange, departureTime, loading,
}: Props) {
  const { data: session } = useSession();
  const loggedIn = !!session;

  const homeAddr = useAddresses('home', loggedIn);
  const destAddr = useAddresses('dest', loggedIn);

  return (
    <form
      onSubmit={e => { e.preventDefault(); onSubmit(itinerary); }}
      className="space-y-4"
    >
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-sm font-semibold text-gray-700">✈️ 이티켓 정보</label>
          <button
            type="button"
            onClick={() => onItineraryChange(SAMPLE_ITINERARY)}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            샘플 복원
          </button>
        </div>
        <textarea
          value={itinerary}
          onChange={e => onItineraryChange(e.target.value)}
          rows={2}
          className="w-full border border-gray-200 rounded-xl p-3 text-xs font-mono bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          placeholder="항공권 텍스트를 붙여넣기 하세요..."
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">🏠 출발지 주소</label>
          <AddressInput
            value={homeAddress}
            onChange={onHomeAddressChange}
            saved={homeAddr.saved}
            onSave={() => homeAddr.save(homeAddress)}
            onDelete={homeAddr.remove}
            placeholder="출발지 주소 입력..."
            loggedIn={loggedIn}
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">📍 최종 목적지</label>
          <AddressInput
            value={destAddress}
            onChange={onDestAddressChange}
            saved={destAddr.saved}
            onSave={() => destAddr.save(destAddress)}
            onDelete={destAddr.remove}
            placeholder="목적지 주소 입력..."
            loggedIn={loggedIn}
          />
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <label className="text-sm font-semibold text-gray-700 shrink-0">🕐 공항 여유시간</label>
        <div className="flex gap-1.5">
          {[{ label: '01:30', value: 90 }, { label: '01:45', value: 105 }, { label: '02:00', value: 120 }].map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onBufferMinsChange(opt.value)}
              className={`px-4 py-1.5 text-sm rounded-xl border font-medium transition-colors ${
                bufferMins === opt.value
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-blue-400'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {departureTime && (
          <span className="text-xs text-gray-500">
            → <strong className="text-gray-700">{subMin(departureTime, bufferMins)}</strong> 전 도착
          </span>
        )}
      </div>

      {!loggedIn && (
        <p className="text-xs text-gray-400 text-center">로그인하면 주소와 검색 기록을 저장할 수 있습니다</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
      >
        {loading ? '⏳ 경로 계산 중...' : '🔍 경로 검색'}
      </button>
    </form>
  );
}
