import { NextRequest, NextResponse } from 'next/server';
import { TransitRoute, TransitStep } from '@/types';

const KNOWN_COORDS: Record<string, { lat: number; lng: number }> = {
  '김포국제공항': { lat: 37.5585, lng: 126.7942 },
  '인천국제공항': { lat: 37.4602, lng: 126.4407 },
  '인천공항':     { lat: 37.4602, lng: 126.4407 },
  '김포공항':     { lat: 37.5585, lng: 126.7942 },
};

type Coord = { lat: number; lng: number };

// 좌표(경도,위도)+이름 기반 네이버 길찾기 링크 (지도에서 열기 / 폴백용)
function naverTransitUrl(fromName: string, fromCoord: Coord | null, toName: string, toCoord: Coord | null): string {
  if (fromCoord && toCoord) {
    const s = `${fromCoord.lng},${fromCoord.lat},${encodeURIComponent(fromName)}`;
    const e = `${toCoord.lng},${toCoord.lat},${encodeURIComponent(toName)}`;
    return `https://map.naver.com/p/directions/${s}/${e}/-/transit`;
  }
  return `https://map.naver.com/p/search/${encodeURIComponent(toName)}`;
}

async function geocode(address: string): Promise<Coord | null> {
  const known = KNOWN_COORDS[address.trim()];
  if (known) return known;
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=kr`;
    const res = await fetch(url, { headers: { 'User-Agent': 'goTrip-app/1.0' }, cache: 'no-store' });
    const data = await res.json();
    if (!data?.length) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
}

// 지하철 노선명 → 노선 색상
function subwayColor(route?: string): string | undefined {
  if (!route) return undefined;
  const map: [string, string][] = [
    ['수인분당', '#FABE00'], ['신분당', '#D4003B'], ['경의중앙', '#77C4A3'], ['공항철도', '#0090D2'],
    ['1호선', '#0052A4'], ['2호선', '#009D3E'], ['3호선', '#EF7C1C'], ['4호선', '#00A5DE'],
    ['5호선', '#996CAC'], ['6호선', '#CD7C2F'], ['7호선', '#747F00'], ['8호선', '#E6186C'], ['9호선', '#BDB092'],
  ];
  for (const [k, c] of map) if (route.includes(k)) return c;
  return undefined;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildRoute(itin: any, naverUrl: string): TransitRoute {
  const steps: TransitStep[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const leg of (itin.legs || [])) {
    const mins = Math.round((leg.sectionTime || 0) / 60);

    if (leg.mode === 'WALK') {
      if (mins > 0 || (leg.distance || 0) > 0) {
        steps.push({
          mode: 'WALKING',
          instructions: leg.start?.name ? `${leg.start.name} 도보` : '도보',
          duration: `${mins}분`,
          distance: leg.distance > 0 ? `${leg.distance}m` : undefined,
        });
      }
    } else {
      const isBus = leg.mode === 'BUS';
      // passStopList.stationList 는 시·종점을 포함 → 정차역 수는 길이-1
      const stationCount = leg.passStopList?.stationList?.length;
      steps.push({
        mode: 'TRANSIT',
        lineName: isBus ? `${leg.route} 버스` : (leg.route || leg.mode),
        lineColor: isBus ? undefined : subwayColor(leg.route),
        vehicleType: leg.mode === 'BUS' ? 'BUS' : 'SUBWAY',
        departureStop: leg.start?.name,
        arrivalStop: leg.end?.name,
        numStops: stationCount ? Math.max(stationCount - 1, 1) : undefined,
        duration: `${mins}분`,
        distance: leg.distance ? `${Math.round(leg.distance / 100) / 10}km` : undefined,
      });
    }
  }

  const totalSec = itin.totalTime || 0;
  const totalMin = Math.round(totalSec / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const totalDuration = h > 0 ? `${h}시간 ${m}분` : `${m}분`;

  return {
    status: 'OK',
    totalDuration,
    totalDurationSeconds: totalSec,
    departureTime: '',
    arrivalTime: '',
    steps,
    googleMapsUrl: naverUrl,
  };
}

// 한국 대중교통 경로는 TMAP 대중교통 API로 조회한다.
// (appKey 헤더 인증 방식이라 IP 제한이 없어 Vercel 서버리스에서 동작)
export async function POST(req: NextRequest) {
  const { from, to, departureTimestamp } = await req.json();
  const appKey = process.env.TMAP_APP_KEY;

  const [fromCoord, toCoord] = await Promise.all([geocode(from), geocode(to)]);
  const naverUrl = naverTransitUrl(from, fromCoord, to, toCoord);

  // 키가 없거나 좌표를 못 구하면 네이버 길찾기 링크만 제공
  if (!appKey || !fromCoord || !toCoord) {
    return NextResponse.json({ status: 'LINK_ONLY', naverUrl });
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body: any = {
      startX: String(fromCoord.lng),
      startY: String(fromCoord.lat),
      endX: String(toCoord.lng),
      endY: String(toCoord.lat),
      count: 1,
      format: 'json',
      lang: 0,
    };
    if (departureTimestamp) {
      const kst = new Date(departureTimestamp * 1000 + 9 * 3600 * 1000);
      body.searchDttm =
        `${kst.getUTCFullYear()}${String(kst.getUTCMonth() + 1).padStart(2, '0')}${String(kst.getUTCDate()).padStart(2, '0')}` +
        `${String(kst.getUTCHours()).padStart(2, '0')}${String(kst.getUTCMinutes()).padStart(2, '0')}`;
    }

    const res = await fetch('https://apis.openapi.sk.com/transit/routes', {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json', appKey },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    const data = await res.json();

    const itin = data?.metaData?.plan?.itineraries?.[0];
    if (!itin) {
      console.error('[korea-transit] TMAP no itinerary:', JSON.stringify(data?.result || data?.error || data).slice(0, 300));
      return NextResponse.json({ status: 'LINK_ONLY', naverUrl });
    }

    return NextResponse.json(buildRoute(itin, naverUrl));
  } catch (e) {
    console.error('[korea-transit] TMAP error:', e);
    return NextResponse.json({ status: 'LINK_ONLY', naverUrl });
  }
}
