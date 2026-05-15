'use client';
import { TripPlan, TransitRoute } from '@/types';
import { ParsedFlight } from '@/types';

// ── utils ────────────────────────────────────────────────────────────────────

function parseMins(s?: string | null): number {
  if (!s) return 0;
  const h = s.match(/(\d+)\s*(?:시간|時間)/)?.[1];
  const m = s.match(/(\d+)\s*(?:분|分)/)?.[1];
  return (h ? +h * 60 : 0) + (m ? +m : 0);
}

function addMin(hhmm: string, mins: number): string {
  if (!hhmm) return hhmm;
  const [h, m] = hhmm.split(':').map(Number);
  const t = h * 60 + m + mins;
  return `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

function subMin(hhmm: string, mins: number): string {
  const [h, m] = hhmm.split(':').map(Number);
  const t = ((h * 60 + m - mins) % 1440 + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

function diffMins(a: string, b: string): number {
  const [ah, am] = a.split(':').map(Number);
  const [bh, bm] = b.split(':').map(Number);
  return bh * 60 + bm - (ah * 60 + am);
}

const VEH_ICON: Record<string, string> = {
  SUBWAY: '🚇', RAIL: '🚃', COMMUTER_TRAIN: '🚃', TRAM: '🚋',
  MONORAIL: '🚝', BUS: '🚌', FERRY: '⛴️',
};

// ── Row types ─────────────────────────────────────────────────────────────────

interface StopRow  { kind: 'stop'; time?: string; name: string; icon?: string; }
interface WalkRow  { kind: 'walk'; duration: string; distance?: string; isTransfer?: boolean; }
interface TransRow { kind: 'trans'; lineName?: string; lineColor?: string; direction?: string; duration?: string; numStops?: number; vehicleType?: string; extra?: string; }

type Row = StopRow | WalkRow | TransRow;

// ── Build rows from TransitRoute ──────────────────────────────────────────────

function buildRows(route: TransitRoute, startTime: string): Row[] {
  const rows: Row[] = [];
  let t = startTime;

  for (let i = 0; i < route.steps.length; i++) {
    const step = route.steps[i];
    const prev = route.steps[i - 1] ?? null;
    const next = route.steps[i + 1] ?? null;

    if (step.mode === 'WALKING') {
      rows.push({ kind: 'walk', duration: step.duration || '', distance: step.distance });
      t = addMin(t, parseMins(step.duration));
    } else if (step.mode === 'TRANSIT') {
      const boardTime = step.departureTime || t;

      // Transfer walk between two consecutive transit legs
      if (prev?.mode === 'TRANSIT') {
        const prevArr = prev.arrivalTime || t;
        const gap = step.departureTime ? diffMins(prevArr, step.departureTime) : 0;
        if (gap > 0) rows.push({ kind: 'walk', duration: `${gap}분`, isTransfer: true });
        t = boardTime;
      }

      // Boarding stop
      rows.push({ kind: 'stop', time: boardTime, name: step.departureStop || '' });
      if (step.departureTime) t = step.departureTime;

      // Transit bar
      const dur = step.duration ||
        (step.departureTime && step.arrivalTime
          ? `${diffMins(step.departureTime, step.arrivalTime)}分`
          : '');
      rows.push({
        kind: 'trans',
        lineName: step.lineName,
        lineColor: step.lineColor,
        direction: step.lineShortName,
        numStops: step.numStops,
        duration: dur,
        vehicleType: step.vehicleType,
        extra: step.distance,
      });

      t = step.arrivalTime || addMin(t, parseMins(step.duration));

      // Arrival stop only when next is walking or this is the last step
      if (!next || next.mode === 'WALKING') {
        rows.push({ kind: 'stop', time: t, name: step.arrivalStop || '' });
      }
    }
  }

  return rows;
}

// ── Connector primitives ──────────────────────────────────────────────────────

const COL_TIME = 'w-16 shrink-0 text-right pr-3';
const COL_CONN = 'w-6 shrink-0 flex flex-col items-center';
const COL_INFO = 'flex-1 min-w-0';

function ThinLine({ dashed, color }: { dashed?: boolean; color?: string }) {
  return (
    <div
      className="w-px flex-1"
      style={
        dashed
          ? { borderLeft: '2px dashed #E5E7EB', minHeight: '14px' }
          : { backgroundColor: color || '#E5E7EB', minHeight: '14px' }
      }
    />
  );
}

function ThickBar({ color }: { color?: string }) {
  return (
    <div
      className="w-2 rounded-full flex-1"
      style={{ backgroundColor: color || '#9CA3AF', minHeight: '48px' }}
    />
  );
}

// ── Stop row ─────────────────────────────────────────────────────────────────

function StopItem({ row, first, last }: { row: StopRow; first?: boolean; last?: boolean }) {
  const isPrimary = first || last;
  const isEvent = !isPrimary && !!row.icon;

  const dotStyle = isPrimary
    ? { width: 14, height: 14, borderColor: '#2563EB', backgroundColor: '#2563EB' }
    : isEvent
    ? { width: 12, height: 12, borderColor: '#F59E0B', backgroundColor: '#FEF3C7' }
    : { width: 9,  height: 9,  borderColor: '#D1D5DB', backgroundColor: '#F9FAFB' };

  return (
    <div className="flex items-center" style={{ minHeight: isPrimary ? 38 : isEvent ? 32 : 26 }}>
      <div className={`${COL_TIME} flex items-center justify-end`}>
        {row.time && (
          <span className={`font-mono leading-none tabular-nums ${
            isPrimary  ? 'text-sm font-bold text-gray-800' :
            isEvent    ? 'text-xs font-semibold text-gray-600' :
                         'text-[11px] text-gray-400'
          }`}>{row.time}</span>
        )}
      </div>
      <div className={COL_CONN}>
        <div className="rounded-full border-2 z-10 shrink-0"
          style={dotStyle} />
      </div>
      <div className={`${COL_INFO} pl-2 flex items-center gap-1.5`}>
        {row.icon && <span className={`leading-none shrink-0 ${isPrimary ? 'text-base' : 'text-sm'}`}>{row.icon}</span>}
        <span className={`leading-snug ${
          isPrimary ? 'text-sm font-bold text-gray-900' :
          isEvent   ? 'text-sm font-semibold text-gray-800' :
                      'text-sm text-gray-600'
        }`}>{row.name}</span>
      </div>
    </div>
  );
}

// ── Walk row ──────────────────────────────────────────────────────────────────

function WalkItem({ row }: { row: WalkRow }) {
  return (
    <div className="flex" style={{ minHeight: '28px' }}>
      <div className={COL_TIME} />
      <div className={COL_CONN}>
        <ThinLine dashed />
      </div>
      <div className={`${COL_INFO} pl-2 flex items-center`}>
        <span className="text-xs text-gray-500">
          {row.isTransfer ? '🔄 환승 ' : '🚶 도보 '}
          <span className="font-medium text-gray-600">{row.duration}</span>
          {row.distance && <span className="ml-1 text-gray-400">· {row.distance}</span>}
        </span>
      </div>
    </div>
  );
}

// ── Line number badge ─────────────────────────────────────────────────────────

function LineNumBadge({ lineName, lineColor }: { lineName?: string; lineColor?: string }) {
  if (!lineName) return null;
  // 숫자 호선 (1~9호선)
  const subwayNum = lineName.match(/(\d+)호선/)?.[1];
  if (subwayNum) return (
    <span
      className="inline-flex items-center justify-center w-6 h-6 rounded-full text-white font-bold shrink-0 text-xs"
      style={{ backgroundColor: lineColor || '#888' }}
    >{subwayNum}</span>
  );
  // 버스 번호 (145번 버스 → 145)
  const busNum = lineName.match(/^(\d+)번/)?.[1];
  if (busNum) return (
    <span
      className="inline-flex items-center justify-center px-1.5 h-5 rounded text-white font-bold shrink-0 text-[10px]"
      style={{ backgroundColor: lineColor || '#1D4ED8' }}
    >{busNum}</span>
  );
  // 공항철도
  if (lineName.includes('공항철도')) return (
    <span
      className="inline-flex items-center justify-center px-1.5 h-5 rounded text-white font-bold shrink-0 text-[9px]"
      style={{ backgroundColor: lineColor || '#6789CA' }}
    >공철</span>
  );
  // 경의중앙·분당·수인 등 광역선
  if (/경의|경춘|분당|수인|경강/.test(lineName)) return (
    <span
      className="inline-flex items-center justify-center px-1.5 h-5 rounded text-white font-bold shrink-0 text-[9px]"
      style={{ backgroundColor: lineColor || '#F5A200' }}
    >광역</span>
  );
  return null;
}

// ── Transit row ───────────────────────────────────────────────────────────────

function TransItem({ row }: { row: TransRow }) {
  const color = row.lineColor || '#9CA3AF';
  const icon = VEH_ICON[row.vehicleType || ''] || '🚃';
  return (
    <div className="flex" style={{ minHeight: '52px' }}>
      <div className={COL_TIME} />
      <div className={COL_CONN}>
        <ThickBar color={color} />
      </div>
      <div className={`${COL_INFO} pl-3 py-2`}>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm leading-none">{icon}</span>
          <LineNumBadge lineName={row.lineName} lineColor={color} />
          <span className="text-sm font-semibold text-gray-800 leading-snug">{row.lineName}</span>
          {row.direction && (
            <span className="text-xs text-gray-400 leading-snug">{row.direction}</span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap gap-x-2 items-center">
          {row.duration && (
            <span className="text-xs font-bold text-blue-600">{row.duration}</span>
          )}
          {row.extra && !row.extra.includes('km') && (
            <span className="text-xs text-gray-400">· {row.extra}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Thin connector ────────────────────────────────────────────────────────────

function ConnLine({ height = 20, dashed }: { height?: number; dashed?: boolean }) {
  return (
    <div className="flex">
      <div className={COL_TIME} />
      <div className={COL_CONN}>
        <ThinLine dashed={dashed} />
      </div>
      <div className={COL_INFO} style={{ minHeight: `${height}px` }} />
    </div>
  );
}

// ── Gap label (check-in, immigration) ────────────────────────────────────────

function GapLabel({ label, timeTo, duration }: { label: string; timeTo?: string; duration?: string }) {
  return (
    <div className="flex items-center" style={{ minHeight: '34px' }}>
      <div className={`${COL_TIME} flex items-center justify-end`}>
        {timeTo && <span className="text-[11px] font-mono text-gray-400">{timeTo}</span>}
      </div>
      <div className={COL_CONN}>
        <ThinLine dashed color="#FCD34D" />
      </div>
      <div className={`${COL_INFO} pl-2 flex items-center`}>
        <span className="inline-flex items-center gap-1 bg-amber-50 border border-amber-100 text-amber-700 text-[11px] font-medium px-2 py-0.5 rounded-full">
          {label}
          {duration && <span className="text-amber-400">· {duration}</span>}
        </span>
      </div>
    </div>
  );
}

// ── Flight inline card ────────────────────────────────────────────────────────

function FlightCard({ flight }: { flight: ParsedFlight }) {
  const [dh, dm] = flight.departureTime.split(':').map(Number);
  const [ah, am] = flight.arrivalTime.split(':').map(Number);
  let mins = ah * 60 + am - (dh * 60 + dm);
  if (mins < 0) mins += 24 * 60;
  const flightDur = mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;

  return (
    <div className="flex" style={{ minHeight: '80px' }}>
      <div className={`${COL_TIME} flex items-center justify-end`}>
        <span className="text-[11px] font-mono text-gray-400">{flight.departureTime}</span>
      </div>
      <div className={COL_CONN}>
        <div className="w-0.5 flex-1" style={{ backgroundColor: '#475569' }} />
      </div>
      <div className={`${COL_INFO} pl-2 py-1`}>
        <div className="bg-slate-800 text-white rounded-xl px-3 py-2.5">
          <div className="flex justify-between items-center mb-2">
            <div>
              <span className="text-xs font-bold">{flight.airline}{flight.flightNumber}</span>
              <span className="text-slate-400 text-[10px] ml-1.5">{flight.airlineName}</span>
            </div>
            <span className="text-slate-500 text-[10px]">{flight.dateISO.replace(/-/g, '.')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="text-center">
              <div className="text-base font-bold leading-none">{flight.departureTime}</div>
              <div className="text-slate-300 text-xs font-semibold mt-0.5">{flight.from.code}</div>
            </div>
            <div className="flex-1 text-center">
              <div className="text-slate-500 text-[10px]">{flightDur}</div>
              <div className="border-t border-slate-600 my-0.5 relative">
                <span className="absolute right-0 -top-2 text-slate-500 text-[10px]">▶</span>
              </div>
            </div>
            <div className="text-center">
              <div className="text-base font-bold leading-none">{flight.arrivalTime}</div>
              <div className="text-slate-300 text-xs font-semibold mt-0.5">{flight.to.code}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Fallback link row ─────────────────────────────────────────────────────────

function FallbackRow({ url, label }: { url: string; label: string }) {
  return (
    <div className="flex" style={{ minHeight: '40px' }}>
      <div className={COL_TIME} />
      <div className={COL_CONN}>
        <ThinLine dashed />
      </div>
      <div className={`${COL_INFO} pl-1.5 flex items-center`}>
        <a href={url} target="_blank" rel="noopener noreferrer"
          className="text-xs text-blue-500 underline">
          {label} →
        </a>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props { plan: TripPlan; loading: boolean; bufferMins?: number; }

export function TripTimeline({ plan, loading, bufferMins = 90 }: Props) {
  const { flight, homeAddress, destAddress, departureRoute, arrivalRoute } = plan;

  const airportArriveTime = subMin(flight.departureTime, bufferMins);
  const korStartTime = addMin(flight.arrivalTime, 60);

  const isJapanDep = flight.from.country === 'Japan';

  // Use actual route departure time (Yahoo type=4) or total duration (ODsay) to compute home departure
  const routeDepartTime = (departureRoute?.status === 'OK' && departureRoute.departureTime)
    ? departureRoute.departureTime : null;
  const homeStopTime = routeDepartTime
    ?? (departureRoute?.totalDurationSeconds
      ? subMin(airportArriveTime, Math.ceil(departureRoute.totalDurationSeconds / 60))
      : subMin(airportArriveTime, 30));
  const leaveTime = subMin(homeStopTime, 15);

  const korTotalMins = arrivalRoute?.totalDurationSeconds
    ? Math.ceil(arrivalRoute.totalDurationSeconds / 60)
    : parseMins(arrivalRoute?.totalDuration);
  const destArriveTime = korTotalMins ? addMin(korStartTime, korTotalMins) : undefined;

  const japRows = departureRoute?.status === 'OK'
    ? buildRows(departureRoute, homeStopTime)
    : [];

  const korRows = arrivalRoute?.status === 'OK'
    ? buildRows(arrivalRoute, korStartTime)
    : [];

  // Airport processing times: calculated forward from actual transit arrival
  const lastJapStopTime = (japRows.filter(r => r.kind === 'stop' && (r as StopRow).time) as StopRow[]).at(-1)?.time;
  const airportTerminalArrival = lastJapStopTime ?? airportArriveTime;

  // Split japRows: if the last row is a stop (terminal arrival), pull it into the airport group
  const japLastIsStop = departureRoute?.status === 'OK' && japRows.length > 0 && japRows.at(-1)!.kind === 'stop';
  const japRowsMain  = japLastIsStop ? japRows.slice(0, -1) : japRows;
  const terminalStopFromRoute: StopRow | null = japLastIsStop
    ? { ...(japRows.at(-1) as StopRow), icon: '✈️' }
    : null;

  // Departure airport display name (for fallback or when no terminal stop in route)
  const depAirportDisplayName = isJapanDep
    ? (flight.from.terminal
        ? `羽田空港第${flight.from.terminal}ターミナル`
        : flight.from.name === 'TOKYO HANEDA' ? '羽田空港第3ターミナル'
        : flight.from.name === 'TOKYO NARITA' ? '成田空港'
        : flight.from.address)
    : flight.from.name === 'SEOUL GIMPO' ? '김포국제공항' : '인천국제공항';
  const ticketDoneTime = addMin(airportTerminalArrival, 20);
  const immigrationDoneTime = addMin(airportTerminalArrival, 50);

  // Boarding start: 30 min before departure, but never before immigration is done
  const fixedBoardingTime = subMin(flight.departureTime, 30);
  const [ibh, ibm] = immigrationDoneTime.split(':').map(Number);
  const [fbh, fbm] = fixedBoardingTime.split(':').map(Number);
  const boardingTime = ibh * 60 + ibm + 5 > fbh * 60 + fbm
    ? addMin(immigrationDoneTime, 5)
    : fixedBoardingTime;
  const gateWaitMins = diffMins(immigrationDoneTime, boardingTime);

  if (loading) {
    return (
      <div className="space-y-2 animate-pulse">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="h-8 bg-gray-100 rounded-lg" />
        ))}
      </div>
    );
  }

  // Arrival airport display name
  const arrAirportName =
    flight.to.name === 'SEOUL GIMPO' ? '김포국제공항'
    : flight.to.name === 'SEOUL INCHEON' ? '인천국제공항'
    : flight.to.name === 'TOKYO HANEDA' ? '羽田国際空港'
    : flight.to.name === 'TOKYO NARITA' ? '成田国際空港'
    : flight.to.name;

  // Fallback URLs — departure leg and arrival leg swap by direction
  const depFallback = departureRoute?.googleMapsUrl || (isJapanDep
    ? `https://transit.yahoo.co.jp/search/result?from=${encodeURIComponent(homeAddress)}&to=${encodeURIComponent(flight.from.address)}`
    : `https://map.naver.com/v5/directions/-/-/transit`);
  const arrFallback = arrivalRoute?.googleMapsUrl || (isJapanDep
    ? `https://map.naver.com/v5/directions/-/-/transit`
    : `https://transit.yahoo.co.jp/search/result?from=${encodeURIComponent(flight.to.address)}&to=${encodeURIComponent(destAddress)}`);

  return (
    <div>
      {/* Suggested departure banner */}
      <div className="flex items-center gap-3 mb-5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
        <span className="text-xl shrink-0">⏰</span>
        <div>
          <p className="text-xs text-amber-600 font-medium">{isJapanDep ? '집' : '숙소'} 출발 권장 시간</p>
          <p className="text-xl font-bold text-amber-900 leading-none mt-0.5">{leaveTime}
            <span className="text-xs font-normal text-amber-500 ml-1.5">여유 15분 포함</span>
          </p>
        </div>
      </div>

      {/* ── ORIGIN ────────────────────────────────────────────────────────── */}
      <StopItem row={{ kind: 'stop', time: homeStopTime, name: homeAddress, icon: '🏠' }} first />

      {/* ── DEPARTURE LEG (transit, terminal stop excluded → goes into airport group) ── */}
      {departureRoute?.status === 'OK' ? (
        japRowsMain.map((row, i) => {
          if (row.kind === 'stop')  return <StopItem  key={i} row={row} />;
          if (row.kind === 'walk')  return <WalkItem  key={i} row={row} />;
          if (row.kind === 'trans') return <TransItem key={i} row={row} />;
        })
      ) : (
        <FallbackRow url={depFallback} label={isJapanDep ? 'Yahoo 路線情報에서 경로 확인' : 'Naver 지도에서 경로 확인'} />
      )}

      {/* ── AIRPORT GROUP: terminal arrival → 비행기 출발 ─────────────────── */}
      <div className="rounded-2xl border border-sky-100 bg-sky-50/50 mt-2 mb-2 py-1 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-2 pb-1.5 border-b border-sky-100 mb-1">
          <span className="text-[11px] font-bold tracking-wider text-sky-500">✈ 공항 수속 구간</span>
          <span className="text-[11px] tabular-nums font-medium text-sky-400">
            {diffMins(airportTerminalArrival, flight.departureTime)}분
          </span>
        </div>

        {/* Terminal arrival stop */}
        {terminalStopFromRoute ? (
          <StopItem row={terminalStopFromRoute} />
        ) : (
          <StopItem row={{ kind: 'stop', time: airportTerminalArrival, name: depAirportDisplayName, icon: '✈️' }} />
        )}

        <GapLabel label="보딩 티켓 발권" duration="20분" />
        <StopItem row={{ kind: 'stop', time: ticketDoneTime, name: '발권 완료', icon: '🎫' }} />
        <GapLabel label="출국 심사" duration="30분" />
        <StopItem row={{ kind: 'stop', time: immigrationDoneTime, name: '출국 심사 완료', icon: '🛂' }} />
        {gateWaitMins > 0 && (
          <GapLabel label="게이트 대기" duration={`${gateWaitMins}분`} />
        )}
        <StopItem row={{ kind: 'stop', time: boardingTime, name: '탑승 시작', icon: '🚪' }} />
        {diffMins(boardingTime, flight.departureTime) > 0 && (
          <GapLabel label="탑승 대기" duration={`${diffMins(boardingTime, flight.departureTime)}분`} />
        )}
        <StopItem row={{ kind: 'stop', time: flight.departureTime, name: '비행기 출발', icon: '🛫' }} />
      </div>

      {/* ── FLIGHT CARD ───────────────────────────────────────────────────── */}
      <FlightCard flight={flight} />

      {/* ── ARRIVAL AIRPORT ───────────────────────────────────────────────── */}
      <StopItem row={{ kind: 'stop', time: flight.arrivalTime, name: arrAirportName, icon: '🛬' }} />
      <GapLabel label="입국심사 · 수하물 수령" duration="약 30분" />

      {/* ── EXIT PROCEDURES (~30min) ──────────────────────────────────────── */}
      <StopItem row={{ kind: 'stop', time: addMin(flight.arrivalTime, 30), name: '출구 수속 완료', icon: '🛃' }} />

      {/* ── KOREA LEG (directly after exit) ──────────────────────────────── */}
      {arrivalRoute?.status === 'OK' ? (
        korRows.map((row, i) => {
          if (row.kind === 'stop')  return <StopItem  key={i} row={row} />;
          if (row.kind === 'walk')  return <WalkItem  key={i} row={row} />;
          if (row.kind === 'trans') return <TransItem key={i} row={row} />;
        })
      ) : (
        <FallbackRow url={arrFallback} label={isJapanDep ? 'Naver 지도에서 경로 확인' : 'Yahoo 路線情報에서 경로 확인'} />
      )}

      {/* ── DESTINATION ──────────────────────────────────────────────────── */}
      <StopItem
        row={{ kind: 'stop', time: destArriveTime, name: destAddress, icon: '📍' }}
        last
      />
    </div>
  );
}
