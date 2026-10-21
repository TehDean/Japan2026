// Ema Wall data on the website: straight to the Japan2026 Supabase project (public key, safe in the page).
// The last copy of the wall is kept on the phone, so it still shows (read-only) when offline.
window.EMA_BACKEND = (() => {
  const URL_ = "https://qsztbfixleqhxovkfaeg.supabase.co/rest/v1/rpc/";
  const KEY = "sb_publishable_IfxPpo_h0HNGY5_maQyqlA_cdDjiWFE";
  const get = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } };
  const set = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
  let device = get("jp-device", null);
  if (!device) {
    device = crypto.randomUUID ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0; return (c === "x" ? r : (r & 3 | 8)).toString(16); });
    set("jp-device", device);
  }
  async function rpc(fn, body) {
    let r;
    try {
      r = await fetch(URL_ + fn, { method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" }, body: JSON.stringify(body || {}) });
    } catch { throw Object.assign(new Error("offline"), { offline: true, userMessage: "🦊 No connection right now. Try again when you're back online." }); }
    const t = await r.text();
    if (!r.ok) {
      let msg = ""; try { msg = JSON.parse(t).message || ""; } catch {}
      throw Object.assign(new Error(msg || "HTTP " + r.status), { userMessage: /Slow down/.test(msg) ? "🦊 Whoa, slow down! Too many changes this hour. Try again a bit later." : undefined });
    }
    return t ? JSON.parse(t) : null;
  }
  return {
    pollMs: 15000,
    async list() {
      try {
        const notes = await rpc("ema_list");
        set("jp-ema-cache", notes);
        return { notes };
      } catch (e) {
        const cached = get("jp-ema-cache", null);
        if (e.offline && cached) return { notes: cached, readOnly: true, banner: "You're offline, so this is the last saved wall. Adding and editing are paused until you're back online." };
        throw e;
      }
    },
    add: (author, board, body) => rpc("ema_add", { p_device: device, p_author: author, p_board: board, p_body: body }),
    edit: (id, body, author) => rpc("ema_edit", { p_device: device, p_id: id, p_body: body, p_author: author }),
    setDone: (id, done) => rpc("ema_set_done", { p_device: device, p_id: id, p_done: done }),
    remove: id => rpc("ema_remove", { p_device: device, p_id: id }),
    restore: id => rpc("ema_restore", { p_device: device, p_id: id }),
  };
})();
