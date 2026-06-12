'use client';
import { useEffect, useRef, useState } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { FlightInputForm } from '@/components/FlightInputForm';
import { TripTimeline } from '@/components/TripTimeline';
import { SearchHistory } from '@/components/SearchHistory';
import { parseItinerary } from '@/lib/parseItinerary';
import { getJapanTransitDirections, getJapanTransitDirectionsByDeparture, getKoreaTransitDirections } from '@/lib/directions';
import { TripPlan, ParsedFlight } from '@/types';
import { useHistory, SavedSearch } from '@/hooks/useHistory';
import { generateTimelineText } from '@/lib/formatTimeline';

function subtractMinutes(time: string, minutes: number): number {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m - minutes;
  return ((total % 1440) + 1440) % 1440;
}

function addMinutes(time: string, minutes: number): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m + minutes;
}

function minsToTimestamp(dateISO: string, totalMins: number): number {
  const [y, mo, d] = dateISO.split('-').map(Number);
  const h = Math.floor(totalMins / 60) % 24;
  const m = totalMins % 60;
  return Math.floor(new Date(Date.UTC(y, mo - 1, d, h - 9, m)).getTime() / 1000);
}

export default function Home() {
  const { data: session, status } = useSession();
  const [itinerary, setItinerary] = useState('');
  const [plan, setPlan] = useState<TripPlan | null>(null);
  // 항공편 인덱스별 경로 캐시 — 한 번 검색하면 보관해 재검색을 막는다
  const [plans, setPlans] = useState<(TripPlan | null)[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsedFlights, setParsedFlights] = useState<ParsedFlight[]>([]);
  const [selectedFlight, setSelectedFlight] = useState(0);
  const [homeAddress, setHomeAddress] = useState('');
  const [destAddress, setDestAddress] = useState('');
  const [bufferMins, setBufferMins] = useState(90);

  const lastItineraryRef = useRef('');
  const initedRef = useRef(false);

  const historyHook = useHistory(!!session);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  // 경로 계산만 수행하는 순수 함수 (setState 부작용 없음)
  async function computeRoute(flights: ParsedFlight[], idx: number, home: string, dest: string, buffer: number): Promise<TripPlan> {
    const flight = flights[idx];
    const isJapanDep = flight.from.country === 'Japan';
    const originAddr = isJapanDep ? home : dest;
    const destinAddr = isJapanDep ? dest : home;

    const airportArrivalMins = subtractMinutes(flight.departureTime, buffer);
    const airportDepMins = addMinutes(flight.arrivalTime, 60);

    let depRoute, arrRoute;

    if (isJapanDep) {
      // 출국편: 집(일본) → 일본공항 → 한국공항 → 목적지(한국)
      const japanAirport = flight.from.terminal
        ? `羽田空港第${flight.from.terminal}ターミナル`
        : flight.from.name === 'TOKYO HANEDA' ? '羽田空港第3ターミナル'
        : flight.from.name === 'TOKYO NARITA' ? '成田空港'
        : flight.from.address;
      const koreaAirport = flight.to.name === 'SEOUL GIMPO' ? '김포국제공항' : '인천국제공항';

      [depRoute, arrRoute] = await Promise.all([
        getJapanTransitDirections(home, japanAirport, minsToTimestamp(flight.dateISO, airportArrivalMins)),
        getKoreaTransitDirections(koreaAirport, dest, minsToTimestamp(flight.dateISO, airportDepMins)),
      ]);
    } else {
      // 귀국편: 숙소(한국) → 한국공항 → 일본공항 → 집(일본)
      const koreaAirport = flight.from.name === 'SEOUL GIMPO' ? '김포국제공항' : '인천국제공항';
      const japanAirport = flight.to.terminal
        ? `羽田空港第${flight.to.terminal}ターミナル`
        : flight.to.name === 'TOKYO HANEDA' ? '羽田空港第3ターミナル'
        : flight.to.name === 'TOKYO NARITA' ? '成田空港'
        : flight.to.address;

      [depRoute, arrRoute] = await Promise.all([
        getKoreaTransitDirections(dest, koreaAirport, minsToTimestamp(flight.dateISO, airportArrivalMins - 90)),
        getJapanTransitDirectionsByDeparture(japanAirport, home, minsToTimestamp(flight.dateISO, airportDepMins)),
      ]);
    }

    return { homeAddress: originAddr, destAddress: destinAddr, flight, departureRoute: depRoute, arrivalRoute: arrRoute };
  }

  // 검색 버튼: 왕복(모든 항공편) 경로를 한 번에 검색해 캐시에 채운다
  async function handleSubmit(itin: string) {
    setError(null);
    const flights = parseItinerary(itin);
    if (!flights.length) {
      setError('항공편 정보를 파싱하지 못했습니다. 입력된 텍스트를 확인해 주세요.');
      return;
    }
    lastItineraryRef.current = itin;
    setParsedFlights(flights);
    setSelectedFlight(0);
    setLoading(true);
    try {
      const results = await Promise.all(
        flights.map((_, i) => computeRoute(flights, i, homeAddress, destAddress, bufferMins))
      );
      setPlans(results);
      setPlan(results[0]);
    } catch (e) {
      console.error('[handleSubmit] route search failed:', e);
      setError('경로 검색 중 오류가 발생했습니다. 다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!parsedFlights.length) {
      setError('저장할 항공편 정보가 없습니다. 먼저 경로를 검색해 주세요.');
      return;
    }
    // 왕복 양쪽을 모두 저장 — 아직 계산되지 않은 항공편이 있으면 이때 마저 검색해 채운다
    let allPlans = plans;
    if (allPlans.filter(Boolean).length < parsedFlights.length) {
      setLoading(true);
      try {
        allPlans = await Promise.all(
          parsedFlights.map((_, i) => plans[i] ?? computeRoute(parsedFlights, i, homeAddress, destAddress, bufferMins))
        );
        setPlans(allPlans);
      } catch (e) {
        console.error('[handleSave] compute failed:', e);
        setError('저장 전 경로 계산에 실패했습니다.');
        setLoading(false);
        return;
      }
      setLoading(false);
    }

    const outbound = parsedFlights.find(f => f.from.country === 'Japan') ?? parsedFlights[0];
    const ret = parsedFlights.find(f => f.from.country === 'South Korea');
    const fromLabel = outbound.from.country === 'Japan' ? '일본' : '한국';
    const toLabel = outbound.to.country === 'South Korea' ? '한국' : '일본';
    try {
      await historyHook.save({
        flightDateISO: outbound.dateISO,
        returnDateISO: ret?.dateISO,
        label: `${fromLabel}-${toLabel}`,
        itinerary: lastItineraryRef.current,
        homeAddress,
        destAddress,
        bufferMins,
        // 왕복 모든 항공편의 경로를 함께 저장 → 이력/항공편 전환 시 재검색 없이 복원
        plans: allPlans as TripPlan[],
        selectedFlight,
        parsedFlights,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error('[handleSave] failed:', e);
      setError('저장에 실패했습니다. 다시 시도해 주세요.');
    }
  }

  async function handleCopy() {
    if (!plan) return;
    const text = generateTimelineText(plan, bufferMins);
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleSelectHistory(s: SavedSearch) {
    setItinerary(s.itinerary);
    setHomeAddress(s.homeAddress);
    setDestAddress(s.destAddress);
    setBufferMins(s.bufferMins);
    setError(null);
    lastItineraryRef.current = s.itinerary;
    const flights = s.parsedFlights ?? parseItinerary(s.itinerary);
    const idx = s.selectedFlight ?? 0;

    if (s.plans && s.plans.length) {
      // 왕복 모든 경로를 그대로 복원 — 재검색하지 않는다 (항공편 전환도 캐시 사용)
      setParsedFlights(flights);
      setPlans(s.plans);
      setSelectedFlight(idx);
      setPlan(s.plans[idx] ?? s.plans[0] ?? null);
    } else if (s.plan) {
      // 단일 경로만 저장된 옛 이력 → 해당 편만 복원
      setParsedFlights(flights);
      setPlans(flights.map((_, i) => (i === idx ? s.plan! : null)));
      setSelectedFlight(idx);
      setPlan(s.plan);
    } else {
      // 경로가 저장되지 않은 아주 옛 이력 → 입력만 채우고 검색 버튼을 누르도록 안내
      setParsedFlights(flights);
      setPlans([]);
      setSelectedFlight(0);
      setPlan(null);
      setError('이 기록에는 저장된 경로가 없습니다. "경로 검색"을 눌러 주세요.');
    }
  }

  // (자동 재검색 제거됨) 주소·버퍼를 바꿔도 자동 검색하지 않는다.
  // 새 검색은 오직 "경로 검색" 버튼(handleSubmit)으로만 수행해 TMAP 호출을 아낀다.

  // 로그인 후 이력이 로드되면 "경로가 저장된" 가장 최근 기록을 자동 표시 (재검색 없음)
  useEffect(() => {
    if (initedRef.current || !session) return;
    if (historyHook.history.length === 0) return;
    initedRef.current = true;
    const withRoute = historyHook.history.find(h => (h.plans && h.plans.length) || h.plan);
    if (withRoute) handleSelectHistory(withRoute);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyHook.history, session]);

  if (status === 'loading') {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400 text-sm">불러오는 중…</p>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900">✈️ goTrip</h1>
          <p className="text-gray-500 text-sm mt-2 mb-8">
            비행 정보로 이동 경로를 자동 생성합니다.<br />
            로그인 후 이용해 주세요.
          </p>
          <button
            onClick={() => signIn('google')}
            className="w-full flex items-center justify-center gap-2 text-sm bg-white border border-gray-200 rounded-xl px-4 py-3 hover:bg-gray-50 shadow-sm text-gray-700 font-medium"
          >
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Google 로그인
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">✈️ goTrip</h1>
            <p className="text-gray-500 text-sm mt-1">비행 정보로 이동 경로를 자동 생성</p>
          </div>
          {session ? (
            <div className="flex items-center gap-2">
              {session.user?.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={session.user.image} alt="" className="w-8 h-8 rounded-full" />
              )}
              <div className="text-right">
                <p className="text-xs font-medium text-gray-700 leading-tight">{session.user?.name}</p>
                <button onClick={() => signOut()} className="text-[11px] text-gray-400 hover:text-gray-600">
                  로그아웃
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => signIn('google')}
              className="flex items-center gap-1.5 text-xs bg-white border border-gray-200 rounded-xl px-3 py-2 hover:bg-gray-50 shadow-sm text-gray-700"
            >
              <svg width="14" height="14" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Google 로그인
            </button>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
          <FlightInputForm
            onSubmit={handleSubmit}
            itinerary={itinerary}
            onItineraryChange={setItinerary}
            homeAddress={homeAddress}
            destAddress={destAddress}
            onHomeAddressChange={setHomeAddress}
            onDestAddressChange={setDestAddress}
            bufferMins={bufferMins}
            onBufferMinsChange={setBufferMins}
            departureTime={parsedFlights[selectedFlight]?.departureTime}
            loading={loading}
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-sm text-red-700">
            {error}
          </div>
        )}

        {parsedFlights.length > 1 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4">
            <p className="text-xs font-semibold text-gray-600 mb-2">항공편 선택</p>
            <div className="flex flex-wrap gap-2">
              {parsedFlights.map((f, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setSelectedFlight(i);
                    // 캐시된 경로를 표시 — 재검색하지 않는다 (검색 버튼으로 이미 왕복 모두 계산됨)
                    if (plans[i]) setPlan(plans[i]!);
                  }}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    selectedFlight === i
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-blue-400'
                  }`}
                >
                  {(() => { const [y,m,d]=f.dateISO.split('-').map(Number); const dow=['일','월','화','수','목','금','토'][new Date(y,m-1,d).getDay()]; return `${f.dateISO.replace(/-/g,'/')}(${dow})`; })()} {f.airline}{f.flightNumber} {f.from.code}→{f.to.code}
                </button>
              ))}
            </div>
          </div>
        )}

        {plan && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-700">이동 경로</h2>
              <div className="flex items-center gap-2">
                {!loading && (
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1 text-xs bg-gray-50 text-gray-600 border border-gray-200 px-3 py-1.5 rounded-xl hover:bg-gray-100 transition-colors"
                  >
                    {copied ? '✅ 복사됨' : '📋 복사'}
                  </button>
                )}
                {session && !loading && (
                  <button
                    onClick={handleSave}
                    className="flex items-center gap-1 text-xs bg-green-50 text-green-700 border border-green-200 px-3 py-1.5 rounded-xl hover:bg-green-100 transition-colors"
                  >
                    {saved ? '✅ 저장됨' : '💾 저장'}
                  </button>
                )}
              </div>
            </div>
            <TripTimeline plan={plan} loading={loading} bufferMins={bufferMins} />
          </div>
        )}

        {session && (
          <SearchHistory
            history={historyHook.history}
            onSelect={handleSelectHistory}
            onDelete={historyHook.remove}
          />
        )}
      </div>
    </main>
  );
}
