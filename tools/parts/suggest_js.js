
// =====================================================================
// Suggest a change: suggestions are saved in the japan2026 Supabase project.
// The panel stays hidden until the database answers.
// =====================================================================
(() => {
  const SB = {
    url: "https://qsztbfixleqhxovkfaeg.supabase.co",
    key: "sb_publishable_IfxPpo_h0HNGY5_maQyqlA_cdDjiWFE"   // public key; safe in a web page
  };
  const rpc = (fn, body) => fetch(SB.url + "/rest/v1/rpc/" + fn, {
    method: "POST",
    headers: { apikey: SB.key, "Content-Type": "application/json" },
    body: JSON.stringify(body || {})
  }).then(r => r.ok ? (r.status === 204 ? null : r.text().then(t => t ? JSON.parse(t) : null))
                    : r.text().then(t => { throw new Error("HTTP " + r.status + " " + t); }));
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
  };
  let device = store.get("jp-device", null);
  if (!device) {
    device = (crypto.randomUUID ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0; return (c === "x" ? r : (r & 3 | 8)).toString(16); }));
    store.set("jp-device", device);
  }
  const $ = id => document.getElementById(id);
  const panel = $("sgPanel"), list = $("sgList"), err = $("sgErr"), btn = $("sgSend");
  $("sgName").value = store.get("jp-name", "");
  DAYS.forEach(d => { const o = document.createElement("option"); o.value = d.date; o.textContent = d.date + " · " + d.title; $("sgDay").appendChild(o); });

  const ago = iso => {
    const m = Math.round((Date.now() - new Date(iso)) / 60000);
    if (m < 1) return "just now"; if (m < 60) return m + " min ago";
    const h = Math.round(m / 60); if (h < 24) return h + " hr ago";
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };
  const STATUS = { new: ["Waiting", "wait"], working: ["🦊 The kitsune is on it…", "wait"], done: ["Added to the plan", "done"], answered: ["Answered", "ans"], skipped: ["Not added", "skip"] };

  function render(rows) {
    list.innerHTML = "";
    if (!rows.length) {
      const li = document.createElement("li"); li.className = "sg-empty";
      li.textContent = "Nothing here yet. Suggestions and questions will show up here.";
      list.appendChild(li); return;
    }
    rows.forEach(r => {
      const li = document.createElement("li");
      const meta = document.createElement("div"); meta.className = "sg-meta";
      const who = document.createElement("b"); who.textContent = r.suggested_by;
      meta.append(who, document.createTextNode(" · " + (r.day ? r.day + " · " : "") + ago(r.created_at)));
      const [label, cls] = STATUS[r.status] || STATUS.new;
      const chip = document.createElement("span"); chip.className = "sg-chip " + cls; chip.textContent = label;
      meta.appendChild(chip);
      const body = document.createElement("p"); body.className = "sg-body"; body.textContent = r.body;
      li.append(meta, body);
      if (r.reply) { const rep = document.createElement("p"); rep.className = "sg-reply"; rep.textContent = r.reply; li.appendChild(rep); }
      list.appendChild(li);
    });
  }
  let pollTimer = null;
  async function load() {
    try {
      const rows = (await rpc("list_trip_suggestions_v2")) || [];
      render(rows); panel.hidden = false;
      // While something is being worked on, check back every few seconds
      clearTimeout(pollTimer);
      if (rows.some(r => r.status === "working")) pollTimer = setTimeout(() => { load(); loadPlan(); }, 6000);
    } catch { panel.hidden = true; }   // offline or not set up: keep the page as it was
  }

  // The live plan is kept in the database; the copy built into the page is the fallback.
  let planStamp = null;
  function usePlan(data, stamp) {
    if (!data || !Array.isArray(data.days) || !data.places || stamp === planStamp) return;
    planStamp = stamp;
    PLACES = data.places; DAYS = data.days;
    renderAll(false);
  }
  try { const c = store.get("jp-plan", null); if (c) usePlan(c.data, c.updated_at); } catch {}
  async function loadPlan() {
    try {
      const r = await rpc("get_trip_plan");
      if (r && r.data) { usePlan(r.data, r.updated_at); store.set("jp-plan", r); }
    } catch { /* offline: keep the saved or built-in plan */ }
  }
  const note = $("sgNote");
  const say2 = t => { note.textContent = t; note.hidden = !t; };

  $("sgForm").addEventListener("submit", async e => {
    e.preventDefault();
    const name = $("sgName").value.trim(), body = $("sgBody").value.trim(), day = $("sgDay").value;
    const say = (m, el) => { err.textContent = m; err.hidden = false; el && el.focus(); };
    err.hidden = true;
    if (!name) return say("Add your name so everyone knows who sent it.", $("sgName"));
    if (body.length < 3) return say("Write your suggestion or question.", $("sgBody"));
    btn.disabled = true; btn.textContent = "Sending…";
    try {
      const id = await rpc("send_trip_suggestion", { p_device: device, p_by: name.slice(0, 30), p_day: day.slice(0, 20), p_body: body.slice(0, 500) });
      store.set("jp-name", name);
      $("sgBody").value = "";
      say2("Sent! 🦊 The kitsune is on it. This usually takes under a minute.");
      btn.textContent = "🦊 Kitsune at work…";
      const run = fetch(SB.url + "/functions/v1/apply-suggestion", {
        method: "POST", headers: { apikey: SB.key, "Content-Type": "application/json" }, body: JSON.stringify({ id })
      }).then(r => r.json()).catch(() => null);
      setTimeout(load, 1500);                       // show it as "Updating…" while it runs
      const res = await run;
      await loadPlan(); await load();
      if (res && res.ok && res.status === "done") say2("Done! The kitsune updated the plan. See the reply below.");
      else if (res && res.ok && res.status === "answered") say2("The kitsune has answered! See the answer below.");
      else if (res && res.ok) say2("No change made. See the reply below.");
      else say2("Sent! It couldn't be handled automatically right now, so it's waiting in the list below.");
      btn.textContent = "Send";
    } catch (e2) {
      btn.textContent = "Send"; say2("");
      say(/too many/i.test(String(e2 && e2.message)) ? "That's a lot of suggestions for one day. Try again tomorrow." : "Couldn't send that. Check your connection and try again.");
    } finally { btn.disabled = false; }
  });
  loadPlan();
  load();
})();
