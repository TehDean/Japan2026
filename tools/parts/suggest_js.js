
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
  const STATUS = { new: ["Waiting", "wait"], done: ["Added to the plan", "done"], skipped: ["Not added", "skip"] };

  function render(rows) {
    list.innerHTML = "";
    if (!rows.length) {
      const li = document.createElement("li"); li.className = "sg-empty";
      li.textContent = "No suggestions yet. The first one will show up here.";
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
  async function load() {
    try { render((await rpc("list_trip_suggestions")) || []); panel.hidden = false; }
    catch { panel.hidden = true; }   // database not set up yet: keep the page as it was
  }

  $("sgForm").addEventListener("submit", async e => {
    e.preventDefault();
    const name = $("sgName").value.trim(), body = $("sgBody").value.trim(), day = $("sgDay").value;
    const say = (m, el) => { err.textContent = m; err.hidden = false; el && el.focus(); };
    err.hidden = true;
    if (!name) return say("Add your name so we know who suggested it.", $("sgName"));
    if (body.length < 3) return say("Write what you'd like to change.", $("sgBody"));
    btn.disabled = true; btn.textContent = "Sending…";
    try {
      await rpc("suggest_trip_change", { p_device: device, p_by: name.slice(0, 30), p_day: day.slice(0, 20), p_body: body.slice(0, 500) });
      store.set("jp-name", name);
      $("sgBody").value = "";
      btn.textContent = "Sent!";
      await load();
      setTimeout(() => { btn.textContent = "Send suggestion"; }, 1800);
    } catch (e2) {
      btn.textContent = "Send suggestion";
      say(/too many/i.test(String(e2 && e2.message)) ? "That's a lot of suggestions for one day. Try again tomorrow." : "Couldn't send that. Check your connection and try again.");
    } finally { btn.disabled = false; }
  });
  load();
})();
