import { NextRequest, NextResponse } from 'next/server';
import { TransitRoute, TransitStep } from '@/types';

const KNOWN_COORDS: Record<string, { lat: number; lng: number }> = {
  '김포국제공항': { lat: 37.5585, lng: 126.7942 },
  '인천국제공항': { lat: 37.4602, lng: 126.4407 },
  '인천공항':     { lat: 37.4602, lng: 126.4407 },
  '김포공항':     { lat: 37.5585, lng: 126.7942 },
};

type Coord = { lat: number; lng: number };

// 현재 네이버 지도 길찾기 표준 형식: 좌표(경도,위도)+이름으로 출발/도착을 정확히 지정
function naverTransitUrl(
  fromName: string,
  fromCoord: Coord | null,
  toName: string,
  toCoord: Coord | null,
): string {
  if (fromCoord && toCoord) {
    const s = `${fromCoord.lng},${fromCoord.lat},${encodeURIComponent(fromName)}`;
    const e = `${toCoord.lng},${toCoord.lat},${encodeURIComponent(toName)}`;
    return `https://map.naver.com/p/directions/${s}/${e}/-/transit`;
  }
  // 좌표를 못 구한 경우: 도착지 검색으로라도 안내
  return `https://map.naver.com/p/search/${encodeURIComponent(toName)}`;
}

async function geocode(address: string): Promise<{ lat: number; lng: number } | null> {
  const known = KNOWN_COORDS[address.trim()];
  if (known) return known;

  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=kr`;
  const res = await fetch(url, { headers: { 'User-Agent': 'goTrip-app/1.0' }, cache: 'no-store' });
  const data = await res.json();
  if (!data?.length) return null;
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildRoute(pathInfo: any, naverUrl: string): TransitRoute {
  const info = pathInfo.info;
  const steps: TransitStep[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const seg of (pathInfo.subPath || [])) {
    const type = seg.trafficType; // 1=subway, 2=bus, 3=walk

    if (type === 3) {
      if (seg.sectionTime > 0) {
        steps.push({
          mode: 'WALKING',
          instructions: seg.startName ? `${seg.startName} 도보` : '도보',
          duration: `${seg.sectionTime}분`,
          distance: seg.distance > 0 ? `${seg.distance}m` : undefined,
        });
      }
    } else if (type === 1) {
      const line = seg.lane?.[0];
      const lineColors: Record<number, string> = {
        1: '#0052A4', 2: '#009246', 3: '#EF7C1C', 4: '#00A5DE',
        5: '#996CAC', 6: '#CD7C2F', 7: '#747F00', 8: '#E6186C',
        9: '#BDB092', 21: '#6789CA', // 공항철도
        22: '#F5A200', // 경의중앙
      };
      const subwayCode = line?.subwayCode;
      steps.push({
        mode: 'TRANSIT',
        lineName: line?.name || `${subwayCode}호선`,
        lineColor: subwayCode ? lineColors[subwayCode] : undefined,
        vehicleType: 'SUBWAY',
        departureStop: seg.startName,
        arrivalStop: seg.endName,
        numStops: seg.stationCount,
        duration: `${seg.sectionTime}분`,
        distance: seg.distance ? `${Math.round(seg.distance / 1000 * 10) / 10}km` : undefined,
      });
    } else if (type === 2) {
      const lane = seg.lane?.[0];
      steps.push({
        mode: 'TRANSIT',
        lineName: lane?.busNo ? `${lane.busNo}번 버스` : '버스',
        vehicleType: 'BUS',
        departureStop: seg.startName,
        arrivalStop: seg.endName,
        numStops: seg.stationCount,
        duration: `${seg.sectionTime}분`,
      });
    }
  }

  const totalMin = info?.totalTime ?? 0;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const totalDuration = h > 0 ? `${h}시간 ${m}분` : `${m}분`;

  return {
    status: 'OK',
    totalDuration,
    totalDurationSeconds: totalMin * 60,
    departureTime: '',
    arrivalTime: '',
    steps,
    googleMapsUrl: naverUrl,
  };
}

export async function POST(req: NextRequest) {
  const { from, to, departureTimestamp } = await req.json();

  const apiKey = process.env.ODSAY_API_KEY;

  // 좌표 없이 만드는 임시 폴백 (geocode 실패 시 대비)
  let naverUrl = naverTransitUrl(from, null, to, null);

  if (!apiKey) {
    return NextResponse.json({ status: 'NO_API_KEY', naverUrl });
  }

  try {
    // 1. Geocode both addresses via Nominatim (free)
    const [fromCoord, toCoord] = await Promise.all([geocode(from), geocode(to)]);

    if (!fromCoord || !toCoord) {
      return NextResponse.json({ status: 'GEOCODE_FAILED', naverUrl });
    }

    // 좌표를 구했으니 정확한 좌표 기반 네이버 길찾기 URL로 교체
    naverUrl = naverTransitUrl(from, fromCoord, to, toCoord);

    // 2. Calculate departure time for ODsay (optional but improves accuracy)
    const date = departureTimestamp
      ? new Date(departureTimestamp * 1000)
      : new Date();
    const kst = new Date(date.getTime() + 9 * 3600 * 1000);
    const searchDTM = `${kst.getUTCFullYear()}${String(kst.getUTCMonth() + 1).padStart(2, '0')}${String(kst.getUTCDate()).padStart(2, '0')}${String(kst.getUTCHours()).padStart(2, '0')}${String(kst.getUTCMinutes()).padStart(2, '0')}`;

    // 3. Call ODsay API
    const params = new URLSearchParams({
      SX: String(fromCoord.lng),
      SY: String(fromCoord.lat),
      EX: String(toCoord.lng),
      EY: String(toCoord.lat),
      OPT: '0',
      SearchType: '0',
      SearchPathType: '1', // public transit only
      SearchDTM: searchDTM,
      apiKey,
    });

    const odsayRes = await fetch(`https://api.odsay.com/v1/api/searchPubTransPathT?${params}`);
    const odsayData = await odsayRes.json();

    const pathList = odsayData.result?.path ?? odsayData.result?.msgBody?.pathList;
    if (odsayData.error || !pathList?.length) {
      console.error('[korea-transit] ODsay error:', odsayData.error);
      return NextResponse.json({ status: 'ZERO_RESULTS', naverUrl });
    }

    const route = buildRoute(pathList[0], naverUrl);
    return NextResponse.json(route);
  } catch (e) {
    console.error('[korea-transit]', e);
    return NextResponse.json({ status: 'ERROR', naverUrl });
  }
}
