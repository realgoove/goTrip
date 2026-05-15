import { NextRequest, NextResponse } from 'next/server';
import { TransitRoute, TransitStep } from '@/types';

function extractNaviJson(html: string): object | null {
  const marker = '"naviSearchParam":';
  const idx = html.indexOf(marker);
  if (idx < 0) return null;

  const start = idx + marker.length;
  let depth = 0, i = start;
  for (; i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  try {
    return JSON.parse(html.slice(start, i));
  } catch {
    return null;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildRoute(featureInfo: any, yahooUrl: string): TransitRoute {
  const summary = featureInfo.summaryInfo;
  const edges = featureInfo.edgeInfoList;
  const steps: TransitStep[] = [];

  for (let i = 0; i < edges.length; i++) {
    const edge = edges[i];
    const { indexType, stationName, railName, destination, timeInfo, priceInfo, stopStationList } = edge;

    const getTime = (type: number) => timeInfo?.find((t: { time: string; type: number }) => t.type === type)?.time;

    if (indexType === 0) {
      // Start edge — may include a walk
      const walkMatch = (railName || '').match(/(\d+)分/);
      if (walkMatch) {
        steps.push({
          mode: 'WALKING',
          instructions: `${stationName} から 徒歩`,
          duration: `${walkMatch[1]}分`,
          departureTime: getTime(3) || getTime(1),
        });
      }
    } else if (indexType === 1) {
      // Each indexType=1 edge represents a boarding station.
      // type:2 = arrival at THIS station (end of previous leg / walk)
      // type:1 = departure from THIS station (start of this transit leg)
      // The arrival at the DESTINATION of this leg is in the NEXT edge's type:2 (or type:3 for final)
      const depTime = getTime(1);
      const nextEdge = edges[i + 1];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nextTime = (type: number) => nextEdge?.timeInfo?.find((t: any) => t.type === type)?.time;
      const arrTime = nextTime(2) || nextTime(3);
      const price = priceInfo?.price && priceInfo.price !== '0' ? `${priceInfo.price}円` : undefined;

      const lineName = (railName || '').replace(/・[^・]+行$/, '').trim();
      const dest = (railName || '').match(/・([^・]+行)$/)?.[1];

      steps.push({
        mode: 'TRANSIT',
        lineName: lineName || railName,
        lineShortName: dest ? `→ ${dest}` : (destination ? `→ ${destination}` : undefined),
        departureStop: stationName,
        arrivalStop: nextEdge?.stationName,
        numStops: stopStationList?.length ?? 0,
        duration: '',
        departureTime: depTime,
        arrivalTime: arrTime,
        distance: price,
      });
    }
  }

  return {
    status: 'OK',
    totalDuration: summary.totalTime,
    totalDurationSeconds: 0,
    departureTime: summary.departureTime,
    arrivalTime: summary.arrivalTime,
    steps,
    googleMapsUrl: yahooUrl,
  };
}

export async function POST(req: NextRequest) {
  const { from, to, arrivalTimestamp, departureTimestamp } = await req.json();
  const type = departureTimestamp ? '1' : '4';
  const timestamp = departureTimestamp ?? arrivalTimestamp ?? Math.floor(Date.now() / 1000);

  // Convert Unix timestamp to JST date parts
  const date = new Date(timestamp * 1000);
  const jst = new Date(date.getTime() + 9 * 3600 * 1000);

  const year = jst.getUTCFullYear();
  const month = String(jst.getUTCMonth() + 1).padStart(2, '0');
  const day = String(jst.getUTCDate()).padStart(2, '0');
  const hour = String(jst.getUTCHours()).padStart(2, '0');
  const min = jst.getUTCMinutes();
  const m1 = String(Math.floor(min / 10));
  const m2 = String(min % 10);

  const params = new URLSearchParams({ from, to, y: String(year), m: month, d: day, hh: hour, m1, m2, type });
  const yahooUrl = `https://transit.yahoo.co.jp/search/result?${params}`;

  try {
    const res = await fetch(yahooUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'ja,en;q=0.9',
      },
    });

    const html = await res.text();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const navi = extractNaviJson(html) as any;

    if (!navi?.featureInfoList?.length) {
      return NextResponse.json({ status: 'ZERO_RESULTS', yahooUrl });
    }

    const route = buildRoute(navi.featureInfoList[0], yahooUrl);
    return NextResponse.json(route);
  } catch (e) {
    console.error('[japan-transit]', e);
    return NextResponse.json({ status: 'ERROR', yahooUrl });
  }
}
