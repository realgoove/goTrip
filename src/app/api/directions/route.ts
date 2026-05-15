import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { origin, destination, departureTime, arrivalTime, language = 'ja' } = await req.json();

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ status: 'ERROR', error: 'No API key' }, { status: 500 });
  }

  const params = new URLSearchParams({ origin, destination, mode: 'transit', key: apiKey, language });
  if (departureTime) params.set('departure_time', String(departureTime));
  if (arrivalTime) params.set('arrival_time', String(arrivalTime));

  const url = `https://maps.googleapis.com/maps/api/directions/json?${params}`;
  const res = await fetch(url);
  const data = await res.json();

  // Log for debugging
  console.log('[Directions API]', {
    status: data.status,
    error_message: data.error_message,
    origin,
    destination,
  });

  return NextResponse.json(data);
}
