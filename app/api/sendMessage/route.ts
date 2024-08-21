import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

interface TextContentBlock {
  text: { value: string };
}

interface ImageFileContentBlock {
  url: string;
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

function isTextContentBlock(content: any): content is TextContentBlock {
  return (content as TextContentBlock).text !== undefined;
}

export async function POST(req: NextRequest) {
    const { message, threadId, assistantId } = await req.json();

    try {
      await openai.beta.threads.messages.create(threadId, {
        role: "user",
        content: message
      });

      const run = await openai.beta.threads.runs.create(threadId, { 
        assistant_id: assistantId
      });

      let runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);

      while (runStatus.status !== 'completed') {
        await new Promise(resolve => setTimeout(resolve, 1000));
        runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
      }

      const messages = await openai.beta.threads.messages.list(threadId);
      const contentBlock = messages.data[0].content[0];
      
      if (isTextContentBlock(contentBlock)) {
        const lastMessage = contentBlock.text.value;
        return NextResponse.json({ message: lastMessage });
      } else {
        return NextResponse.json({ error: 'Content block does not contain text' }, { status: 400 });
      }
    } catch (error) {
      console.error('Error sending message:', error);
      return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
    }
}
