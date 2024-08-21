import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST() {
  try {
    console.log("Initializing assistant...");
    const assistant = await openai.beta.assistants.create({
      name: "Vitalii",
      instructions:
        "Say friendly. Say shortly. And introduce yourself as Vitalii, Full Stack AI Engineer with 5 years of experience. You must help clients build front-end, back-end, smart contract, AI chat bot, ML, Modelling etc.",
      model: "gpt-4o",
    });
    console.log("Assistant created:", assistant);
    return NextResponse.json({ assistantId: assistant.id });
  } catch (error) {
    console.error("Failed to initialize the assistant:", error);
    return NextResponse.json(
      { error: "Failed to initialize assistant", details: error },
      { status: 500 }
    );
  }
}
