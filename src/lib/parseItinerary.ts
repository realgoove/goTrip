import { ParsedFlight, AirportInfo } from '@/types';
import { AIRPORTS, AIRLINE_NAMES } from './airports';

const MONTHS: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

function formatTime(timeStr: string): string {
  return `${timeStr.slice(0, 2)}:${timeStr.slice(2)}`;
}

function timeToTimestamp(day: number, month: number, year: number, timeStr: string): number {
  const hour = parseInt(timeStr.slice(0, 2));
  const min = parseInt(timeStr.slice(2));
  // JST/KST = UTC+9
  const date = new Date(Date.UTC(year, month, day, hour - 9, min));
  return Math.floor(date.getTime() / 1000);
}

function findAirportsInTokens(tokens: string[]): { from: AirportInfo; to: AirportInfo } | null {
  type Found = { name: string; startIdx: number; endIdx: number };
  const found: Found[] = [];

  for (let len = 3; len >= 1; len--) {
    for (let i = 0; i <= tokens.length - len; i++) {
      const name = tokens.slice(i, i + len).join(' ');
      if (AIRPORTS[name]) {
        const overlaps = found.some(f => !(i >= f.endIdx || i + len <= f.startIdx));
        if (!overlaps) {
          found.push({ name, startIdx: i, endIdx: i + len });
        }
      }
    }
  }

  if (found.length < 2) return null;
  found.sort((a, b) => a.startIdx - b.startIdx);

  const fromData = AIRPORTS[found[0].name];
  const toData = AIRPORTS[found[1].name];

  return {
    from: {
      name: found[0].name,
      code: fromData.code,
      address: fromData.address,
      city: fromData.city,
      country: fromData.country,
    },
    to: {
      name: found[1].name,
      code: toData.code,
      address: toData.address,
      city: toData.city,
      country: toData.country,
    },
  };
}

export function parseItinerary(text: string, targetYear: number = 2026): ParsedFlight[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const flights: ParsedFlight[] = [];

  const bookingRefMatch = text.match(/BOOKING REFERENCE[^：:]*[：:]\s*([A-Z0-9]+)/i);
  const bookingRef = bookingRefMatch ? bookingRefMatch[1] : '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const tokens = line.split(/\s+/);

    // Flight lines start with a date like "13Jun" (mixed case)
    if (!/^\d{2}[A-Za-z]{3}$/.test(tokens[0])) continue;
    if (tokens.length < 8) continue;

    // Find 4-digit time tokens (HHMM format)
    const timeIndices: number[] = [];
    for (let j = 0; j < tokens.length; j++) {
      if (/^\d{4}$/.test(tokens[j]) && parseInt(tokens[j]) <= 2359) {
        timeIndices.push(j);
      }
    }
    if (timeIndices.length < 2) continue;

    const depTimeIdx = timeIndices[0];
    const arrTimeIdx = timeIndices[1];

    const dateStr = tokens[0];
    const airline = tokens[1];
    const flightNum = tokens[2];
    const cabinIdx = tokens.findIndex(t => ['ECONOMY', 'BUSINESS', 'FIRST', 'PREMIUM'].includes(t));
    const cabin = cabinIdx >= 0 ? tokens[cabinIdx] : 'ECONOMY';
    const airportStart = cabinIdx >= 0 ? cabinIdx + 1 : 5;

    const airportTokens = tokens.slice(airportStart, depTimeIdx);
    const airports = findAirportsInTokens(airportTokens);
    if (!airports) continue;

    const day = parseInt(dateStr.slice(0, 2));
    const rawMonth = dateStr.slice(2);
    const monthStr = rawMonth.charAt(0).toUpperCase() + rawMonth.slice(1).toLowerCase();
    const month = MONTHS[monthStr] ?? 0;
    const dateISO = `${targetYear}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    // Check next line for terminal info
    const nextLine = lines[i + 1] || '';
    const terminalMatch = nextLine.match(/TERMINAL\s+(\S+)\s+TERMINAL\s+(\S+)/i);
    if (terminalMatch) {
      airports.from.terminal = terminalMatch[1];
      airports.to.terminal = terminalMatch[2];
    }

    const depTimeStr = tokens[depTimeIdx];
    const arrTimeStr = tokens[arrTimeIdx];

    flights.push({
      date: dateStr,
      year: targetYear,
      dateISO,
      airline,
      airlineName: AIRLINE_NAMES[airline] || airline,
      flightNumber: flightNum,
      cabin,
      from: airports.from,
      to: airports.to,
      departureTime: formatTime(depTimeStr),
      arrivalTime: formatTime(arrTimeStr),
      departureTimestamp: timeToTimestamp(day, month, targetYear, depTimeStr),
      arrivalTimestamp: timeToTimestamp(day, month, targetYear, arrTimeStr),
      bookingRef,
    });
  }

  return flights;
}
