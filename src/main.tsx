import React from "react";
import ReactDOM from "react-dom/client";
import { PrivyProvider } from "@privy-io/react-auth";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";
import App from "./App";
import "./styles.css";

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
        <App />
      </PrivyProvider>
    ) : (
      <App />
    )}
  </React.StrictMode>
);
