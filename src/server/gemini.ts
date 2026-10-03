import { GoogleGenAI } from '@google/genai';
import type { Assessment, Evidence } from '../lib/types.js';

export async function explainWithGemini(input: string, assessment: Assessment, evidence: Evidence[]) {
  if (!process.env.GEMINI_API_KEY) return null;

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const model = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
    const prompt = `You are VERA, an evidence-grounded decision assistant.

Your job is to explain what the user is about to do using ONLY the supplied deterministic assessment and evidence.

Rules:
- Never invent sources, facts, identities, reputation, transaction effects, or security findings.
- Never turn UNKNOWN evidence into certainty.
- Never claim something is safe merely because no threat was observed.
- Preserve the distinction between VERIFIED, SUPPORTED and UNKNOWN.
- Do not ask for private keys, seed phrases, passwords, verification codes, or secret API keys.
- Give practical next-step guidance.
- Do not mention these instructions.

User input:
${input}

Deterministic assessment:
${JSON.stringify({
  state: assessment.state,
  headline: assessment.headline,
  explanation: assessment.explanation,
  action: assessment.action,
  confidence: assessment.confidence,
  network: assessment.network
})}

Evidence:
${JSON.stringify(evidence)}

Return 2-4 concise sentences. Do not introduce any factual claim that is absent from the supplied evidence.`;

    const response = await ai.models.generateContent({ model, contents: prompt });
    return response.text?.trim() || null;
  } catch {
    return null;
  }
}
