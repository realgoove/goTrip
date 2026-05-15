import { ParsedFlight } from '@/types';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDisplayDate(dateISO: string): string {
  const [y, m, d] = dateISO.split('-');
  return `${parseInt(d)} ${MONTH_NAMES[parseInt(m) - 1]} ${y}`;
}

function minutesBetween(dep: string, arr: string): string {
  const [dh, dm] = dep.split(':').map(Number);
  const [ah, am] = arr.split(':').map(Number);
  let mins = (ah * 60 + am) - (dh * 60 + dm);
  if (mins < 0) mins += 24 * 60;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

interface Props {
  flight: ParsedFlight;
  airportArrivalTime: string;
}

export function FlightSegment({ flight, airportArrivalTime }: Props) {
  const duration = minutesBetween(flight.departureTime, flight.arrivalTime);

  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-700 rounded-2xl p-4 text-white">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">✈️</span>
          <div>
            <div className="text-xs text-slate-300">{flight.airlineName}</div>
            <div className="font-bold text-sm">{flight.airline} {flight.flightNumber}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-300">{flight.cabin}</div>
          <div className="text-xs text-slate-300">Ref: {flight.bookingRef}</div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-center">
          <div className="text-2xl font-bold">{flight.departureTime}</div>
          <div className="text-sm font-semibold">{flight.from.code}</div>
          <div className="text-xs text-slate-300">{flight.from.city}</div>
          {flight.from.terminal && (
            <div className="text-xs text-slate-400 mt-0.5">Terminal {flight.from.terminal}</div>
          )}
        </div>

        <div className="flex-1 px-3 text-center">
          <div className="text-xs text-slate-300">{duration}</div>
          <div className="border-t border-slate-500 my-1 relative">
            <span className="absolute right-0 -top-2 text-slate-400 text-xs">▶</span>
          </div>
          <div className="text-xs text-slate-300">{formatDisplayDate(flight.dateISO)}</div>
        </div>

        <div className="text-center">
          <div className="text-2xl font-bold">{flight.arrivalTime}</div>
          <div className="text-sm font-semibold">{flight.to.code}</div>
          <div className="text-xs text-slate-300">{flight.to.city}</div>
          {flight.to.terminal && (
            <div className="text-xs text-slate-400 mt-0.5">Terminal {flight.to.terminal}</div>
          )}
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-slate-600 flex items-center justify-between">
        <div className="text-xs text-slate-300">
          공항 도착 목표
          <span className="ml-2 text-yellow-300 font-semibold">{airportArrivalTime}</span>
          <span className="ml-1 text-slate-400">(출발 1.5시간 전)</span>
        </div>
      </div>
    </div>
  );
}
