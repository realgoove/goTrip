import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// 형식에 의존하지 않고 e티켓 텍스트의 맥락을 읽어 항공편을 구조화한다
const RECORD_FLIGHTS_TOOL: Anthropic.Tool = {
  name: 'record_flights',
  description: 'e티켓/예약 확인서에서 읽어낸 항공편 목록을 기록한다.',
  input_schema: {
    type: 'object',
    properties: {
      bookingRef: { type: 'string', description: '예약번호(PNR). 없으면 빈 문자열' },
      flights: {
        type: 'array',
        description: '탑승 순서대로 정렬한 항공편 구간',
        items: {
          type: 'object',
          properties: {
            date: { type: 'string', description: '출발일 YYYY-MM-DD (현지 기준)' },
            airline: { type: 'string', description: '항공사 IATA 2자리 코드 (예: JL, NH, KE)' },
            flightNumber: { type: 'string', description: '편명 숫자 부분 (예: 93)' },
            cabin: { type: 'string', description: 'ECONOMY / PREMIUM / BUSINESS / FIRST 중 하나' },
            fromCode: { type: 'string', description: '출발 공항 IATA 3자리 코드 (예: HND)' },
            fromName: { type: 'string', description: '출발 공항 영문명 (예: Tokyo Haneda)' },
            fromCountry: { type: 'string', description: "출발 공항 국가 영문명 ('Japan' 또는 'South Korea' 등)" },
            fromTerminal: { type: 'string', description: '출발 터미널. 없으면 빈 문자열' },
            toCode: { type: 'string', description: '도착 공항 IATA 3자리 코드' },
            toName: { type: 'string', description: '도착 공항 영문명' },
            toCountry: { type: 'string', description: '도착 공항 국가 영문명' },
            toTerminal: { type: 'string', description: '도착 터미널. 없으면 빈 문자열' },
            departureTime: { type: 'string', description: '현지 출발 시각 HH:MM (24시간)' },
            arrivalTime: { type: 'string', description: '현지 도착 시각 HH:MM (24시간)' },
          },
          required: [
            'date', 'airline', 'flightNumber', 'cabin',
            'fromCode', 'fromName', 'fromCountry', 'fromTerminal',
            'toCode', 'toName', 'toCountry', 'toTerminal',
            'departureTime', 'arrivalTime',
          ],
        },
      },
    },
    required: ['bookingRef', 'flights'],
  },
};

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY_MISSING' }, { status: 503 });
  }

  const { text, today } = await req.json();
  if (!text || typeof text !== 'string') {
    return NextResponse.json({ error: 'EMPTY_TEXT' }, { status: 400 });
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-5-5',
      max_tokens: 2048,
      tools: [RECORD_FLIGHTS_TOOL],
      tool_choice: { type: 'tool', name: 'record_flights' },
      messages: [{
        role: 'user',
        content: `다음은 항공권 e티켓/예약 확인서에서 복사한 텍스트입니다. 항공사·발권처마다 형식이 다르니 형식이 아니라 내용의 맥락으로 판단해 실제 탑승하는 항공편 구간을 모두 추출하세요.

- 오늘 날짜는 ${today || new Date().toISOString().slice(0, 10)} 입니다. 연도가 없으면 발권일/인쇄일과 문맥으로 가장 자연스러운 연도를 고르세요.
- 시각은 모두 현지 시각 그대로 24시간 HH:MM 으로.
- 공항이 도시명·한자·한글로만 적혀 있어도 IATA 코드로 바꾸세요 (예: 羽田→HND, 김포→GMP).
- 취소/변경 전 구간, 운임 규정, 안내문 속 예시는 제외하세요.
- 항공편을 찾지 못하면 flights 를 빈 배열로 두세요.

---
${text}`,
      }],
    });

    const toolUse = response.content.find((c) => c.type === 'tool_use');
    if (!toolUse || toolUse.type !== 'tool_use') {
      return NextResponse.json({ error: 'NO_RESULT' }, { status: 502 });
    }
    return NextResponse.json(toolUse.input);
  } catch (e) {
    console.error('[parse-itinerary]', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
