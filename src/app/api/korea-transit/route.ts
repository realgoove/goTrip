import { NextRequest, NextResponse } from 'next/server';

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

// 한국 대중교통은 ODsay 대신 좌표 기반 네이버 지도 길찾기 링크만 제공한다.
// (ODsay 서버키는 고정 IP에서만 동작하는데 Vercel 서버는 IP가 동적이라 사용 불가)
export async function POST(req: NextRequest) {
  const { from, to } = await req.json();

  // 출발/도착 좌표를 구해 네이버 길찾기에 정확히 핀이 찍히도록 한다.
  const [fromCoord, toCoord] = await Promise.all([geocode(from), geocode(to)]);
  const naverUrl = naverTransitUrl(from, fromCoord, to, toCoord);

  return NextResponse.json({ status: 'LINK_ONLY', naverUrl });
}
