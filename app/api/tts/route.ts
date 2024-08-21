import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(req: NextRequest) {
    const { text } = await req.json();

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    try {
      const response = await openai.audio.speech.create({
        model: "tts-1",
        voice: "nova",
        input: text,
      });

      const buffer = Buffer.from(await response.arrayBuffer());

      return new NextResponse(buffer, {
        status: 200,
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Length': buffer.length.toString(),
        },
      });
    } catch (error) {
      console.error('Error generating speech:', error);
      return NextResponse.json({ error: 'Failed to generate speech' }, { status: 500 });
    }
}
