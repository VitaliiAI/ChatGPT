import { NextResponse } from 'next/server'
import { OpenAI } from 'openai'

export const runtime = 'edge'

export async function POST(req: Request) {
  if (!req.body) {
    return NextResponse.json({ error: 'No body found' }, { status: 400 })
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const transcription = await openai.audio.transcriptions.create({
      file: file,
      model: "whisper-1",
      response_format: "text",
    })

    return NextResponse.json({ transcription })
  } catch (error) {
    console.error('Error transcribing audio:', error)
    return NextResponse.json({ error: 'Error transcribing audio' }, { status: 500 })
  }
}
