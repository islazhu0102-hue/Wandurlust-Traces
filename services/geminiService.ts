import { GoogleGenAI } from "@google/genai";
import { JournalEntry } from "../types";

// Always use the direct process.env.API_KEY as per guidelines
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateTravelSummary = async (entries: JournalEntry[]): Promise<string> => {
  if (entries.length === 0) return "No entries selected.";

  const entriesText = entries.map(e => `- On ${e.dateDisplay}, at a location (${e.category}), I wrote: "${e.note}"`).join("\n");

  const prompt = `Write a poetic and reflective travel summary (max 80 words) for these entries: \n${entriesText}\nTone: Warm, nostalgic, luminary.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    // response.text is a property, not a method
    return response.text || "Could not generate summary.";
  } catch (error) {
    return "An error occurred.";
  }
};

export const enhanceEntryNote = async (rawNote: string, category: string): Promise<string> => {
  if (!rawNote.trim()) return rawNote;
  const prompt = `Rewrite this raw note into an evocative travel journal entry (max 40 words): "${rawNote}". Category: ${category}.`;
  try {
    const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt });
    // response.text is a property
    return response.text?.trim() || rawNote;
  } catch { return rawNote; }
};

export const getPlaceContext = async (lat: number, lng: number): Promise<string> => {
  const prompt = `I am at Lat: ${lat}, Lng: ${lng}. Tell me one interesting historical fact about this spot (max 40 words).`;
  try {
    const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt });
    // response.text is a property
    return response.text?.trim() || "A beautiful mysterious spot.";
  } catch { return "Agent is offline."; }
};

/**
 * 根据笔记生成 AI 艺术照片
 */
export const paintMemory = async (note: string): Promise<string | null> => {
  if (!note.trim()) return null;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: `A beautiful, atmospheric watercolor painting of a travel memory: "${note}". Dreamy, artistic, soft lighting, 1:1 aspect ratio.` }]
      },
      config: {
        imageConfig: { aspectRatio: "1:1" }
      }
    });

    // Iterate through all parts to find the image part, do not assume it is the first part.
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          const base64EncodeString: string = part.inlineData.data;
          return `data:${part.inlineData.mimeType};base64,${base64EncodeString}`;
        }
      }
    }
    return null;
  } catch (error) {
    console.error("Image generation failed:", error);
    return null;
  }
};