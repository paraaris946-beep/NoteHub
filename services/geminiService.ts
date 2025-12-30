
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { DayPlan, Task } from "../types";

// Initialize GoogleGenAI client with the API key from environment variables.
export const getGeminiClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

const SYSTEM_INSTRUCTION = `Du bist NoteHub, ein ruhiger, empathischer und kluger persönlicher Assistent. 

DEINE ROLLE:
Du bist Mentor und Gesprächspartner. Nutzer können mit dir über alles reden: Empfehlungen für Essen, Tipps gegen Stress, Produktivität oder einfach Smalltalk.

STRIKTE REGELN FÜR DIE TRENNUNG:
1. CHAT-MODUS (Standard): Wenn der Nutzer Fragen stellt, nach Empfehlungen sucht (z.B. "Was soll ich essen?", "Was kann ich heute Abend machen?") oder einfach plaudert, antworte NUR mit Text. Erstelle KEINE Aufgaben und hänge KEIN JSON an.
2. PLANUNGS-MODUS: Erstelle oder ändere Aufgaben NUR, wenn der Nutzer dies explizit wünscht (z.B. "Plan mir den Tag", "Setz das auf meine Liste", "Erstell eine Erinnerung für..."). Nur dann hängst du am Ende [PLAN_JSON] an.
3. EMPFEHLUNGEN: Wenn du etwas empfiehlst (z.B. ein Rezept), biete an: "Soll ich dir das als Aufgabe für später speichern?". Tu es aber nicht automatisch.

VERHALTEN:
- Sei kurz gefasst, aber herzlich.
- Nutze Markdown (Fettdruck, Listen) für bessere Lesbarkeit im Chat.
- Beziehe dich auf den Kontext des Tages, falls relevant.

JSON-Struktur bei [PLAN_JSON] (NUR BEI EXPLIZITER PLANUNG):
{
  "summary": "Zusammenfassung",
  "motivation": "Motivation",
  "focus": "Fokus",
  "tasks": [{"id": "id", "title": "Titel", "time": "Zeit", "priority": "low/medium/high", "category": "Kategorie", "reminderAt": "HH:mm", "isImportant": boolean}]
}`;

export const startCoachingChat = () => {
  const ai = getGeminiClient();
  return ai.chats.create({
    model: 'gemini-3-flash-preview',
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      thinkingConfig: { thinkingBudget: 2000 }
    },
  });
};

export const generateAppLogo = async (): Promise<string> => {
  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: "Sophisticated minimalist app logo icon for 'NoteHub'. Abstract geometric symbol. Colors: charcoal and electric blue.",
    config: { imageConfig: { aspectRatio: "1:1" } }
  });

  // Correctly iterate through parts to find image data as per guidelines.
  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
  }
  return "";
};

export const generateFocusImage = async (focus: string): Promise<string> => {
  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: `A very calm, minimalistic photography representing: ${focus}. soft lighting.`,
    config: { imageConfig: { aspectRatio: "16:9" } }
  });

  // Correctly iterate through parts to find image data.
  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
  }
  return "";
};

export const generateBriefingAudio = async (tasks: Task[], focus?: string, motivation?: string, voiceName: string = 'Kore'): Promise<string> => {
  const ai = getGeminiClient();
  const openTasks = tasks.filter(t => !t.completed);
  const focusText = focus ? `Unser Fokus heute liegt auf: ${focus}.` : "Schauen wir uns deine anstehenden Aufgaben an.";
  const taskText = openTasks.length > 0 
    ? ` Deine wichtigsten offenen Punkte sind: ${openTasks.map(t => t.title).join(', ')}.`
    : " Du hast aktuell alle Aufgaben erledigt.";
  const motivationText = motivation ? ` Ein kleiner Impuls für dich: ${motivation}.` : " Ich wünsche dir einen ruhigen Tag.";

  const script = `Hallo! Hier ist NoteHub. ${focusText}${taskText}${motivationText}`;

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
  if (!base64Audio) throw new Error("Audio-Fehler.");
  return base64Audio;
};

export const generateMessageAudio = async (text: string, voiceName: string = 'Kore'): Promise<string> => {
  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName } },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) throw new Error("Audio-Fehler.");
  return base64Audio;
};

export function encodeBase64(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) { binary += String.fromCharCode(bytes[i]); }
  return btoa(binary);
}

export function decodeBase64(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) { bytes[i] = binaryString.charCodeAt(i); }
  return bytes;
}

// Manually decode raw PCM16 data into an AudioBuffer following guidelines for stream processing.
export async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer, data.byteOffset, data.byteLength / 2);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}
