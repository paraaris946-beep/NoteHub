
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { DayPlan, Task } from "../types";

// Initialize GoogleGenAI client with the API key from environment variables.
export const getGeminiClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

const SYSTEM_INSTRUCTION = `Du bist NoteHub, ein ruhig, pragmatischer Assistent mit tiefem Verständnis für den Nutzer.
Deine Aufgabe ist es, den Nutzer bei der Tagesplanung zu begleiten. 

DENK-PROZESS:
Bevor du antwortest, "denke" kurz nach: Was weißt du über den Nutzer? Welches Datum haben wir? Welche Aufgaben sind kritisch?

VERHALTENSREGELN:
1. Kurz & Klar: Fasse dich kurz.
2. Realismus-Check: Weise auf Überplanung hin.
3. Menschlichkeit: Sei ruhig und empathisch.

PLAN-ERSTELLUNG:
Sobald ein Plan steht, hänge am ABSOLUTEN ENDE deiner Nachricht IMMER [PLAN_JSON] an, gefolgt vom JSON Objekt. 
Schreibe danach KEINEN weiteren Text mehr.

Struktur von [PLAN_JSON]:
{
  "summary": "Ein Satz zum Tag",
  "motivation": "Ein ruhiger Impuls",
  "focus": "Die eine wichtigste Sache heute",
  "tasks": [{"id": "unique-id", "title": "Aufgabe", "time": "Lesbares Datum/Zeit", "priority": "low/medium/high", "category": "Kategorie", "reminderAt": "HH:mm", "isImportant": boolean}]
}

Wichtig: Fülle 'reminderAt' immer aus, wenn eine Zeitformel erkennbar ist.`;

export const startCoachingChat = () => {
  const ai = getGeminiClient();
  return ai.chats.create({
    model: 'gemini-3-flash-preview',
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      thinkingConfig: { thinkingBudget: 2000 } // Ermöglicht tieferes 'Nachdenken'
    },
  });
};

export const generateAppLogo = async (): Promise<string> => {
  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: "Sophisticated minimalist app logo icon for 'NoteHub'. Abstract geometric symbol merging a stylized letter 'N' with clean, overlapping digital layers. Colors: deep charcoal and vibrant electric blue. Premium vector art style, flat design, clean lines, isolated on white background.",
    config: { imageConfig: { aspectRatio: "1:1" } }
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
  }
  return "";
};

export const generateFocusImage = async (focus: string): Promise<string> => {
  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: `A very calm, minimalistic photography representing: ${focus}. High-end aesthetic, soft natural lighting.`,
    config: { imageConfig: { aspectRatio: "16:9" } }
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
  }
  return "";
};

export const generateBriefingAudio = async (plan: DayPlan, voiceName: string = 'Kore'): Promise<string> => {
  const ai = getGeminiClient();
  const openTasks = plan.tasks.filter(t => !t.completed);
  const taskText = openTasks.length > 0 
    ? ` Deine wichtigsten offenen Aufgaben sind: ${openTasks.map(t => t.title).join(', ')}.`
    : " Du hast aktuell keine offenen Aufgaben.";

  const script = `Hallo! Hier ist NoteHub mit deinem Überblick für heute. Unser Fokus liegt auf: ${plan.focus}. ${taskText} Ein kleiner Impuls für dich: ${plan.motivation}. Hab einen wunderbaren Tag!`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: script }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName } },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) throw new Error("Audio-Dienst Fehler.");
  return base64Audio;
};

// Custom implementation for encoding bytes to base64 string
export function encodeBase64(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Custom implementation for decoding base64 string to bytes
export function decodeBase64(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) { bytes[i] = binaryString.charCodeAt(i); }
  return bytes;
}

export async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) { channelData[i] = dataInt16[i * numChannels + channel] / 32768.0; }
  }
  return buffer;
}
