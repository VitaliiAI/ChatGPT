import { NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST() {
    try {
        const thread = await openai.beta.threads.create();
        return NextResponse.json({ threadId: thread.id });
    } catch (error) {
        console.error('Error creating thread:', error);
        return NextResponse.json({ error: 'Failed to create thread' }, { status: 500 });
    }
}
