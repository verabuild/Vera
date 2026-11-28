import React, { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import ReactDOM from "react-dom/client";
import { PrivyProvider } from "@privy-io/react-auth";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";
import App from "./App";
import OrbitalBackdrop from "./components/OrbitalBackdrop";
import "./styles.css";

function LaunchCountdown() {
  const [copyStatus, setCopyStatus] = useState("Copy CA");
  const contract = "0xbaf6033ccd41734acc7e14038c9b06910543650e";
  return <>
    <style>{`
      .vera-launch-strip { display:flex; align-items:center; justify-content:center; gap:10px; flex-wrap:wrap; padding:12px 16px; background:#111719; color:#f4f7f6; border-bottom:1px solid #293630; font-size:12px; line-height:1.5; letter-spacing:.035em; text-align:center; }
      .vera-launch-strip .vera-launch-dot { width:8px; height:8px; flex:0 0 8px; border-radius:50%; background:#48dc96; animation:veraLaunchPulse 2s ease-out infinite; }
      .vera-launch-strip strong { font-weight:650; color:#f4f7f6; }
      .vera-launch-strip a { color:#c1d7cb; display:inline-flex; align-items:center; gap:4px; text-decoration:underline; text-underline-offset:3px; }
      .vera-launch-strip a:focus-visible { outline:2px solid #48dc96; outline-offset:4px; }
      .vera-launch-clock { display:inline-flex; gap:5px; font-variant-numeric:tabular-nums; }
      .vera-launch-clock > span { display:inline-flex; align-items:baseline; gap:4px; background:#202b27; border:1px solid #34463d; border-radius:5px; padding:3px 7px; }
      .vera-launch-clock b { font-size:15px; min-width:2ch; }
      .vera-launch-clock small { font-size:9px; color:#c1d7cb; }
      .vera-launch-local { color:#c1d7cb; font-size:11px; }
      .vera-contract-strip { display:flex; flex-wrap:wrap; align-items:center; justify-content:center; gap:8px 16px; padding:16px 18px; background:#101817; color:#f5faf7; border-bottom:1px solid #365044; text-align:center; }
      .vera-contract-strip strong { font-size:13px; font-weight:800; color:#79e5ad; }
      .vera-contract-strip code { font-family:ui-monospace,monospace; font-size:clamp(13px,2vw,18px); font-weight:800; overflow-wrap:anywhere; min-width:0; user-select:all; }
      .vera-contract-strip button { background:#20382c; color:#f5faf7; border:1px solid #58856b; border-radius:6px; padding:8px 12px; font-weight:700; cursor:pointer; }
      .vera-contract-strip button:focus-visible { outline:2px solid #79e5ad; outline-offset:3px; }
      @keyframes veraLaunchPulse { 0% { box-shadow:0 0 0 0 rgba(72,220,150,.5); } 70%,100% { box-shadow:0 0 0 7px rgba(72,220,150,0); } }
      @media (prefers-reduced-motion: reduce) { .vera-launch-strip .vera-launch-dot { animation:none; } }
    `}</style>
    <aside className="vera-launch-strip" aria-label="VERA token live"><span className="vera-launch-dot" aria-hidden="true" /><a href="https://ponsfamily.com/launchpad/0xbaf6033ccd41734acc7e14038c9b06910543650e" target="_blank" rel="noopener noreferrer"><strong>$VERA IS LIVE</strong> · Buy $VERA <ArrowUpRight size={13} aria-hidden="true" /></a></aside>
    <section className="vera-contract-strip" aria-label="Official VERA contract address"><strong>OFFICIAL $VERA CA · ROBINHOOD CHAIN</strong><code>{contract}</code><button type="button" onClick={async () => { try { await navigator.clipboard.writeText(contract); setCopyStatus("Copied"); } catch { setCopyStatus("Select address to copy"); } }}>{copyStatus}</button></section></>;
}

const appId = import.meta.env.VITE_PRIVY_APP_ID;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {appId ? (
      <PrivyProvider
        appId={appId}
        config={{
          loginMethods: ["email", "google", "wallet"],
          appearance: {
            theme: "dark",
            accentColor: "#f5f5f5",
            logo: "/vera-logo.jpg",
            walletChainType: "solana-only"
          },
          externalWallets: {
            solana: {
              connectors: toSolanaWalletConnectors()
            }
          }
        }}
      >
        <>
          <OrbitalBackdrop />
          <LaunchCountdown />
          <App />
        </>
      </PrivyProvider>
    ) : (
      <>
        <OrbitalBackdrop />
        <LaunchCountdown />
          <App />
      </>
    )}
  </React.StrictMode>
);
