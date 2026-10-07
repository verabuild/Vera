import { usePrivy } from "@privy-io/react-auth";
import { LogIn, LogOut, ShieldCheck, Wallet } from "lucide-react";

export default function AuthControls() {
  const { ready, authenticated, user, login, logout } = usePrivy();
  if (!ready) return <span className="auth-status">INITIALISING SECURE SESSION</span>;
  if (authenticated) {
    const account = user?.email?.address ?? user?.wallet?.address ?? "VERA account";
    return <div className="auth-controls">
      <span className="auth-account" title={account}><ShieldCheck size={13} /> {account.length > 22 ? account.slice(0, 10) + "…" + account.slice(-7) : account}</span>
      <button className="auth-button" onClick={() => void logout()}><LogOut size={14} /> Sign out</button>
    </div>;
  }
  return <button className="auth-button auth-login" onClick={() => login()}><LogIn size={14} /> Sign in <span className="auth-divider">·</span> <Wallet size={14} /> Solana</button>;
}
