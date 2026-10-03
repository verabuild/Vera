export type InputType = 'URL' | 'MESSAGE' | 'WALLET' | 'TX';
export type Network = 'mainnet' | 'devnet';
export type AssessmentState = 'VERIFIED' | 'SUPPORTED' | 'UNKNOWN' | 'SUSPICIOUS' | 'CONFIRMED_MALICIOUS';
export type Severity = 'info' | 'low' | 'medium' | 'high';

export interface Evidence {
  id: string;
  title: string;
  detail: string;
  severity: Severity;
  source: string;
  state: 'VERIFIED' | 'SUPPORTED' | 'UNKNOWN';
  observedAt?: string;
  metadata?: Record<string, unknown>;
}

export interface Assessment {
  state: AssessmentState;
  headline: string;
  explanation: string;
  action: string;
  evidence: Evidence[];
  confidence?: 'LOW' | 'MEDIUM' | 'HIGH';
  network?: Network;
  aiExplanation?: string;
}

export interface Scan {
  id: string;
  type: InputType;
  input: string;
  createdAt: string;
  assessment: Assessment;
}

export interface InvestigationRequest {
  inputType: InputType;
  input: string;
  network?: Network;
}