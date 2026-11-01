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

// AI(/api/parse-itinerary)가 맥락으로 읽어낸 결과
export interface AIFlight {
  date: string;
  airline: string;
  flightNumber: string;
  cabin: string;
  fromCode: string;
  fromName: string;
  fromCountry: string;
  fromTerminal: string;
  toCode: string;
  toName: string;
  toCountry: string;
  toTerminal: string;
  departureTime: string;
  arrivalTime: string;
}

const MONTH_ABBR = Object.keys(MONTHS);

// IATA 코드로 공항 정보를 찾는다 — 등록된 공항이면 기존 이름(예: 'TOKYO HANEDA')을 써서 경로 로직과 맞춘다
function airportFromCode(code: string, name: string, country: string, terminal: string): AirportInfo {
  const upper = code.toUpperCase();
  const entry = Object.entries(AIRPORTS).find(([, a]) => a.code === upper);
  const info: AirportInfo = entry
    ? { name: entry[0], ...entry[1] }
    : { name: name.toUpperCase(), code: upper, address: `${name} Airport`, city: name, country };
  if (terminal) info.terminal = terminal;
  return info;
}

export function flightsFromAI(items: AIFlight[], bookingRef: string = ''): ParsedFlight[] {
  const flights: ParsedFlight[] = [];
  for (const f of items) {
    const dm = f.date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const dep = f.departureTime.match(/^(\d{1,2}):(\d{2})$/);
    const arr = f.arrivalTime.match(/^(\d{1,2}):(\d{2})$/);
    if (!dm || !dep || !arr) continue;

    const year = parseInt(dm[1]);
    const month = parseInt(dm[2]) - 1;
    const day = parseInt(dm[3]);
    const depStr = dep[1].padStart(2, '0') + dep[2];
    const arrStr = arr[1].padStart(2, '0') + arr[2];
    const airline = f.airline.toUpperCase();
    // 자정 넘어 도착하는 편은 다음 날로
    const arrDayOffset = arrStr < depStr ? 1 : 0;

    flights.push({
      date: `${String(day).padStart(2, '0')}${MONTH_ABBR[month]}`,
      year,
      dateISO: f.date,
      airline,
      airlineName: AIRLINE_NAMES[airline] || airline,
      flightNumber: f.flightNumber.toUpperCase().startsWith(airline)
        ? f.flightNumber.slice(airline.length).trim()
        : f.flightNumber,
      cabin: f.cabin.toUpperCase() || 'ECONOMY',
      from: airportFromCode(f.fromCode, f.fromName, f.fromCountry, f.fromTerminal),
      to: airportFromCode(f.toCode, f.toName, f.toCountry, f.toTerminal),
      departureTime: formatTime(depStr),
      arrivalTime: formatTime(arrStr),
      departureTimestamp: timeToTimestamp(day, month, year, depStr),
      arrivalTimestamp: timeToTimestamp(day + arrDayOffset, month, year, arrStr),
      bookingRef,
    });
  }
  return flights;
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
    // 편명(tokens[2])이 4자리(예: KE 2102)면 시각으로 오인되므로 그 다음 토큰부터 찾는다
    const timeIndices: number[] = [];
    for (let j = 3; j < tokens.length; j++) {
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
