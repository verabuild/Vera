export type InputType = 'URL' | 'MESSAGE' | 'WALLET' | 'TX';
export type Network = 'mainnet' | 'devnet';
export type AssessmentState = 'VERIFIED' | 'SUPPORTED' | 'UNKNOWN' | 'SUSPICIOUS' | 'CONFIRMED_MALICIOUS';
export type UrlVerdict = 'SAFE' | 'NOT_SAFE' | 'CAUTION' | 'REVIEW';
export type Severity = 'info' | 'low' | 'medium' | 'high';
export type InvestigationCheckStatus = 'CHECKED' | 'MATCH' | 'NO_MATCH' | 'UNAVAILABLE' | 'SKIPPED';

export interface InvestigationCheck {
  name: string;
  status: InvestigationCheckStatus;
  source: string;
  detail: string;
}

export interface InvestigationStatusReport {
  overall: 'COMPLETE' | 'PARTIAL' | 'CONFIRMED_FINDING';
  coverage: number;
  checkedAt: string;
  checks: InvestigationCheck[];
  decisiveFindings: number;
}

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
  statusReport?: InvestigationStatusReport;
  verdict?: UrlVerdict;
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