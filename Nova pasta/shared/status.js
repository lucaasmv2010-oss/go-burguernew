"use strict";
(() => {
  const SUPABASE_URL = "https://ethlgaszdextwckdwgsf.supabase.co";
  const SUPABASE_KEY = "sb_publishable_qEhxWcCbekPjYFUW-EQ1ow_xccHG8aJ";
  const health = `${SUPABASE_URL}/functions/v1/go-burger-health`;
  const $ = s => document.querySelector(s);
  const set = (id, text, cls = "") => { const e = $(id); if (!e) return; e.textContent = text; e.className = cls; };
  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[char]);
  const when = value => { try { return new Date(value).toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"}); } catch { return "—"; } };

  async function loadIncidents() {
    const target = $("#statusIncidents");
    if (!target || !window.supabase?.createClient) return;
    try {
      const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false} });
      const { data, error } = await db.rpc("go_burger_incidentes_publicos_v31");
      if (error) throw error;
      const incidents = Array.isArray(data) ? data : [];
      if (!incidents.length) {
        target.innerHTML = '<article class="incident ok"><div class="incident-head"><strong>Nenhum incidente público ativo</strong><span class="pill">Operacional</span></div><p>A plataforma não possui incidentes públicos em andamento.</p></article>';
        return;
      }
      target.innerHTML = incidents.map(item => `
        <article class="incident">
          <div class="incident-head"><strong>${esc(item.titulo || "Incidente")}</strong><span class="pill">${esc(String(item.status || item.severidade || "em análise").replaceAll("_"," "))}</span></div>
          <p>${esc(item.impacto || item.descricao || "A equipe está acompanhando a ocorrência.")}</p>
          <small>Atualizado: ${esc(when(item.atualizado_em || item.criado_em))}</small>
        </article>`).join("");
    } catch (error) {
      console.warn("status incidents", error?.message || error);
      target.innerHTML = '<p>Não foi possível consultar o histórico de incidentes agora.</p>';
    }
  }

  async function refresh() {
    const b = $("#statusRefresh"); if (b) b.disabled = true;
    if (!navigator.onLine) { set("#statusHeadline","Seu aparelho está offline","offline"); set("#statusPlatform","Offline","offline"); set("#statusDatabase","—"); set("#statusLatency","—"); if (b) b.disabled=false; return; }
    const started = performance.now();
    try {
      const r = await fetch(health,{cache:"no-store",credentials:"omit"});
      const data = await r.json();
      const ok = r.ok && data.status === "ok";
      set("#statusHeadline",data.maintenance?"Go-burger em manutenção":ok?"Tudo operacional":"Serviço degradado",ok&&!data.maintenance?"ok":"degraded");
      set("#statusPlatform",ok?"Operacional":"Degradado",ok?"ok":"degraded");
      set("#statusDatabase",data.database==="ok"?"Operacional":"Falha",data.database==="ok"?"ok":"degraded");
      set("#statusLatency",`${Math.round(data.latency_ms ?? (performance.now()-started))} ms`);
      set("#statusChecked",`Atualizado ${new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}`);
      await loadIncidents();
    } catch {
      set("#statusHeadline","Não foi possível consultar o status","degraded"); set("#statusPlatform","Degradado","degraded"); set("#statusDatabase","—"); set("#statusLatency","—");
    } finally { if (b) b.disabled=false; }
  }
  $("#statusRefresh")?.addEventListener("click",refresh);
  window.addEventListener("online",refresh); window.addEventListener("offline",refresh);
  refresh(); setInterval(refresh,30000);
})();
