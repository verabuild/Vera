import { useState } from "react";
import { ArrowLeft, ArrowUpRight, FileSearch, Fingerprint, Search, ShieldCheck, Sparkles } from "lucide-react";

type Props = {
  onBack: () => void;
  onLookup: (id: string) => void;
};

export default function InvestigationLookupPage({ onBack, onLookup }: Props) {
  const [referenceId, setReferenceId] = useState("");
  return <main className="lookup-page">
    <header className="lookup-topbar">
      <button className="lookup-brand" onClick={onBack} aria-label="Back to VERA"><span className="lookup-brand-mark"><img src="/vera-logo.jpg" alt="" /></span><span>VERA</span></button>
      <span className="lookup-topbar-label"><span /> REPORT RETRIEVAL</span>
      <span className="lookup-readonly"><ShieldCheck size={13} /> READ-ONLY</span>
    </header>
    <section className="lookup-stage">
      <div className="lookup-orbit lookup-orbit-one" />
      <div className="lookup-orbit lookup-orbit-two" />
      <div className="lookup-content">
        <button className="lookup-back-link" onClick={onBack}><ArrowLeft size={14} /> Back to VERA</button>
        <div className="lookup-kicker"><span className="lookup-kicker-icon"><FileSearch size={16} /></span><span>INVESTIGATION ARCHIVE</span><span className="lookup-kicker-line" /></div>
        <h1>Return to the <em>evidence.</em></h1>
        <p className="lookup-intro">Enter the Investigation ID from a saved VERA report to reopen its findings. No need to run the investigation again.</p>
        <form className="lookup-form-card" onSubmit={(event) => { event.preventDefault(); const id = referenceId.trim(); if (id) onLookup(id); }}>
          <label htmlFor="lookup-reference-id">INVESTIGATION ID</label>
          <div className="lookup-input-wrap"><Fingerprint size={19} /><input id="lookup-reference-id" value={referenceId} onChange={(event) => setReferenceId(event.target.value)} placeholder="Paste your Investigation ID" autoComplete="off" spellCheck={false} required /><button type="button" className="lookup-clear" onClick={() => setReferenceId("")} disabled={!referenceId}>Clear</button></div>
          <button className="lookup-submit" type="submit" disabled={!referenceId.trim()}><Search size={16} /> Find saved report <ArrowUpRight size={16} /></button>
          <p className="lookup-privacy"><ShieldCheck size={13} /> This only retrieves a saved report. It does not initiate a new scan or execute transactions.</p>
        </form>
        <div className="lookup-help-row"><span className="lookup-help-icon"><Sparkles size={15} /></span><div><strong>Where can I find my ID?</strong><p>Open your investigation results and use <b>Copy ID</b> in the Investigation ID panel.</p></div></div>
        <div className="lookup-footer"><span>VERA / INVESTIGATION LOOKUP</span><span>INVESTIGATE FIRST. DECIDE SECOND.</span></div>
      </div>
    </section>
  </main>;
}
