// Ema Wall data on the Claude dashboard: Claude pages can't reach Supabase directly, so the wall goes through
// the viewer's own Supabase connector (the owner's), calling the same safe ema_* database functions as the website.
// Everything a person types is sent base64-encoded and decoded inside the query, so it can never be read as SQL.
window.EMA_BACKEND = (() => {
  const SERVER = "Supabase", TOOL = "execute_sql", PROJECT = "qsztbfixleqhxovkfaeg";
  const SITE = "https://tehdean.github.io/Japan2026/";
  const BOARDS = ["wish", "book", "pack", "note"];
  let device = null;
  try { device = localStorage.getItem("jp-device-dash"); } catch {}
  if (!device || !/^[0-9a-f-]{36}$/.test(device)) {
    device = crypto.randomUUID ? crypto.randomUUID() : "00000000-0000-4000-8000-00000000da5b";
    try { localStorage.setItem("jp-device-dash", device); } catch {}
  }
  const mcpP = window.claude && window.claude.use ? window.claude.use("mcp") : Promise.resolve(null);
  const b64 = s => { const bytes = new TextEncoder().encode(String(s)); let bin = ""; bytes.forEach(c => bin += String.fromCharCode(c)); return btoa(bin); };
  const txt = s => `convert_from(decode('${b64(s)}', 'base64'), 'UTF8')`;
  const int = n => { n = Number(n); if (!Number.isInteger(n) || n <= 0) throw new Error("bad id"); return n; };

  const openSite = () => window.open(SITE, "_blank", "noopener");
  function friendly(e) {
    const code = e && e.code;
    const out = Object.assign(new Error((e && e.message) || "error"), { code });
    if (code === "needs_reauth") out.userMessage = "Your Supabase connection needs a refresh: reconnect Supabase in claude.ai Settings → Connectors.";
    else if (code === "server_not_connected" || code === "selection_required" || code === "server_not_found")
      out.userMessage = "The wall reads your Supabase connection. Add (or pick) the Supabase connector in claude.ai Settings → Connectors to see it here.";
    else if (code === "approval_required" || code === "not_in_manifest" || code === "consent_required") {
      out.userMessage = "The Ema Wall needs your OK to use your Supabase connection.";
      out.action = { label: "Allow it", run: () => window.EMA && EMA.show(true) };
    }
    else if (code === "blocked_by_policy") out.userMessage = "Your organization's settings block this connection here. The wall is on the website.";
    else if (code === "tool_error") out.userMessage = /Slow down/.test(e.message || "") ? "🦊 Whoa, slow down! Too many changes this hour." : "Supabase said no to that one. Try again in a moment.";
    else if (code === "server_unavailable" || code === "upstream_error") out.userMessage = "Supabase didn't answer just now. The wall will try again shortly.";
    else if (code === "not_granted" || code === "capability_disabled" || code === "capability_removed") {
      out.userMessage = "This view can't use your Supabase connection, so the wall lives on the website.";
      out.action = { label: "Open the website", run: openSite };
    }
    return out;
  }
  async function sql(query) {
    const mcp = await mcpP;
    if (!mcp) throw Object.assign(new Error("no mcp"), { userMessage: "This view can't use your Supabase connection, so the wall lives on the website.", action: { label: "Open the website", run: openSite } });
    let res;
    try { res = await mcp.callTool(SERVER, TOOL, { project_id: PROJECT, query }, { cache: false }); }
    catch (e) { throw friendly(e); }
    let p = res && res.payload;
    const text = typeof p === "string" ? p : p && typeof p.result === "string" ? p.result : JSON.stringify(p);
    const m = /<untrusted-data-[^>]*>\s*([\s\S]*?)\s*<\/untrusted-data/.exec(text);
    let rows;
    try { rows = JSON.parse(m ? m[1] : text); } catch { throw Object.assign(new Error("unreadable"), { userMessage: "Couldn't read the wall's answer just now." }); }
    if (!Array.isArray(rows)) throw Object.assign(new Error("unexpected"), { userMessage: "Couldn't read the wall's answer just now." });
    return rows[0] ? rows[0].v : null;
  }
  return {
    pollMs: 30000,
    async list() { return { notes: (await sql("select public.ema_list() as v")) || [] }; },
    add(author, board, body) {
      if (!BOARDS.includes(board)) throw new Error("bad board");
      return sql(`select public.ema_add('${device}'::uuid, ${txt(author)}, '${board}', ${txt(body)}) as v`);
    },
    edit: (id, body, author) => sql(`select public.ema_edit('${device}'::uuid, ${int(id)}, ${txt(body)}, ${txt(author)}) as v`),
    setDone: (id, done) => sql(`select public.ema_set_done('${device}'::uuid, ${int(id)}, ${done ? "true" : "false"}) as v`),
    remove: id => sql(`select public.ema_remove('${device}'::uuid, ${int(id)}) as v`),
    restore: id => sql(`select public.ema_restore('${device}'::uuid, ${int(id)}) as v`),
  };
})();
