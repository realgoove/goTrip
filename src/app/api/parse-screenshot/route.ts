import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY_MISSING' }, { status: 503 });
  }

  const { imageBase64, mediaType } = await req.json();

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: imageBase64 },
          },
          {
            type: 'text',
            text: `항공권 이미지에서 항공편 정보를 추출해주세요.
다음 형식으로 각 항공편을 한 줄씩 출력하세요 (헤더나 설명 없이 데이터만):

DDMon AIRLINE FLIGHTNUM (CLASS) CABIN FROM_AIRPORT TO_AIRPORT HHMM HHMM

예시:
13Jun JL 93 (Q) ECONOMY TOKYO HANEDA SEOUL GIMPO 1535 1755 HK 2PC 13Jun 13Jun QNN31ACH FKG3N2
22Jun JL 92 (S) ECONOMY SEOUL GIMPO TOKYO HANEDA 1205 1420 HK 2PC 22Jun 22Jun SNN31ACH FKG3N2

공항명은 영어 대문자로, 날짜는 DDMon 형식(예: 13Jun, 22Jun)으로, 시간은 HHMM 4자리로 출력하세요.
항공편 데이터 행만 출력하고 다른 내용은 포함하지 마세요.`,
          },
        ],
      }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    return NextResponse.json({ text });
  } catch (e) {
    console.error('[parse-screenshot]', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
