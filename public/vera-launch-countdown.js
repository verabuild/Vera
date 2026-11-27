(() => {
  "use strict";
  const launchAt = Date.parse("2026-11-28T11:00:00Z");
  if (document.querySelector(".vera-launch-strip")) return;
  const style = document.createElement("style");
  style.textContent = "\n      .vera-launch-strip { display:flex; align-items:center; justify-content:center; gap:10px; flex-wrap:wrap; padding:12px 16px; background:#111719; color:#f4f7f6; border-bottom:1px solid #293630; font-size:12px; line-height:1.5; letter-spacing:.035em; text-align:center; }\n      .vera-launch-strip .vera-launch-dot { width:8px; height:8px; flex:0 0 8px; border-radius:50%; background:#48dc96; animation:veraLaunchPulse 2s ease-out infinite; }\n      .vera-launch-strip strong { font-weight:650; color:#f4f7f6; }\n      .vera-launch-strip a { color:#c1d7cb; display:inline-flex; align-items:center; gap:4px; text-decoration:underline; text-underline-offset:3px; }\n      .vera-launch-strip a:focus-visible { outline:2px solid #48dc96; outline-offset:4px; }\n      .vera-launch-clock { display:inline-flex; gap:5px; font-variant-numeric:tabular-nums; }\n      .vera-launch-clock > span { display:inline-flex; align-items:baseline; gap:4px; background:#202b27; border:1px solid #34463d; border-radius:5px; padding:3px 7px; }\n      .vera-launch-clock b { font-size:15px; min-width:2ch; }\n      .vera-launch-clock small { font-size:9px; color:#c1d7cb; }\n      .vera-launch-local { color:#c1d7cb; font-size:11px; }\n      @keyframes veraLaunchPulse { 0% { box-shadow:0 0 0 0 rgba(72,220,150,.5); } 70%,100% { box-shadow:0 0 0 7px rgba(72,220,150,0); } }\n      @media (prefers-reduced-motion: reduce) { .vera-launch-strip .vera-launch-dot { animation:none; } }\n    ";
  document.head.append(style);
  const banner = document.createElement("aside");
  banner.className = "vera-launch-strip";
  banner.setAttribute("aria-label", "VERA token launch countdown");
  banner.innerHTML = '<span class="vera-launch-dot" aria-hidden="true"></span><strong></strong><span class="vera-launch-clock" role="timer" aria-live="off"><span><b></b><small>HRS</small></span><span><b></b><small>MIN</small></span><span><b></b><small>SEC</small></span></span><span class="vera-launch-local"></span><a href="/vera-token">Launch details ↗</a>';
  const clock = banner.querySelector(".vera-launch-clock");
  const digits = clock.querySelectorAll("b");
  const local = new Intl.DateTimeFormat(undefined, {month:"short",day:"numeric",hour:"numeric",minute:"2-digit",timeZoneName:"short"}).format(launchAt);
  banner.querySelector(".vera-launch-local").textContent = local + " (your time) · 11 AM UTC";
  const tick = () => {
    const seconds = Math.max(0, Math.ceil((launchAt - Date.now()) / 1000));
    banner.querySelector("strong").textContent = seconds > 0 ? "$VERA launches in" : "$VERA launch confirmation pending";
    clock.style.display = seconds > 0 ? "" : "none";
    const values = [Math.floor(seconds/3600), Math.floor(seconds/60)%60, seconds%60];
    digits.forEach((node, i) => { node.textContent = String(values[i]).padStart(2,"0"); });
    clock.setAttribute("aria-label", values[0]+" hours, "+values[1]+" minutes, "+values[2]+" seconds");
  };
  document.body.prepend(banner);
  tick();
  window.setInterval(tick,1000);
  document.addEventListener("visibilitychange",tick);
})();
