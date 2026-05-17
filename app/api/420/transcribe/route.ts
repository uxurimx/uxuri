import { NextResponse } from "next/server";
import OpenAI from "openai";
import { require420Access, is420Forbidden } from "@/lib/smoke-guard";

const openai = new OpenAI();

export async function POST(req: Request) {
  const guard = await require420Access();
  if (is420Forbidden(guard)) return guard;

  try {
    const formData = await req.formData();
    const audio = formData.get("audio") as Blob | null;
    if (!audio) return NextResponse.json({ error: "No audio provided" }, { status: 400 });

    const file = new File([audio], "recording.webm", { type: audio.type || "audio/webm" });

    const transcription = await openai.audio.transcriptions.create({
      file,
      model: "whisper-1",
      language: "es",
    });

    return NextResponse.json({ text: transcription.text });
  } catch (e) {
    console.error("[420/transcribe]", e);
    return NextResponse.json({ error: "Transcription failed" }, { status: 500 });
  }
}
