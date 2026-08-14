"use strict";

(() => {
  const SUPABASE_URL = "https://ethlgaszdextwckdwgsf.supabase.co";
  const SUPABASE_KEY = "sb_publishable_qEhxWcCbekPjYFUW-EQ1ow_xccHG8aJ";
  const BUCKET = "go-burger-support";
  const AUTH_KEY = "go-burger-auth-v1";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = value => String(value ?? "").replace(/[&<>'"]/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  })[char]);
  const dt = value => value ? new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";
  const money = value => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  let db = null;
  let user = null;
  let support = [];
  let disputes = [];
  let incidents = [];
  let audit = [];
  let fraud = [];
  let fraudSummary = {};
  let active = null;
  let activeType = null;
  let loading = false;
  let initialized = false;

  const labels = {
    aberto: "Aberto", em_atendimento: "Em atendimento", aguardando_usuario: "Aguardando usuário", resolvido: "Resolvido", fechado: "Fechado",
    aberta: "Aberta", em_analise: "Em análise", aguardando_cliente: "Aguardando cliente", aguardando_loja: "Aguardando loja", resolvida: "Resolvida",
    rejeitada: "Rejeitada", cancelada: "Cancelada", investigando: "Investigando", identificado: "Identificado", monitorando: "Monitorando",
    baixo: "Baixo", medio: "Médio", alto: "Alto", critico: "Crítico", pendente: "Pendente", aprovado: "Aprovado", bloqueado: "Bloqueado"
  };

  function label(value) {
    const key = String(value || "").toLowerCase();
    return labels[key] || String(value || "—").replaceAll("_", " ");
  }

  function badge(value) {
    const key = String(value || "").toLowerCase();
    let kind = "amber";
    if (["resolvido", "resolvida", "fechado", "aprovado", "baixo"].includes(key)) kind = "green";
    else if (["rejeitada", "cancelada", "bloqueado", "critico", "urgente"].includes(key)) kind = "red";
    else if (["em_atendimento", "em_analise", "monitorando", "alto"].includes(key)) kind = "blue";
    else if (["identificado", "medio"].includes(key)) kind = "orange";
    return `<span class="gb31-badge ${kind}">${esc(label(value))}</span>`;
  }

  function empty(icon, title, text) {
    return `<div class="gb31-empty"><i class="fa-solid ${icon}"></i><strong>${esc(title)}</strong><p>${esc(text)}</p></div>`;
  }

  function toast(message, type = "success") {
    const wrap = $("#saToastWrap");
    if (!wrap) return;
    const node = document.createElement("div");
    node.className = `sa-toast ${type}`;
    const icon = type === "error" ? "fa-triangle-exclamation" : type === "info" ? "fa-circle-info" : "fa-circle-check";
    node.innerHTML = `<span><i class="fa-solid ${icon}"></i></span><div><strong>${type === "error" ? "Atenção" : type === "info" ? "Go-burger" : "Concluído"}</strong><p>${esc(message)}</p></div>`;
    wrap.appendChild(node);
    setTimeout(() => node.remove(), 4400);
  }

  function setBadge(id, number) {
    const node = $(id);
    if (!node) return;
    const value = Number(number || 0);
    node.textContent = String(value);
    node.classList.toggle("zero", value === 0);
  }

  function ensureModal() {
    if ($("#gb31SuperModal")) return;
    document.body.insertAdjacentHTML("beforeend", `
      <div class="gb31-modal" id="gb31SuperModal" aria-hidden="true">
        <section class="gb31-modal-card" role="dialog" aria-modal="true" aria-labelledby="gb31SuperModalTitle">
          <header class="gb31-modal-head">
            <div><span class="gb31-eyebrow"><i class="fa-solid fa-shield-halved"></i> TRUST & SAFETY</span><h3 id="gb31SuperModalTitle">Central Go-burger</h3></div>
            <button class="gb31-close" id="gb31SuperModalClose" type="button" aria-label="Fechar"><i class="fa-solid fa-xmark"></i></button>
          </header>
          <div class="gb31-modal-body" id="gb31SuperModalBody"></div>
        </section>
      </div>
    `);
  }

  function openModal(title, html) {
    ensureModal();
    $("#gb31SuperModalTitle").textContent = title;
    $("#gb31SuperModalBody").innerHTML = html;
    $("#gb31SuperModal").classList.add("open");
    $("#gb31SuperModal").setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    $("#gb31SuperModal")?.classList.remove("open");
    $("#gb31SuperModal")?.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    active = null;
    activeType = null;
  }

  async function rpc(name, params = {}) {
    const result = await db.rpc(name, params);
    if (result.error) throw result.error;
    return result.data;
  }

  async function init() {
    if (initialized) return;
    if (!window.supabase?.createClient) return;
    db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: AUTH_KEY }
    });
    const session = await db.auth.getSession();
    user = session.data?.session?.user || null;
    if (!user) return;
    const check = await db.rpc("go_burger_e_super_admin");
    if (check.error || check.data !== true) return;
    initialized = true;
    ensureModal();
    bind();
    await loadAll(true);
  }

  async function loadAll(silent = false) {
    if (loading) return;
    loading = true;
    const refreshers = $$("[data-gb31-refresh]");
    refreshers.forEach(button => { button.disabled = true; button.classList.add("spinning"); });
    try {
      const [supportData, disputeData, incidentData, auditData, fraudData, summary] = await Promise.all([
        rpc("go_burger_suporte_listar_v31", { p_loja_id: null, p_status: null, p_limit: 300 }),
        rpc("go_burger_disputa_listar_v31", { p_loja_id: null, p_status: null, p_limit: 300 }),
        rpc("go_burger_incidentes_admin_v31", { p_limit: 200 }),
        rpc("go_burger_auditoria_listar_v31", { p_loja_id: null, p_busca: null, p_limit: 500 }),
        rpc("go_burger_fraude_listar_v31", { p_loja_id: null, p_nivel: null, p_status: null, p_limit: 300 }),
        rpc("go_burger_fraude_resumo_v31", { p_loja_id: null })
      ]);
      support = Array.isArray(supportData) ? supportData : [];
      disputes = Array.isArray(disputeData) ? disputeData : [];
      incidents = Array.isArray(incidentData) ? incidentData : [];
      audit = Array.isArray(auditData) ? auditData : [];
      fraud = Array.isArray(fraudData) ? fraudData : [];
      fraudSummary = summary || {};
      renderAll();
      updateBadges();
      if (!silent) toast("Central de confiança atualizada.", "info");
    } catch (error) {
      console.error("Go-burger Package 31 Super Admin", error);
      if (!silent) toast(error.message || "Não foi possível atualizar a Central de Confiança.", "error");
    } finally {
      loading = false;
      refreshers.forEach(button => { button.disabled = false; button.classList.remove("spinning"); });
    }
  }

  function updateBadges() {
    const openSupport = support.filter(item => !["resolvido", "fechado"].includes(item.status)).length;
    const openDisputes = disputes.filter(item => !["resolvida", "rejeitada", "cancelada"].includes(item.status)).length;
    const risk = fraud.filter(item => item.status_revisao === "pendente" && ["alto", "critico"].includes(item.nivel)).length;
    const activeIncidents = incidents.filter(item => item.status !== "resolvido").length;
    setBadge("#navSupportBadge", openSupport);
    setBadge("#gb31NavDisputesBadge", openDisputes);
    setBadge("#gb31NavFraudBadge", risk);
    setBadge("#gb31NavIncidentsBadge", activeIncidents);
  }

  function renderAll() {
    renderSupport();
    renderDisputes();
    renderIncidents();
    renderAudit();
    renderFraud();
  }

  function renderSupport() {
    const target = $("#gb31SuperSupport");
    if (!target) return;
    const q = String($("#gb31SuperSupportSearch")?.value || "").trim().toLowerCase();
    const status = $("#gb31SuperSupportStatus")?.value || "";
    const rows = support.filter(item => (!status || item.status === status) && (!q || `${item.protocolo} ${item.assunto} ${item.usuario_nome} ${item.usuario_email} ${item.loja_nome}`.toLowerCase().includes(q)));
    const overdue = support.filter(item => ["sla_estourado", "primeira_resposta_atrasada"].includes(item.sla_status)).length;
    const urgent = support.filter(item => item.prioridade === "urgente" && !["resolvido", "fechado"].includes(item.status)).length;
    target.innerHTML = `
      <div class="gb31-kpis">
        <article class="gb31-kpi"><i class="fa-solid fa-headset"></i><small>ABERTOS</small><strong>${support.filter(x => !["resolvido","fechado"].includes(x.status)).length}</strong><span>Chamados em andamento</span></article>
        <article class="gb31-kpi"><i class="fa-solid fa-clock"></i><small>SLA EM ATRASO</small><strong>${overdue}</strong><span>Precisam de atenção</span></article>
        <article class="gb31-kpi"><i class="fa-solid fa-triangle-exclamation"></i><small>URGENTES</small><strong>${urgent}</strong><span>Prioridade máxima</span></article>
        <article class="gb31-kpi"><i class="fa-solid fa-circle-check"></i><small>RESOLVIDOS</small><strong>${support.filter(x => x.status === "resolvido").length}</strong><span>Histórico disponível</span></article>
      </div>
      <div class="gb31-toolbar">
        <label class="gb31-search"><i class="fa-solid fa-magnifying-glass"></i><input id="gb31SuperSupportSearch" type="search" value="${esc($("#gb31SuperSupportSearch")?.value || "")}" placeholder="Protocolo, assunto, cliente ou loja..."></label>
        <select id="gb31SuperSupportStatus" aria-label="Filtrar suporte"><option value="">Todos os status</option>${["aberto","em_atendimento","aguardando_usuario","resolvido","fechado"].map(value => `<option value="${value}" ${status === value ? "selected" : ""}>${esc(label(value))}</option>`).join("")}</select>
        <button class="gb31-btn secondary" data-gb31-refresh type="button"><i class="fa-solid fa-rotate"></i> Atualizar</button>
      </div>
      <section class="gb31-panel"><div class="gb31-panel-head"><div><h3>Fila de atendimento</h3><small>${rows.length} chamado(s) no filtro atual</small></div></div><div>${rows.length ? rows.map(item => `
        <button class="gb31-case" data-gb31-super-support="${item.id}" type="button">
          <span class="gb31-case-icon"><i class="fa-solid fa-comments"></i></span>
          <span><strong>${esc(item.protocolo || `#${item.id}`)} · ${esc(item.assunto)}</strong><small>${esc(item.usuario_nome || item.usuario_email || "Usuário")} · ${esc(item.loja_nome || "Go-burger")} · ${dt(item.atualizado_em)}</small><span style="display:flex;gap:6px;flex-wrap:wrap;margin-top:7px">${badge(item.status)}${badge(item.prioridade)}${item.sla_status !== "no_prazo" && item.sla_status !== "concluido" ? '<span class="gb31-badge red">SLA</span>' : ""}</span></span>
          <i class="fa-solid fa-chevron-right" style="color:#a8978c;margin-top:8px"></i>
        </button>`).join("") : empty("fa-headset", "Fila limpa", "Nenhum chamado corresponde ao filtro atual.")}</div></section>
    `;
  }

  function renderDisputes() {
    const target = $("#gb31SuperDisputes");
    if (!target) return;
    const q = String($("#gb31SuperDisputeSearch")?.value || "").trim().toLowerCase();
    const status = $("#gb31SuperDisputeStatus")?.value || "";
    const rows = disputes.filter(item => (!status || item.status === status) && (!q || `${item.protocolo} ${item.numero_loja} ${item.usuario_nome} ${item.loja_nome} ${item.categoria}`.toLowerCase().includes(q)));
    target.innerHTML = `
      <div class="gb31-kpis">
        <article class="gb31-kpi"><i class="fa-solid fa-scale-balanced"></i><small>ATIVAS</small><strong>${disputes.filter(x => !["resolvida","rejeitada","cancelada"].includes(x.status)).length}</strong><span>Em análise ou aguardando</span></article>
        <article class="gb31-kpi"><i class="fa-solid fa-stopwatch"></i><small>FORA DO PRAZO</small><strong>${disputes.filter(x => !["resolvida","rejeitada","cancelada"].includes(x.status) && x.prazo_resolucao && new Date(x.prazo_resolucao) < new Date()).length}</strong><span>SLA de resolução vencido</span></article>
        <article class="gb31-kpi"><i class="fa-solid fa-money-bill-transfer"></i><small>VALOR SOLICITADO</small><strong style="font-size:18px">${money(disputes.filter(x => !["rejeitada","cancelada"].includes(x.status)).reduce((sum,x) => sum + Number(x.valor_solicitado || 0), 0))}</strong><span>Somatório informativo</span></article>
        <article class="gb31-kpi"><i class="fa-solid fa-check-double"></i><small>CONCLUÍDAS</small><strong>${disputes.filter(x => ["resolvida","rejeitada","cancelada"].includes(x.status)).length}</strong><span>Decisão registrada</span></article>
      </div>
      <div class="gb31-toolbar"><label class="gb31-search"><i class="fa-solid fa-magnifying-glass"></i><input id="gb31SuperDisputeSearch" type="search" value="${esc($("#gb31SuperDisputeSearch")?.value || "")}" placeholder="Protocolo, pedido, cliente ou loja..."></label><select id="gb31SuperDisputeStatus"><option value="">Todos os status</option>${["aberta","em_analise","aguardando_cliente","aguardando_loja","resolvida","rejeitada","cancelada"].map(value => `<option value="${value}" ${status === value ? "selected" : ""}>${esc(label(value))}</option>`).join("")}</select><button class="gb31-btn secondary" data-gb31-refresh type="button"><i class="fa-solid fa-rotate"></i> Atualizar</button></div>
      <section class="gb31-panel"><div class="gb31-panel-head"><div><h3>Disputas de pedidos</h3><small>Decisão final centralizada no Super Admin</small></div></div><div>${rows.length ? rows.map(item => `<button class="gb31-case" data-gb31-super-dispute="${item.id}" type="button"><span class="gb31-case-icon"><i class="fa-solid fa-scale-balanced"></i></span><span><strong>${esc(item.protocolo || `#${item.id}`)} · Pedido #${esc(item.numero_loja || item.pedido_id)}</strong><small>${esc(item.usuario_nome || "Cliente")} · ${esc(item.loja_nome || `Loja #${item.loja_id}`)} · ${money(item.pedido_total)}</small><span style="display:flex;gap:6px;flex-wrap:wrap;margin-top:7px">${badge(item.status)}<span class="gb31-badge orange">${esc(label(item.categoria))}</span></span></span><i class="fa-solid fa-chevron-right" style="color:#a8978c;margin-top:8px"></i></button>`).join("") : empty("fa-scale-balanced", "Sem disputas", "Nenhuma disputa corresponde ao filtro.")}</div></section>
    `;
  }

  function renderIncidents() {
    const target = $("#gb31SuperIncidents");
    if (!target) return;
    const activeIncidents = incidents.filter(item => item.status !== "resolvido");
    target.innerHTML = `
      <div class="gb31-hero"><div><span class="gb31-eyebrow"><i class="fa-solid fa-tower-broadcast"></i> STATUS & INCIDENTES</span><h2>Centro de incidentes</h2><p>Registre falhas, comunique impacto e mantenha uma linha do tempo pública ou interna. Incidentes públicos aparecem automaticamente na página de status.</p></div><div class="gb31-hero-actions"><button class="gb31-btn ghost" id="gb31NewIncident" type="button"><i class="fa-solid fa-plus"></i> Novo incidente</button><button class="gb31-btn ghost" data-gb31-refresh type="button"><i class="fa-solid fa-rotate"></i> Atualizar</button></div></div>
      <div class="gb31-kpis"><article class="gb31-kpi"><i class="fa-solid fa-triangle-exclamation"></i><small>ATIVOS</small><strong>${activeIncidents.length}</strong><span>Incidentes em andamento</span></article><article class="gb31-kpi"><i class="fa-solid fa-fire"></i><small>CRÍTICOS</small><strong>${activeIncidents.filter(x => x.severidade === "critica").length}</strong><span>Impacto máximo</span></article><article class="gb31-kpi"><i class="fa-solid fa-eye"></i><small>PÚBLICOS</small><strong>${activeIncidents.filter(x => x.publico).length}</strong><span>Visíveis no Status</span></article><article class="gb31-kpi"><i class="fa-solid fa-circle-check"></i><small>RESOLVIDOS</small><strong>${incidents.filter(x => x.status === "resolvido").length}</strong><span>Histórico recente</span></article></div>
      <section class="gb31-panel"><div class="gb31-panel-head"><div><h3>Linha do tempo operacional</h3><small>${incidents.length} incidente(s) registrado(s)</small></div></div><div style="padding:14px">${incidents.length ? incidents.map(item => `<article class="gb31-incident"><div style="display:flex;gap:7px;align-items:center;flex-wrap:wrap">${badge(item.status)}${badge(item.severidade)}${item.publico ? '<span class="gb31-badge blue">PÚBLICO</span>' : '<span class="gb31-badge dark">INTERNO</span>'}</div><h4>${esc(item.codigo)} · ${esc(item.titulo)}</h4><p>${esc(item.impacto || item.descricao || "Sem impacto descrito.")}</p><div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap"><small>${esc(label(item.escopo))} · iniciado ${dt(item.iniciou_em)}</small><button class="gb31-btn secondary" data-gb31-edit-incident="${item.id}" type="button"><i class="fa-solid fa-pen"></i> Atualizar</button></div></article>`).join("") : empty("fa-circle-check", "Tudo tranquilo", "Nenhum incidente foi registrado até agora.")}</div></section>
    `;
  }

  function renderAudit() {
    const target = $("#gb31SuperAudit");
    if (!target) return;
    const q = String($("#gb31SuperAuditSearch")?.value || "").trim().toLowerCase();
    const rows = audit.filter(item => !q || `${item.acao} ${item.entidade_tipo} ${item.entidade_id} ${item.ator_nome} ${item.loja_nome}`.toLowerCase().includes(q));
    target.innerHTML = `
      <div class="gb31-hero"><div><span class="gb31-eyebrow"><i class="fa-solid fa-fingerprint"></i> GOVERNANÇA</span><h2>Auditoria avançada</h2><p>Rastreabilidade de alterações em pedidos, produtos, cupons, configurações, equipe, assinaturas e pagamentos — sem registrar segredos ou dados de cartão.</p></div><div class="gb31-hero-actions"><button class="gb31-btn ghost" id="gb31SuperAuditExport" type="button"><i class="fa-solid fa-file-csv"></i> Exportar CSV</button><button class="gb31-btn ghost" data-gb31-refresh type="button"><i class="fa-solid fa-rotate"></i> Atualizar</button></div></div>
      <div class="gb31-toolbar"><label class="gb31-search"><i class="fa-solid fa-magnifying-glass"></i><input id="gb31SuperAuditSearch" type="search" value="${esc($("#gb31SuperAuditSearch")?.value || "")}" placeholder="Ação, entidade, responsável ou loja..."></label></div>
      <section class="gb31-panel"><div class="gb31-panel-head"><div><h3>Eventos auditáveis</h3><small>${rows.length} evento(s) no filtro atual</small></div></div><div>${rows.length ? rows.map(item => `<div class="gb31-audit-row"><span>${badge(item.acao)}</span><strong>${esc(item.entidade_tipo)}</strong><span>#${esc(item.entidade_id || "—")} · ${Array.isArray(item.campos_alterados) && item.campos_alterados.length ? item.campos_alterados.map(esc).join(", ") : "evento"}</span><span>${esc(item.ator_nome || item.ator_tipo || "Sistema")} · ${esc(item.loja_nome || "Plataforma")}</span><time>${dt(item.criado_em)}</time></div>`).join("") : empty("fa-fingerprint", "Sem eventos", "Nenhum evento auditável corresponde à busca.")}</div></section>
    `;
  }

  function renderFraud() {
    const target = $("#gb31SuperFraud");
    if (!target) return;
    const level = $("#gb31SuperFraudLevel")?.value || "";
    const status = $("#gb31SuperFraudStatus")?.value || "";
    const rows = fraud.filter(item => (!level || item.nivel === level) && (!status || item.status_revisao === status));
    target.innerHTML = `
      <div class="gb31-hero"><div><span class="gb31-eyebrow"><i class="fa-solid fa-shield-virus"></i> RISK CENTER</span><h2>Central antifraude</h2><p>Priorize análises com sinais de risco. O score é apenas apoio operacional: nenhuma pessoa deve ser punida automaticamente por uma pontuação isolada.</p></div><div class="gb31-hero-actions"><button class="gb31-btn ghost" data-gb31-refresh type="button"><i class="fa-solid fa-rotate"></i> Recalcular fila</button></div></div>
      <div class="gb31-kpis"><article class="gb31-kpi"><i class="fa-solid fa-list-check"></i><small>PENDENTES</small><strong>${Number(fraudSummary.pendentes || 0)}</strong><span>Aguardando revisão humana</span></article><article class="gb31-kpi"><i class="fa-solid fa-fire"></i><small>CRÍTICOS</small><strong>${Number(fraudSummary.criticos || 0)}</strong><span>Score ≥ 80</span></article><article class="gb31-kpi"><i class="fa-solid fa-triangle-exclamation"></i><small>ALTOS</small><strong>${Number(fraudSummary.altos || 0)}</strong><span>Score 60–79</span></article><article class="gb31-kpi"><i class="fa-solid fa-chart-simple"></i><small>SCORE MÉDIO</small><strong>${Number(fraudSummary.score_medio || 0).toLocaleString("pt-BR")}</strong><span>Base analisada</span></article></div>
      <div class="gb31-toolbar"><select id="gb31SuperFraudLevel"><option value="">Todos os níveis</option>${["critico","alto","medio","baixo"].map(value => `<option value="${value}" ${level === value ? "selected" : ""}>${esc(label(value))}</option>`).join("")}</select><select id="gb31SuperFraudStatus"><option value="">Todas as revisões</option>${["pendente","aprovado","monitorar","bloqueado"].map(value => `<option value="${value}" ${status === value ? "selected" : ""}>${esc(label(value))}</option>`).join("")}</select></div>
      <section class="gb31-panel"><div class="gb31-panel-head"><div><h3>Fila de risco</h3><small>${rows.length} análise(s)</small></div></div><div>${rows.length ? rows.map(item => { const color = item.nivel === "critico" ? "#c53c31" : item.nivel === "alto" ? "#d56a1f" : item.nivel === "medio" ? "#b68a16" : "#138a46"; return `<button class="gb31-case" data-gb31-super-fraud="${item.id}" type="button"><span class="gb31-score" style="--gb31-score:${Number(item.score || 0)};--gb31-score-color:${color}"><strong>${Number(item.score || 0)}</strong></span><span><strong>Pedido #${esc(item.numero_loja || item.pedido_id)} · ${esc(item.loja_nome || `Loja #${item.loja_id}`)}</strong><small>${esc(item.cliente || "Cliente")} · ${money(item.total)} · ${esc(item.forma_pagamento || "pagamento")}</small><span style="display:flex;gap:6px;flex-wrap:wrap;margin-top:7px">${badge(item.nivel)}${badge(item.status_revisao)}</span></span><i class="fa-solid fa-chevron-right" style="color:#a8978c;margin-top:8px"></i></button>`; }).join("") : empty("fa-shield", "Fila vazia", "Nenhuma análise corresponde ao filtro.")}</div></section>
    `;
  }

  async function openSupport(id) {
    try {
      const data = await rpc("go_burger_suporte_detalhe_v31", { p_chamado_id: Number(id) });
      active = data;
      activeType = "support";
      const s = data.chamado || {};
      openModal(`${s.protocolo || `Chamado #${id}`} · ${s.assunto || "Suporte"}`, `
        <div style="display:flex;gap:7px;flex-wrap:wrap">${badge(s.status)}${badge(s.prioridade)}</div>
        <div class="gb31-conversation">${renderMessages(data.mensagens || [])}</div>
        ${renderAttachments(data.anexos || [])}
        <form class="gb31-compose" id="gb31SuperSupportReply">
          <label class="gb31-field"><span>Responder</span><textarea name="mensagem" required maxlength="6000" placeholder="Escreva uma resposta clara e objetiva..."></textarea></label>
          <label class="gb31-field"><span>Anexo opcional</span><input name="anexo" type="file" accept="image/jpeg,image/png,image/webp,application/pdf,text/plain"></label>
          <label style="display:flex;align-items:center;gap:7px;font-size:10px"><input name="interno" type="checkbox"> Nota interna — invisível para o usuário</label>
          <div style="display:flex;gap:7px;justify-content:flex-end;flex-wrap:wrap"><button class="gb31-btn secondary" data-gb31-support-status="em_atendimento" type="button">Em atendimento</button><button class="gb31-btn success" data-gb31-support-status="resolvido" type="button"><i class="fa-solid fa-check"></i> Resolver</button><button class="gb31-btn" type="submit"><i class="fa-solid fa-paper-plane"></i> Enviar</button></div>
        </form>
      `);
    } catch (error) { toast(error.message, "error"); }
  }

  async function openDispute(id) {
    try {
      const data = await rpc("go_burger_disputa_detalhe_v31", { p_disputa_id: Number(id) });
      active = data;
      activeType = "dispute";
      const d = data.disputa || {};
      openModal(`${d.protocolo || `Disputa #${id}`} · Pedido #${d.pedido_id}`, `
        <div style="display:flex;gap:7px;flex-wrap:wrap">${badge(d.status)}${badge(d.prioridade)}<span class="gb31-badge orange">${esc(label(d.categoria))}</span></div>
        <div class="gb31-panel" style="padding:14px;margin-top:12px"><small>RELATO</small><p style="font-size:11px;line-height:1.65">${esc(d.descricao)}</p><strong>Solicitado: ${d.valor_solicitado == null ? "não informado" : money(d.valor_solicitado)}</strong></div>
        <div class="gb31-conversation">${renderMessages(data.mensagens || [])}</div>
        ${renderAttachments(data.anexos || [])}
        <form class="gb31-compose" id="gb31SuperDisputeReply"><label class="gb31-field"><span>Mensagem</span><textarea name="mensagem" required maxlength="6000" placeholder="Solicite informações ou atualize as partes..."></textarea></label><label style="display:flex;align-items:center;gap:7px;font-size:10px"><input name="interno" type="checkbox"> Nota interna</label><button class="gb31-btn" type="submit"><i class="fa-solid fa-paper-plane"></i> Enviar atualização</button></form>
        <form class="gb31-compose" id="gb31SuperDisputeResolution" style="margin-top:14px"><div class="gb31-form-grid"><label class="gb31-field"><span>Decisão</span><select name="decisao"><option value="resolvida">Resolver</option><option value="rejeitada">Rejeitar</option><option value="cancelada">Cancelar</option></select></label><label class="gb31-field"><span>Tipo</span><select name="tipo"><option value="sem_acao">Sem ação financeira</option><option value="reembolso_parcial">Reembolso parcial</option><option value="reembolso_total">Reembolso total</option><option value="credito">Crédito</option><option value="cupom">Cupom</option><option value="outro">Outro</option></select></label><label class="gb31-field"><span>Valor aprovado</span><input name="valor" type="number" min="0" step="0.01"></label></div><label class="gb31-field"><span>Fundamentação / resolução</span><textarea name="texto" maxlength="6000" placeholder="Registre de forma objetiva como a disputa foi concluída..."></textarea></label><div class="gb31-incident"><span class="gb31-badge orange">ATENÇÃO</span><h4>Reembolso não é fingido</h4><p>Ao escolher reembolso, a Go-burger registra a decisão e cria alerta operacional. O estorno no gateway continua sujeito à confirmação do provedor.</p></div><button class="gb31-btn success" type="submit"><i class="fa-solid fa-scale-balanced"></i> Registrar decisão final</button></form>
      `);
    } catch (error) { toast(error.message, "error"); }
  }

  async function openFraud(id) {
    const item = fraud.find(row => Number(row.id) === Number(id));
    if (!item) return;
    active = item;
    activeType = "fraud";
    const factors = Array.isArray(item.fatores) ? item.fatores : [];
    const color = item.nivel === "critico" ? "#c53c31" : item.nivel === "alto" ? "#d56a1f" : item.nivel === "medio" ? "#b68a16" : "#138a46";
    openModal(`Risco · Pedido #${item.numero_loja || item.pedido_id}`, `
      <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap"><span class="gb31-score" style="--gb31-score:${Number(item.score || 0)};--gb31-score-color:${color};width:82px;height:82px"><strong>${Number(item.score || 0)}</strong></span><div><span class="gb31-eyebrow">${esc(item.loja_nome || `Loja #${item.loja_id}`)}</span><h3 style="margin:0;font-size:18px">${money(item.total)} · ${esc(item.forma_pagamento || "pagamento")}</h3><div style="display:flex;gap:6px;margin-top:7px">${badge(item.nivel)}${badge(item.status_revisao)}</div></div></div>
      <div class="gb31-factors">${factors.length ? factors.map(f => `<div class="gb31-factor"><span>${esc(f.detalhe || f.codigo)}</span><b>+${Number(f.peso || 0)}</b></div>`).join("") : '<div class="gb31-factor"><span>Nenhum fator relevante detectado.</span><b>0</b></div>'}</div>
      <div class="gb31-incident"><span class="gb31-badge blue">REVISÃO HUMANA</span><h4>Use contexto antes da decisão</h4><p>O score organiza a fila; não comprova fraude. Confira histórico, pagamento e contexto antes de marcar risco.</p></div>
      <form class="gb31-compose" id="gb31SuperFraudReview"><label class="gb31-field"><span>Nota da revisão</span><textarea name="nota" maxlength="3000" placeholder="Justifique a decisão..."></textarea></label><div style="display:flex;gap:7px;justify-content:flex-end;flex-wrap:wrap"><button class="gb31-btn success" data-gb31-fraud-decision="aprovado" type="button">Aprovar</button><button class="gb31-btn secondary" data-gb31-fraud-decision="monitorar" type="button">Monitorar</button><button class="gb31-btn danger" data-gb31-fraud-decision="bloqueado" type="button">Marcar risco</button></div></form>
    `);
  }

  function openIncidentForm(id = null) {
    const item = id ? incidents.find(row => Number(row.id) === Number(id)) : null;
    active = item;
    activeType = "incident";
    openModal(item ? `Atualizar ${item.codigo}` : "Novo incidente", `
      <form class="gb31-compose" id="gb31IncidentForm"><input name="id" type="hidden" value="${item?.id || ""}"><div class="gb31-form-grid"><label class="gb31-field"><span>Título</span><input name="titulo" required maxlength="180" value="${esc(item?.titulo || "")}"></label><label class="gb31-field"><span>Severidade</span><select name="severidade">${["menor","moderada","maior","critica"].map(v => `<option value="${v}" ${item?.severidade === v ? "selected" : ""}>${esc(label(v))}</option>`).join("")}</select></label><label class="gb31-field"><span>Status</span><select name="status">${["investigando","identificado","monitorando","resolvido"].map(v => `<option value="${v}" ${item?.status === v ? "selected" : ""}>${esc(label(v))}</option>`).join("")}</select></label><label class="gb31-field"><span>Escopo</span><select name="escopo">${["plataforma","pagamentos","pedidos","entregas","notificacoes","autenticacao","banco","outro"].map(v => `<option value="${v}" ${item?.escopo === v ? "selected" : ""}>${esc(label(v))}</option>`).join("")}</select></label></div><label class="gb31-field"><span>Descrição técnica</span><textarea name="descricao" required maxlength="6000">${esc(item?.descricao || "")}</textarea></label><label class="gb31-field"><span>Impacto para usuários</span><textarea name="impacto" maxlength="3000">${esc(item?.impacto || "")}</textarea></label><label class="gb31-field"><span>Atualização da linha do tempo</span><textarea name="atualizacao" maxlength="3000" placeholder="Ex.: Identificamos a causa e estamos aplicando a correção..."></textarea></label><label style="display:flex;align-items:center;gap:7px;font-size:10px"><input name="publico" type="checkbox" ${item?.publico === false ? "" : "checked"}> Mostrar na página pública de status</label><button class="gb31-btn" type="submit"><i class="fa-solid fa-cloud-arrow-up"></i> ${item ? "Salvar atualização" : "Criar incidente"}</button></form>
    `);
  }

  function renderMessages(messages) {
    if (!messages.length) return empty("fa-comment-slash", "Sem mensagens", "A conversa ainda não possui respostas.");
    return messages.map(message => `<article class="gb31-message ${message.autor_id === user?.id ? "mine" : ""} ${message.interno ? "internal" : ""}"><div class="gb31-message-head"><span>${message.autor_id === user?.id ? "Você" : esc(label(message.autor_tipo))}${message.interno ? " · nota interna" : ""}</span><time>${dt(message.criado_em)}</time></div><p>${esc(message.mensagem)}</p></article>`).join("");
  }

  function renderAttachments(files) {
    if (!files.length) return "";
    return `<div class="gb31-file-row" style="margin-top:12px">${files.map(file => `<button class="gb31-file" data-gb31-super-file="${esc(file.storage_path)}" type="button"><i class="fa-solid fa-paperclip"></i>${esc(file.nome)}</button>`).join("")}</div>`;
  }

  async function upload(kind, entityId, file) {
    if (!file || !user) return;
    if (file.size > 10 * 1024 * 1024) throw new Error("O anexo deve ter no máximo 10 MB.");
    const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf", "text/plain"];
    if (file.type && !allowed.includes(file.type)) throw new Error("Formato de anexo não permitido.");
    const safeName = file.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-160) || "arquivo";
    const path = `${kind}/${entityId}/${user.id}/${crypto.randomUUID()}-${safeName}`;
    const uploaded = await db.storage.from(BUCKET).upload(path, file, { upsert: false, contentType: file.type || "application/octet-stream" });
    if (uploaded.error) throw uploaded.error;
    const registered = await db.rpc("go_burger_anexo_registrar_v31", { p_entidade_tipo: kind, p_entidade_id: Number(entityId), p_storage_path: path, p_nome: file.name, p_mime: file.type || null, p_tamanho: file.size });
    if (registered.error) throw registered.error;
  }

  async function openAttachment(path) {
    const result = await db.storage.from(BUCKET).createSignedUrl(path, 180);
    if (result.error || !result.data?.signedUrl) throw result.error || new Error("Não foi possível abrir o anexo.");
    window.open(result.data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function saveIncident(form) {
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    try {
      const data = await rpc("go_burger_incidente_salvar_v31", {
        p_id: form.elements.id.value ? Number(form.elements.id.value) : null,
        p_titulo: String(form.elements.titulo.value || "").trim(),
        p_severidade: form.elements.severidade.value,
        p_status: form.elements.status.value,
        p_escopo: form.elements.escopo.value,
        p_descricao: String(form.elements.descricao.value || "").trim(),
        p_impacto: String(form.elements.impacto.value || "").trim() || null,
        p_publico: form.elements.publico.checked,
        p_atualizacao: String(form.elements.atualizacao.value || "").trim() || null
      });
      toast(data?.codigo ? `Incidente ${data.codigo} salvo.` : "Incidente salvo.");
      closeModal();
      await loadAll(true);
    } catch (error) { toast(error.message, "error"); }
    finally { button.disabled = false; }
  }

  async function submitSupport(form) {
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    try {
      await rpc("go_burger_suporte_responder_v31", { p_chamado_id: Number(active.chamado.id), p_mensagem: String(form.elements.mensagem.value || "").trim(), p_interno: form.elements.interno.checked });
      await upload("suporte", active.chamado.id, form.elements.anexo.files?.[0]);
      toast("Resposta registrada.");
      await loadAll(true);
      await openSupport(active.chamado.id);
    } catch (error) { toast(error.message, "error"); }
    finally { button.disabled = false; }
  }

  async function submitDispute(form) {
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    try {
      await rpc("go_burger_disputa_responder_v31", { p_disputa_id: Number(active.disputa.id), p_mensagem: String(form.elements.mensagem.value || "").trim(), p_interno: form.elements.interno.checked });
      toast("Atualização enviada.");
      await loadAll(true);
      await openDispute(active.disputa.id);
    } catch (error) { toast(error.message, "error"); }
    finally { button.disabled = false; }
  }

  async function resolveDispute(form) {
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    try {
      await rpc("go_burger_disputa_resolver_v31", { p_disputa_id: Number(active.disputa.id), p_decisao: form.elements.decisao.value, p_resolucao_tipo: form.elements.tipo.value, p_resolucao_texto: String(form.elements.texto.value || "").trim() || null, p_valor_aprovado: form.elements.valor.value ? Number(form.elements.valor.value) : null });
      toast("Decisão final registrada.");
      closeModal();
      await loadAll(true);
    } catch (error) { toast(error.message, "error"); }
    finally { button.disabled = false; }
  }

  async function reviewFraud(decision) {
    const note = String($("#gb31SuperFraudReview")?.elements?.nota?.value || "").trim();
    try {
      await rpc("go_burger_fraude_revisar_v31", { p_score_id: Number(active.id), p_decisao: decision, p_nota: note || null });
      toast("Revisão antifraude registrada.");
      closeModal();
      await loadAll(true);
    } catch (error) { toast(error.message, "error"); }
  }

  async function updateSupportStatus(status) {
    try {
      await rpc("go_burger_suporte_atualizar_v31", { p_chamado_id: Number(active.chamado.id), p_status: status, p_prioridade: active.chamado.prioridade, p_atribuido_a: null, p_tags: null });
      toast("Chamado atualizado.");
      await loadAll(true);
      await openSupport(active.chamado.id);
    } catch (error) { toast(error.message, "error"); }
  }

  function exportAudit() {
    const header = ["data", "acao", "entidade", "id", "responsavel", "loja", "campos"];
    const rows = audit.map(item => [item.criado_em, item.acao, item.entidade_tipo, item.entidade_id, item.ator_nome || item.ator_tipo, item.loja_nome || "Plataforma", (item.campos_alterados || []).join("|")]);
    const csv = [header, ...rows].map(row => row.map(value => `"${String(value ?? "").replaceAll('"', '""')}"`).join(";")).join("\n");
    const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `go-burger-auditoria-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function bind() {
    document.addEventListener("click", async event => {
      const button = event.target.closest("button,a");
      if (!button) return;
      if (button.id === "gb31SuperModalClose" || button === $("#gb31SuperModal")) { closeModal(); return; }
      if (button.matches("[data-gb31-refresh]")) { await loadAll(); return; }
      if (button.dataset.gb31SuperSupport) { await openSupport(button.dataset.gb31SuperSupport); return; }
      if (button.dataset.gb31SuperDispute) { await openDispute(button.dataset.gb31SuperDispute); return; }
      if (button.dataset.gb31SuperFraud) { openFraud(button.dataset.gb31SuperFraud); return; }
      if (button.dataset.gb31EditIncident) { openIncidentForm(button.dataset.gb31EditIncident); return; }
      if (button.id === "gb31NewIncident") { openIncidentForm(); return; }
      if (button.dataset.gb31SupportStatus) { await updateSupportStatus(button.dataset.gb31SupportStatus); return; }
      if (button.dataset.gb31FraudDecision) { await reviewFraud(button.dataset.gb31FraudDecision); return; }
      if (button.dataset.gb31SuperFile) { try { await openAttachment(button.dataset.gb31SuperFile); } catch (error) { toast(error.message, "error"); } return; }
      if (button.id === "gb31SuperAuditExport") { exportAudit(); return; }
    });

    document.addEventListener("submit", async event => {
      if (event.target.id === "gb31SuperSupportReply") { event.preventDefault(); await submitSupport(event.target); }
      else if (event.target.id === "gb31SuperDisputeReply") { event.preventDefault(); await submitDispute(event.target); }
      else if (event.target.id === "gb31SuperDisputeResolution") { event.preventDefault(); await resolveDispute(event.target); }
      else if (event.target.id === "gb31IncidentForm") { event.preventDefault(); await saveIncident(event.target); }
    });

    document.addEventListener("input", event => {
      if (event.target.id === "gb31SuperSupportSearch") renderSupport();
      if (event.target.id === "gb31SuperDisputeSearch") renderDisputes();
      if (event.target.id === "gb31SuperAuditSearch") renderAudit();
    });
    document.addEventListener("change", event => {
      if (event.target.id === "gb31SuperSupportStatus") renderSupport();
      if (event.target.id === "gb31SuperDisputeStatus") renderDisputes();
      if (["gb31SuperFraudLevel", "gb31SuperFraudStatus"].includes(event.target.id)) renderFraud();
    });
    document.addEventListener("keydown", event => { if (event.key === "Escape" && $("#gb31SuperModal")?.classList.contains("open")) closeModal(); });
  }

  document.addEventListener("DOMContentLoaded", init, { once: true });
  document.addEventListener("go-burger-super-aal2-ready", () => { void init(); });
})();
