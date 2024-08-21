import { NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export const runtime = 'edge'

const MAX_RETRIES = 5;
const INITIAL_RETRY_DELAY = 1000; // 1 second

async function generateImageWithRetry(prompt: string, retries = 0): Promise<string> {
  try {
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: prompt,
    })

    if (!response.data || response.data.length === 0) {
      throw new Error('No image generated');
    }

    const url = response.data[0].url ?? '';
    return url;
  } catch (error: any) {
    if (error.status === 429 && retries < MAX_RETRIES) {
      const retryAfter = parseInt(error.headers?.['retry-after'] || '1', 10);
      const delay = Math.max(INITIAL_RETRY_DELAY * Math.pow(2, retries), retryAfter * 1000);
      console.log(`Rate limited. Retrying after ${delay}ms. Attempt ${retries + 1} of ${MAX_RETRIES}`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return generateImageWithRetry(prompt, retries + 1);
    } else {
      throw error;
    }
  }
}

export async function POST(request: Request) {
  try {
    const { prompt } = await request.json()

    if (!prompt) {
      return new Response(JSON.stringify({ error: 'Prompt is required' }), { 
        status: 400, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }

    const imageUrl = await generateImageWithRetry(prompt);

    return new Response(JSON.stringify({ status: 'complete', imageUrl }), { 
      headers: { 'Content-Type': 'application/json' } 
    });
  } catch (error: any) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ 
      error: 'Error generating image', 
      details: error.message,
      status: error.status,
      code: error.code
    }), { 
      status: error.status || 500, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }
}
