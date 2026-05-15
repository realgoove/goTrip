import { TripPlan, TransitRoute } from '@/types';

// ── utils (TripTimeline과 동일 로직) ─────────────────────────────────────────

function addMin(hhmm: string, mins: number): string {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const t = h * 60 + m + mins;
  return `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

function subMin(hhmm: string, mins: number): string {
  const [h, m] = hhmm.split(':').map(Number);
  const t = ((h * 60 + m - mins) % 1440 + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

function parseMins(s?: string | null): number {
  if (!s) return 0;
  const h = s.match(/(\d+)\s*(?:시간|時間)/)?.[1];
  const m = s.match(/(\d+)\s*(?:분|分)/)?.[1];
  return (h ? +h * 60 : 0) + (m ? +m : 0);
}

function diffMins(a: string, b: string): number {
  const [ah, am] = a.split(':').map(Number);
  const [bh, bm] = b.split(':').map(Number);
  return bh * 60 + bm - (ah * 60 + am);
}

// "15:13" → "15:13  " (7chars),  없으면 "       " (7chars)
function tp(t?: string | null) {
  return t ? `${t}  ` : '       ';
}

// ── Transit rows → text lines (buildRows 미러) ────────────────────────────────

function buildTransitLines(route: TransitRoute, startTime: string): string[] {
  const lines: string[] = [];
  let t = startTime;

  for (let i = 0; i < route.steps.length; i++) {
    const step = route.steps[i];
    const prev = route.steps[i - 1] ?? null;
    const next = route.steps[i + 1] ?? null;

    if (step.mode === 'WALKING') {
      const dist = step.distance ? ` · ${step.distance}` : '';
      lines.push(`       🚶 도보 ${step.duration}${dist}`);
      t = addMin(t, parseMins(step.duration));

    } else if (step.mode === 'TRANSIT') {
      const boardTime = step.departureTime || t;

      // 환승 갭
      if (prev?.mode === 'TRANSIT') {
        const prevArr = prev.arrivalTime || t;
        const gap = step.departureTime ? diffMins(prevArr, step.departureTime) : 0;
        if (gap > 0) lines.push(`       🔄 환승 ${gap}분`);
        t = boardTime;
      }

      // 승차역
      lines.push(`${tp(boardTime)}${step.departureStop || ''}`);
      if (step.departureTime) t = step.departureTime;

      // 노선 바 (duration이 없으면 departureTime/arrivalTime으로 계산)
      const lineParts = [step.lineName, step.lineShortName].filter(Boolean).join(' ');
      const stepDurStr = step.duration || (step.departureTime && step.arrivalTime
        ? `${diffMins(step.departureTime, step.arrivalTime)}분` : '');
      const dur = stepDurStr ? ` (${stepDurStr})` : '';
      const price = step.distance && !step.distance.includes('km') ? ` · ${step.distance}` : '';
      const stops = step.numStops ? ` · ${step.numStops}정거장` : '';
      lines.push(`       🚃 ${lineParts}${dur}${price}${stops}`);

      t = step.arrivalTime || addMin(t, parseMins(step.duration));

      // 하차역 (다음이 도보이거나 마지막)
      if (!next || next.mode === 'WALKING') {
        lines.push(`${tp(t)}${step.arrivalStop || ''}`);
      }
    }
  }

  return lines;
}

// ── Main export ───────────────────────────────────────────────────────────────

export function generateTimelineText(plan: TripPlan, bufferMins: number): string {
  const { flight, homeAddress, destAddress, departureRoute, arrivalRoute } = plan;
  const isJapanDep = flight.from.country === 'Japan';
  const lines: string[] = [];

  // Header
  const [y, mo, d] = flight.dateISO.split('-').map(Number);
  const dow = ['일', '월', '화', '수', '목', '금', '토'][new Date(y, mo - 1, d).getDay()];
  lines.push('✈️ goTrip 경로 안내');
  lines.push(`${flight.dateISO.replace(/-/g, '/')}(${dow}) ${flight.airline}${flight.flightNumber} ${flight.from.code}→${flight.to.code}`);
  lines.push('');

  // 시간 계산 (TripTimeline과 동일)
  const airportArriveTime = subMin(flight.departureTime, bufferMins);
  const korStartTime = addMin(flight.arrivalTime, 60);

  const routeDepartTime = (departureRoute?.status === 'OK' && departureRoute.departureTime)
    ? departureRoute.departureTime : null;
  const homeStopTime = routeDepartTime
    ?? (departureRoute?.totalDurationSeconds
      ? subMin(airportArriveTime, Math.ceil(departureRoute.totalDurationSeconds / 60))
      : subMin(airportArriveTime, 30));
  const leaveTime = subMin(homeStopTime, 15);

  // 배너
  lines.push(`⏰ ${isJapanDep ? '집' : '숙소'} 출발 권장: ${leaveTime} (여유 15분 포함)`);
  lines.push('');

  // 출발지
  lines.push(`${tp(homeStopTime)}🏠 ${homeAddress}`);

  // 출발 경로 (대중교통)
  if (departureRoute?.status === 'OK') {
    lines.push(...buildTransitLines(departureRoute, homeStopTime));
  }

  // 공항 이벤트 계산
  const lastDepArr = departureRoute?.steps
    .filter(s => s.mode === 'TRANSIT').at(-1)?.arrivalTime;
  const terminalArrival = lastDepArr ?? airportArriveTime;
  const ticketDone = addMin(terminalArrival, 20);
  const immigrationDone = addMin(terminalArrival, 50);

  lines.push(`       ── 보딩 티켓 발권 · 20분`);
  lines.push(`${tp(ticketDone)}🎫 발권 완료`);
  lines.push(`       ── 출국 심사 · 30분`);
  lines.push(`${tp(immigrationDone)}🛂 출국 심사 완료`);

  const fixedBoarding = subMin(flight.departureTime, 30);
  const [ibh, ibm] = immigrationDone.split(':').map(Number);
  const [fbh, fbm] = fixedBoarding.split(':').map(Number);
  const boardingTime = ibh * 60 + ibm + 5 > fbh * 60 + fbm
    ? addMin(immigrationDone, 5) : fixedBoarding;
  const gateWait = diffMins(immigrationDone, boardingTime);
  if (gateWait > 0) lines.push(`       ── 게이트 대기 · ${gateWait}분`);

  lines.push(`${tp(boardingTime)}🚪 탑승 시작`);
  const boardingWait = diffMins(boardingTime, flight.departureTime);
  if (boardingWait > 0) lines.push(`       ── 탑승 대기 · ${boardingWait}분`);

  lines.push(`${tp(flight.departureTime)}🛫 비행기 출발`);
  lines.push('');

  // 항공편 카드
  const [fdh, fdm] = flight.departureTime.split(':').map(Number);
  const [fah, fam] = flight.arrivalTime.split(':').map(Number);
  let flightMins = fah * 60 + fam - (fdh * 60 + fdm);
  if (flightMins < 0) flightMins += 1440;
  const flightDur = `${Math.floor(flightMins / 60)}h ${flightMins % 60}m`;
  lines.push(`${'─'.repeat(4)} ${flight.airline}${flight.flightNumber}  ${flight.from.code} ${flight.departureTime} → ${flight.to.code} ${flight.arrivalTime}  (${flightDur}) ${'─'.repeat(4)}`);
  lines.push('');

  // 도착 공항
  const arrAirportName =
    flight.to.name === 'SEOUL GIMPO' ? '김포국제공항'
    : flight.to.name === 'SEOUL INCHEON' ? '인천국제공항'
    : flight.to.name === 'TOKYO HANEDA' ? '羽田国際空港'
    : flight.to.name === 'TOKYO NARITA' ? '成田国際空港'
    : flight.to.name;

  lines.push(`${tp(flight.arrivalTime)}🛬 ${arrAirportName}`);
  lines.push(`       ── 입국심사 · 수하물 수령 · 약 30분`);
  lines.push(`${tp(addMin(flight.arrivalTime, 30))}🛃 출구 수속 완료`);

  // 도착 경로 (대중교통)
  if (arrivalRoute?.status === 'OK') {
    lines.push(...buildTransitLines(arrivalRoute, korStartTime));
  }

  // 목적지
  const korTotalMins = arrivalRoute?.totalDurationSeconds
    ? Math.ceil(arrivalRoute.totalDurationSeconds / 60)
    : parseMins(arrivalRoute?.totalDuration);
  const destArriveTime = korTotalMins ? addMin(korStartTime, korTotalMins) : '';
  lines.push(`${tp(destArriveTime)}📍 ${destAddress}`);

  return lines.join('\n');
}
