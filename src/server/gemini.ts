import { GoogleGenAI } from '@google/genai';
import type { Assessment, Evidence } from '../lib/types';

export async function explainWithGemini(input: string, assessment: Assessment, evidence: Evidence[]) {
  if (!process.env.GEMINI_API_KEY) return null;
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const model = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
  const prompt = `You are VERA, an evidence-grounded decision assistant. Explain an online action without claiming certainty beyond the evidence. Never invent sources, facts, or security findings. If evidence is insufficient, say UNKNOWN. Do not ask for private keys, seed phrases, passwords, or secret API keys.

User input:\n${input}\n\nDeterministic assessment:\n${JSON.stringify({ state: assessment.state, headline: assessment.headline, explanation: assessment.explanation, action: assessment.action })}\n\nEvidence:\n${JSON.stringify(evidence)}\n\nReturn 2-4 concise sentences explaining what the user should understand and what they should do next. Do not introduce new factual claims.`;
  const response = await ai.models.generateContent({ model, contents: prompt });
  return response.text?.trim() || null;
}