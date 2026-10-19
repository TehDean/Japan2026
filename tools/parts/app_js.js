
// =====================================================================
// Home-screen app: install button (Android/desktop Chrome), a tip for
// iPhone, and offline support through the service worker (sw.js).
// =====================================================================
(() => {
  if ("serviceWorker" in navigator && window.isSecureContext) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
  const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const btn = document.getElementById("installBtn"), tip = document.getElementById("installTip");
  if (standalone) return;
  const ua = navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua)) {
    tip.innerHTML = "Keep this on your phone like an app: tap <b>Share</b>, then <b>Add to Home Screen</b>. It works offline too.";
    tip.hidden = false;
  } else if (/android/i.test(ua)) {
    tip.innerHTML = "Keep this on your phone like an app: tap <b>Install app</b>, or tap <b>⋮</b> and choose <b>Add to Home screen</b>. It works offline too.";
    tip.hidden = false;
  }
  let installEvt = null;
  window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); installEvt = e; btn.hidden = false; });
  btn.addEventListener("click", async () => {
    if (!installEvt) return;
    installEvt.prompt();
    try { await installEvt.userChoice; } catch {}
    installEvt = null; btn.hidden = true;
  });
  window.addEventListener("appinstalled", () => { btn.hidden = true; tip.hidden = true; });
})();
