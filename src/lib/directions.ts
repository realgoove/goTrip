import { TransitRoute, TransitStep } from '@/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseGoogleResponse(data: any, googleMapsUrl: string): TransitRoute {
  if (data.status !== 'OK' || !data.routes?.length) {
    return { status: data.status || 'ERROR', totalDuration: '', totalDurationSeconds: 0, departureTime: '', arrivalTime: '', steps: [], googleMapsUrl };
  }

  const leg = data.routes[0].legs[0];
  const steps: TransitStep[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const step of leg.steps) {
    if (step.travel_mode === 'TRANSIT') {
      const td = step.transit_details;
      steps.push({
        mode: 'TRANSIT',
        lineName: td.line?.name,
        lineColor: td.line?.color,
        lineShortName: td.line?.short_name,
        vehicleType: td.line?.vehicle?.type,
        departureStop: td.departure_stop?.name,
        arrivalStop: td.arrival_stop?.name,
        numStops: td.num_stops,
        duration: step.duration?.text,
        departureTime: td.departure_time?.text,
        arrivalTime: td.arrival_time?.text,
      });
    } else if (step.travel_mode === 'WALKING') {
      steps.push({
        mode: 'WALKING',
        instructions: step.html_instructions?.replace(/<[^>]*>/g, ''),
        duration: step.duration?.text,
        distance: step.distance?.text,
      });
    }
  }

  return {
    status: 'OK',
    totalDuration: leg.duration?.text || '',
    totalDurationSeconds: leg.duration?.value || 0,
    departureTime: leg.departure_time?.text || '',
    arrivalTime: leg.arrival_time?.text || '',
    steps,
    googleMapsUrl,
  };
}

export async function getJapanTransitDirections(
  from: string,
  to: string,
  arrivalTimestamp: number
): Promise<TransitRoute> {
  const yahooUrl = `https://transit.yahoo.co.jp/search/result?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;

  try {
    const res = await fetch('/api/japan-transit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, arrivalTimestamp }),
    });
    const data = await res.json();
    if (data.status === 'OK') return data as TransitRoute;
    return { status: data.status || 'ERROR', totalDuration: '', totalDurationSeconds: 0, departureTime: '', arrivalTime: '', steps: [], googleMapsUrl: data.yahooUrl || yahooUrl };
  } catch {
    return { status: 'ERROR', totalDuration: '', totalDurationSeconds: 0, departureTime: '', arrivalTime: '', steps: [], googleMapsUrl: yahooUrl };
  }
}

export async function getJapanTransitDirectionsByDeparture(
  from: string,
  to: string,
  departureTimestamp: number
): Promise<TransitRoute> {
  const yahooUrl = `https://transit.yahoo.co.jp/search/result?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
  try {
    const res = await fetch('/api/japan-transit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, departureTimestamp }),
    });
    const data = await res.json();
    if (data.status === 'OK') return data as TransitRoute;
    return { status: data.status || 'ERROR', totalDuration: '', totalDurationSeconds: 0, departureTime: '', arrivalTime: '', steps: [], googleMapsUrl: data.yahooUrl || yahooUrl };
  } catch {
    return { status: 'ERROR', totalDuration: '', totalDurationSeconds: 0, departureTime: '', arrivalTime: '', steps: [], googleMapsUrl: yahooUrl };
  }
}

export async function getKoreaTransitDirections(
  from: string,
  to: string,
  departureTimestamp: number
): Promise<TransitRoute> {
  const naverUrl = `https://map.naver.com/v5/directions/-/-/transit?f=${encodeURIComponent(from)}&t=${encodeURIComponent(to)}`;

  try {
    const res = await fetch('/api/korea-transit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, departureTimestamp }),
    });
    const data = await res.json();
    if (data.status === 'OK') return data as TransitRoute;
    return { status: data.status || 'ERROR', totalDuration: '', totalDurationSeconds: 0, departureTime: '', arrivalTime: '', steps: [], googleMapsUrl: data.naverUrl || naverUrl };
  } catch {
    return { status: 'ERROR', totalDuration: '', totalDurationSeconds: 0, departureTime: '', arrivalTime: '', steps: [], googleMapsUrl: naverUrl };
  }
}

export async function getTransitDirections(
  origin: string,
  destination: string,
  options: { departureTime?: number; arrivalTime?: number; language?: string }
): Promise<TransitRoute> {
  const params = new URLSearchParams({ api: '1', origin, destination, travelmode: 'transit' });
  const googleMapsUrl = `https://www.google.com/maps/dir/?${params}`;

  try {
    const res = await fetch('/api/directions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ origin, destination, ...options }),
    });
    const data = await res.json();
    return parseGoogleResponse(data, googleMapsUrl);
  } catch {
    return { status: 'ERROR', totalDuration: '', totalDurationSeconds: 0, departureTime: '', arrivalTime: '', steps: [], googleMapsUrl };
  }
}
