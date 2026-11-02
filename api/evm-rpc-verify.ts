const CHAINS = [
  { id: "ethereum", chainId: 1, env: "EVM_ETHEREUM_RPC_URL" },
  { id: "base", chainId: 8453, env: "EVM_BASE_RPC_URL" },
  { id: "bsc", chainId: 56, env: "EVM_BSC_RPC_URL" },
  { id: "arbitrum", chainId: 42161, env: "EVM_ARBITRUM_RPC_URL" },
  { id: "polygon", chainId: 137, env: "EVM_POLYGON_RPC_URL" },
  { id: "robinhood", chainId: 4663, env: "EVM_ROBINHOOD_RPC_URL" },
];

function safeCategory(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (/timeout|abort/i.test(message)) return "timeout";
  if (/fetch|network|connect|dns/i.test(message)) return "network";
  if (/HTTP 4\d\d|unauthorized|forbidden|invalid api key/i.test(message)) return "provider_auth_or_request";
  if (/HTTP 5\d\d/i.test(message)) return "provider_server";
  if (/chain id mismatch/i.test(message)) return "chain_id_mismatch";
  if (/json.?rpc/i.test(message)) return "rpc_error";
  return "request_failed";
}

async function rpc(url: string, method: string, params: unknown[] = []) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(9000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const payload = await response.json();
  if (payload.error) throw new Error("JSON-RPC provider error");
  return payload.result;
}

async function check(url: string, method: string, params: unknown[] = []): Promise<{ method: string; status: "pass" | "fail"; durationMs: number; result?: any; errorCategory?: string }> {
  const started = Date.now();
  try {
    const result = await rpc(url, method, params);
    return { method, status: "pass", durationMs: Date.now() - started, result };
  } catch (error) {
    return { method, status: "fail", durationMs: Date.now() - started, errorCategory: safeCategory(error) };
  }
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method_not_allowed" });
  }
  const expectedToken = process.env.EVM_RPC_VERIFY_TOKEN;
  const supplied = req.headers.authorization?.startsWith("Bearer ")
    ? req.headers.authorization.slice(7)
    : "";
  if (!expectedToken || !supplied || supplied.length !== expectedToken.length ||
      ![...supplied].reduce((ok: boolean, char: string, index: number) =>
        ok && char.charCodeAt(0) === expectedToken.charCodeAt(index), true)) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const results = [];
  for (const chain of CHAINS) {
    const url = process.env[chain.env]?.trim();
    if (!url) {
      results.push({ chain: chain.id, expectedChainId: chain.chainId, status: "fail", errorCategory: "missing_configuration", checks: [] });
      continue;
    }
    const chainCheck = await check(url, "eth_chainId");
    const actualChainId = chainCheck.status === "pass" && typeof chainCheck.result === "string"
      ? Number.parseInt(chainCheck.result, 16) : NaN;
    const checks: any[] = [chainCheck];
    if (actualChainId === chain.chainId) {
      checks.push(await check(url, "eth_blockNumber"));
      const block = await rpc(url, "eth_blockNumber").catch(() => "0x0");
      checks.push(await check(url, "eth_getLogs", [{
        fromBlock: block,
        toBlock: block,
        topics: [],
      }]));
      checks.push(await check(url, "eth_call", [{
        to: "0x0000000000000000000000000000000000000000",
        data: "0x",
      }, "latest"]));
    } else if (chainCheck.status === "pass") {
      checks[0] = { method: "eth_chainId", status: "fail", durationMs: chainCheck.durationMs, errorCategory: "chain_id_mismatch" };
    }
    results.push({
      chain: chain.id,
      expectedChainId: chain.chainId,
      status: checks.every((item) => item.status === "pass") ? "pass" : "fail",
      checks,
    });
  }

  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({
    timestamp: new Date().toISOString(),
    summary: {
      total: results.length,
      passed: results.filter((item) => item.status === "pass").length,
      failed: results.filter((item) => item.status !== "pass").length,
    },
    results,
  });
}
