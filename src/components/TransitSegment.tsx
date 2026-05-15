import { TransitRoute } from '@/types';

const VEHICLE_ICONS: Record<string, string> = {
  SUBWAY: '🚇',
  RAIL: '🚃',
  COMMUTER_TRAIN: '🚃',
  TRAM: '🚋',
  MONORAIL: '🚝',
  BUS: '🚌',
  FERRY: '⛴️',
  CABLE_CAR: '🚡',
};

interface Props {
  title: string;
  from: string;
  to: string;
  route: TransitRoute | null;
  loading?: boolean;
}

export function TransitSegment({ title, from, to, route, loading }: Props) {
  if (loading) {
    return (
      <div className="bg-blue-50 rounded-2xl p-4 animate-pulse">
        <div className="h-4 bg-blue-200 rounded w-1/3 mb-3" />
        <div className="space-y-2">
          <div className="h-3 bg-blue-200 rounded w-3/4" />
          <div className="h-3 bg-blue-200 rounded w-1/2" />
        </div>
      </div>
    );
  }

  if (!route) {
    return (
      <div className="bg-gray-50 rounded-2xl p-4 text-sm text-gray-500">
        경로 정보를 불러오지 못했습니다.
      </div>
    );
  }

  const isYahooUrl = route?.googleMapsUrl?.includes('transit.yahoo.co.jp');
  const isNaverUrl = route?.googleMapsUrl?.includes('map.naver.com');
  const gmapsUrl = (isYahooUrl || isNaverUrl)
    ? route!.googleMapsUrl
    : `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(from)}&destination=${encodeURIComponent(to)}&travelmode=transit`;

  if (route.status !== 'OK') {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-base">🗺️</span>
          <h3 className="font-semibold text-blue-900 text-sm">{title}</h3>
        </div>
        <p className="text-xs text-blue-700 mb-3">
          이 구간은 Google Maps 앱에서 경로를 확인해 주세요.
        </p>
        <a
          href={gmapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full bg-blue-600 text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-blue-700 transition-colors"
        >
          🗺️ {isYahooUrl ? 'Yahoo 路線情報에서 경로 보기' : isNaverUrl ? 'Naver 지도에서 경로 보기' : 'Google Maps에서 경로 보기'}
        </a>
        <p className="text-xs text-gray-400 mt-2 text-center">클릭하면 대중교통 경로가 바로 열립니다</p>
      </div>
    );
  }

  return (
    <div className="bg-blue-50 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-blue-900 text-sm">{title}</h3>
        <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
          총 {route.totalDuration}
        </span>
      </div>

      {route.departureTime && (
        <div className="text-xs text-blue-700 mb-3">
          {route.departureTime} 출발 → {route.arrivalTime} 도착
        </div>
      )}

      <div className="space-y-2">
        {route.steps.map((step, i) => (
          <div key={i} className="flex gap-2 items-start">
            <span className="text-base mt-0.5 shrink-0">
              {step.mode === 'WALKING' ? '🚶' : (VEHICLE_ICONS[step.vehicleType || ''] || '🚃')}
            </span>
            <div className="flex-1 min-w-0">
              {step.mode === 'TRANSIT' ? (
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {step.lineColor && (
                      <span
                        className="w-3 h-3 rounded-full shrink-0 inline-block"
                        style={{ backgroundColor: step.lineColor }}
                      />
                    )}
                    <span className="text-sm font-medium text-gray-800">
                      {step.lineName || step.lineShortName}
                    </span>
                    <span className="text-xs text-gray-500">({step.duration})</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {step.departureStop} → {step.arrivalStop}
                    {step.numStops ? ` · ${step.numStops}정거장` : ''}
                  </div>
                </div>
              ) : (
                <div>
                  <span className="text-sm text-gray-700">도보 {step.duration}</span>
                  {step.distance && <span className="text-xs text-gray-500 ml-1">({step.distance})</span>}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <a
        href={gmapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
      >
        {isYahooUrl ? 'Yahoo 路線情報에서 열기 →' : isNaverUrl ? 'Naver 지도에서 열기 →' : 'Google Maps에서 열기 →'}
      </a>
    </div>
  );
}
