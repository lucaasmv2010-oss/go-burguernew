"use strict";

(() => {
  const SUPABASE_URL = "https://ethlgaszdextwckdwgsf.supabase.co";
  const SUPABASE_KEY = "sb_publishable_qEhxWcCbekPjYFUW-EQ1ow_xccHG8aJ";
  const BUCKET = "go-burger-support";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const escapeHtml = value => String(value ?? "").replace(/[&<>'"]/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  })[char]);
  const money = value => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const dateTime = value => value
    ? new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
    : "—";

  let db = null;
  let currentUser = null;
  let storeId = 0;
  let tickets = [];
  let disputes = [];
  let fraud = [];
  let fraudSummary = {};
  let audit = [];
  let activeTab = "support";
  let activeDetail = null;
  let activeType = null;
  let refreshTimer = null;

  function toast(message, type = "success") {
    if (window.GoBurgerUI?.toast) {
      window.GoBurgerUI.toast(message, type);
      return;
    }
    const container = $("#toastContainer") || document.body;
    const node = document.createElement("div");
    node.className = `toast ${type}`;
    node.textContent = message;
    container.appendChild(node);
    setTimeout(() => node.remove(), 4200);
  }

  function badge(status) {
    const value = String(status || "").toLowerCase();
    const css = ["resolvido", "resolvida", "fechado", "aprovado"].includes(value)
      ? "green"
      : ["rejeitada", "cancelada", "bloqueado"].includes(value)
        ? "red"
        : ["em_atendimento", "em_analise", "monitorar"].includes(value)
          ? "blue"
          : "amber";
    return `<span class="gb31-badge ${css}">${escapeHtml(value.replaceAll("_", " ") || "—")}</span>`;
  }

  function emptyState(icon, title, text) {
    return `<div class="gb31-empty"><div><i class="fa-solid ${icon}"></i><strong>${escapeHtml(title)}</strong><p>${escapeHtml(text)}</p></div></div>`;
  }

  function getStoreId() {
    const select = $("#adminLojaSelect");
    const value = Number(select?.value || 0);
    if (value > 0) return value;

    const option = select?.querySelector("option:checked");
    return Number(option?.value || 0);
  }

  async function loadAll() {
    storeId = getStoreId();
    if (!storeId || !db) return;

    const [supportResult, disputeResult, fraudResult, fraudSummaryResult, auditResult] = await Promise.all([
      db.rpc("go_burger_suporte_listar_v31", { p_loja_id: storeId, p_status: null, p_limit: 150 }),
      db.rpc("go_burger_disputa_listar_v31", { p_loja_id: storeId, p_status: null, p_limit: 150 }),
      db.rpc("go_burger_fraude_listar_v31", { p_loja_id: storeId, p_nivel: null, p_status: null, p_limit: 120 }),
      db.rpc("go_burger_fraude_resumo_v31", { p_loja_id: storeId }),
      db.rpc("go_burger_auditoria_listar_v31", { p_loja_id: storeId, p_busca: null, p_limit: 180 })
    ]);

    if (supportResult.error) console.warn("Go-burger suporte admin", supportResult.error.message);
    if (disputeResult.error) console.warn("Go-burger disputas admin", disputeResult.error.message);
    if (fraudResult.error) console.warn("Go-burger antifraude admin", fraudResult.error.message);
    if (auditResult.error) console.warn("Go-burger auditoria admin", auditResult.error.message);

    tickets = Array.isArray(supportResult.data) ? supportResult.data : [];
    disputes = Array.isArray(disputeResult.data) ? disputeResult.data : [];
    fraud = Array.isArray(fraudResult.data) ? fraudResult.data : [];
    fraudSummary = fraudSummaryResult.data || {};
    audit = Array.isArray(auditResult.data) ? auditResult.data : [];

    renderSummary();
    renderCurrentTab();
  }

  function renderSummary() {
    const grid = $("#gb31AdminKpis");
    if (!grid) return;

    const supportOpen = tickets.filter(item => !["resolvido", "fechado"].includes(item.status)).length;
    const disputesOpen = disputes.filter(item => !["resolvida", "rejeitada", "cancelada"].includes(item.status)).length;
    const riskOpen = Number(fraudSummary.pendentes || 0);
    const late = tickets.filter(item => item.sla_status === "sla_estourado" || item.sla_status === "primeira_resposta_atrasada").length;

    grid.innerHTML = `
      <article class="gb31-kpi"><i class="fa-solid fa-headset"></i><small>Suporte aberto</small><strong>${supportOpen}</strong><span>${late} fora do SLA</span></article>
      <article class="gb31-kpi"><i class="fa-solid fa-scale-balanced"></i><small>Disputas ativas</small><strong>${disputesOpen}</strong><span>Pedidos em análise</span></article>
      <article class="gb31-kpi"><i class="fa-solid fa-shield-halved"></i><small>Risco pendente</small><strong>${riskOpen}</strong><span>${Number(fraudSummary.criticos || 0)} críticos</span></article>
      <article class="gb31-kpi"><i class="fa-solid fa-fingerprint"></i><small>Auditoria</small><strong>${audit.length}</strong><span>Eventos recentes carregados</span></article>
    `;

    const supportBadge = $("#gb31AdminSupportBadge");
    if (supportBadge) {
      supportBadge.textContent = String(supportOpen + disputesOpen + Number(fraudSummary.criticos || 0));
      supportBadge.classList.toggle("zero", Number(supportBadge.textContent) === 0);
    }
  }

  function setTab(tab) {
    activeTab = tab;
    activeDetail = null;
    activeType = null;
    $$('[data-gb31-admin-tab]').forEach(button => button.classList.toggle("active", button.dataset.gb31AdminTab === tab));
    renderCurrentTab();
  }

  function renderCurrentTab() {
    const content = $("#gb31AdminContent");
    if (!content) return;

    if (activeTab === "support") renderSupport(content);
    if (activeTab === "disputes") renderDisputes(content);
    if (activeTab === "fraud") renderFraud(content);
    if (activeTab === "audit") renderAudit(content);
  }

  function renderSupport(content) {
    content.innerHTML = `
      <div class="gb31-grid">
        <section class="gb31-panel">
          <div class="gb31-panel-head"><div><h3>Fila de atendimento</h3><small>Clientes vinculados à hamburgueria</small></div><select id="gb31AdminSupportFilter" aria-label="Filtrar chamados"><option value="">Todos</option><option value="aberto">Abertos</option><option value="em_atendimento">Em atendimento</option><option value="aguardando_usuario">Aguardando cliente</option><option value="resolvido">Resolvidos</option></select></div>
          <div class="gb31-list" id="gb31AdminSupportList"></div>
        </section>
        <section class="gb31-panel"><div class="gb31-detail" id="gb31AdminDetail">${emptyState("fa-comments", "Selecione um chamado", "A conversa e as ferramentas de atendimento aparecerão aqui.")}</div></section>
      </div>
    `;
    renderSupportList();
  }

  function renderSupportList(filter = "") {
    const list = $("#gb31AdminSupportList");
    if (!list) return;
    const rows = tickets.filter(item => !filter || item.status === filter);
    list.innerHTML = rows.length
      ? rows.map(item => `
          <button class="gb31-case" data-gb31-admin-ticket="${item.id}" type="button">
            <span class="gb31-case-icon"><i class="fa-solid fa-headset"></i></span>
            <span><strong>${escapeHtml(item.assunto)}</strong><small>${escapeHtml(item.protocolo)} · ${escapeHtml(item.usuario_nome || "Cliente")}</small><span style="display:flex;gap:5px;flex-wrap:wrap;margin-top:6px">${badge(item.status)}${item.sla_status === "sla_estourado" || item.sla_status === "primeira_resposta_atrasada" ? '<span class="gb31-badge red">SLA</span>' : ""}</span></span>
            <i class="fa-solid fa-chevron-right" style="margin-top:7px;color:#9c8a80"></i>
          </button>
        `).join("")
      : emptyState("fa-inbox", "Fila vazia", "Nenhum chamado corresponde ao filtro atual.");
  }

  async function openSupport(id) {
    const detail = $("#gb31AdminDetail");
    if (!detail) return;
    detail.innerHTML = emptyState("fa-spinner fa-spin", "Carregando atendimento", "Buscando histórico e anexos...");

    const result = await db.rpc("go_burger_suporte_detalhe_v31", { p_chamado_id: Number(id) });
    if (result.error) {
      detail.innerHTML = emptyState("fa-triangle-exclamation", "Falha ao abrir chamado", result.error.message);
      return;
    }

    activeDetail = result.data;
    activeType = "support";
    const ticket = result.data.chamado;
    const messages = result.data.mensagens || [];
    const attachments = result.data.anexos || [];
    const closed = ["resolvido", "fechado"].includes(ticket.status);

    detail.innerHTML = `
      <span class="gb31-eyebrow"><i class="fa-solid fa-headset"></i> ${escapeHtml(ticket.protocolo)}</span>
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap"><div><h3 style="margin:0;font-size:18px">${escapeHtml(ticket.assunto)}</h3><p style="margin:5px 0 0;color:var(--gb31-muted);font-size:9px">Atualizado ${dateTime(ticket.atualizado_em)}</p></div>${badge(ticket.status)}</div>
      <div class="gb31-meta"><span><i class="fa-solid fa-tag"></i>${escapeHtml(ticket.categoria)}</span><span><i class="fa-solid fa-gauge-high"></i>${escapeHtml(ticket.prioridade)}</span>${ticket.pedido_id ? `<span><i class="fa-solid fa-receipt"></i>Pedido #${ticket.pedido_id}</span>` : ""}<span><i class="fa-solid fa-clock"></i>Resolver até ${dateTime(ticket.resolucao_limite)}</span></div>
      <div class="gb31-thread">${renderMessages(messages)}</div>
      ${renderAttachments(attachments)}
      <form class="gb31-compose" id="gb31AdminSupportReply">
        <label class="gb31-field"><span>Responder ao cliente</span><textarea name="mensagem" maxlength="6000" required ${closed ? "disabled" : ""} placeholder="Escreva uma resposta objetiva e útil..."></textarea></label>
        <label style="display:flex;align-items:center;gap:8px;color:var(--gb31-muted);font-size:9px"><input name="interno" type="checkbox" ${closed ? "disabled" : ""}> Salvar como nota interna</label>
        <label class="gb31-field"><span>Anexo opcional</span><input name="anexo" type="file" accept="image/jpeg,image/png,image/webp,application/pdf,text/plain" ${closed ? "disabled" : ""}></label>
        <div style="display:flex;gap:7px;justify-content:flex-end;flex-wrap:wrap">
          ${closed ? "" : `<button class="gb31-btn secondary" data-gb31-support-status="resolvido" type="button"><i class="fa-solid fa-check"></i> Marcar resolvido</button><button class="gb31-btn" type="submit"><i class="fa-solid fa-reply"></i> Enviar</button>`}
        </div>
      </form>
    `;
  }

  function renderDisputes(content) {
    content.innerHTML = `
      <div class="gb31-grid">
        <section class="gb31-panel"><div class="gb31-panel-head"><div><h3>Disputas da loja</h3><small>Responda com contexto e evidências</small></div></div><div class="gb31-list" id="gb31AdminDisputeList"></div></section>
        <section class="gb31-panel"><div class="gb31-detail" id="gb31AdminDetail">${emptyState("fa-scale-balanced", "Selecione uma disputa", "A hamburgueria pode responder; a decisão final fica registrada pela plataforma.")}</div></section>
      </div>
    `;

    const list = $("#gb31AdminDisputeList");
    list.innerHTML = disputes.length
      ? disputes.map(item => `
          <button class="gb31-case" data-gb31-admin-dispute="${item.id}" type="button">
            <span class="gb31-case-icon"><i class="fa-solid fa-scale-balanced"></i></span>
            <span><strong>Pedido #${escapeHtml(item.numero_loja || item.pedido_id)}</strong><small>${escapeHtml(item.protocolo)} · ${escapeHtml(item.categoria)} · ${money(item.pedido_total)}</small><span style="margin-top:6px">${badge(item.status)}</span></span>
            <i class="fa-solid fa-chevron-right" style="margin-top:7px;color:#9c8a80"></i>
          </button>
        `).join("")
      : emptyState("fa-scale-balanced", "Nenhuma disputa", "A loja ainda não possui pedidos em contestação.");
  }

  async function openDispute(id) {
    const detail = $("#gb31AdminDetail");
    if (!detail) return;
    detail.innerHTML = emptyState("fa-spinner fa-spin", "Carregando disputa", "Buscando histórico do caso...");

    const result = await db.rpc("go_burger_disputa_detalhe_v31", { p_disputa_id: Number(id) });
    if (result.error) {
      detail.innerHTML = emptyState("fa-triangle-exclamation", "Falha ao abrir disputa", result.error.message);
      return;
    }

    activeDetail = result.data;
    activeType = "dispute";
    const dispute = result.data.disputa;
    const messages = result.data.mensagens || [];
    const attachments = result.data.anexos || [];
    const closed = ["resolvida", "rejeitada", "cancelada"].includes(dispute.status);

    detail.innerHTML = `
      <span class="gb31-eyebrow"><i class="fa-solid fa-scale-balanced"></i> ${escapeHtml(dispute.protocolo)}</span>
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap"><div><h3 style="margin:0;font-size:18px">Pedido #${escapeHtml(dispute.pedido_id)}</h3><p style="margin:5px 0 0;color:var(--gb31-muted);font-size:9px">${escapeHtml(dispute.categoria)} · prazo ${dateTime(dispute.prazo_resolucao)}</p></div>${badge(dispute.status)}</div>
      <div class="gb31-meta">${dispute.valor_solicitado != null ? `<span><i class="fa-solid fa-coins"></i>Solicitado ${money(dispute.valor_solicitado)}</span>` : ""}${dispute.valor_aprovado != null ? `<span><i class="fa-solid fa-check"></i>Aprovado ${money(dispute.valor_aprovado)}</span>` : ""}</div>
      <div class="gb31-thread">${renderMessages(messages)}</div>
      ${renderAttachments(attachments)}
      ${closed ? "" : `
        <form class="gb31-compose" id="gb31AdminDisputeReply">
          <label class="gb31-field"><span>Resposta da hamburgueria</span><textarea name="mensagem" maxlength="6000" required placeholder="Explique o que aconteceu e, se possível, proponha uma solução."></textarea></label>
          <label style="display:flex;align-items:center;gap:8px;color:var(--gb31-muted);font-size:9px"><input name="interno" type="checkbox"> Nota interna</label>
          <label class="gb31-field"><span>Evidência opcional</span><input name="anexo" type="file" accept="image/jpeg,image/png,image/webp,application/pdf,text/plain"></label>
          <div style="display:flex;justify-content:flex-end"><button class="gb31-btn" type="submit"><i class="fa-solid fa-reply"></i> Responder</button></div>
        </form>
      `}
    `;
  }

  function renderFraud(content) {
    content.innerHTML = `
      <div class="gb31-kpis" style="margin-bottom:14px">
        <article class="gb31-kpi"><i class="fa-solid fa-shield"></i><small>Análises</small><strong>${Number(fraudSummary.total || 0)}</strong><span>Pedidos avaliados</span></article>
        <article class="gb31-kpi"><i class="fa-solid fa-magnifying-glass"></i><small>Pendentes</small><strong>${Number(fraudSummary.pendentes || 0)}</strong><span>Precisam de decisão</span></article>
        <article class="gb31-kpi"><i class="fa-solid fa-triangle-exclamation"></i><small>Críticos</small><strong>${Number(fraudSummary.criticos || 0)}</strong><span>Score 80+</span></article>
        <article class="gb31-kpi"><i class="fa-solid fa-chart-simple"></i><small>Score médio</small><strong>${Number(fraudSummary.score_medio || 0).toFixed(1)}</strong><span>Risco médio da loja</span></article>
      </div>
      <div class="gb31-grid">
        <section class="gb31-panel"><div class="gb31-panel-head"><div><h3>Fila de risco</h3><small>Score é apoio à decisão, não prova de fraude</small></div><select id="gb31AdminFraudFilter"><option value="">Todos</option><option value="critico">Crítico</option><option value="alto">Alto</option><option value="medio">Médio</option><option value="baixo">Baixo</option></select></div><div class="gb31-list" id="gb31AdminFraudList"></div></section>
        <section class="gb31-panel"><div class="gb31-detail" id="gb31AdminDetail">${emptyState("fa-shield-halved", "Selecione uma análise", "Veja os fatores de risco e registre a revisão manual.")}</div></section>
      </div>
    `;
    renderFraudList();
  }

  function renderFraudList(level = "") {
    const list = $("#gb31AdminFraudList");
    if (!list) return;
    const rows = fraud.filter(item => !level || item.nivel === level);
    list.innerHTML = rows.length
      ? rows.map(item => {
          const color = item.nivel === "critico" ? "#c53c31" : item.nivel === "alto" ? "#d56a1f" : item.nivel === "medio" ? "#b68a16" : "#138a46";
          return `
            <button class="gb31-case" data-gb31-admin-fraud="${item.id}" type="button">
              <span class="gb31-score" style="--gb31-score:${Number(item.score || 0)};--gb31-score-color:${color}"><strong>${Number(item.score || 0)}</strong></span>
              <span><strong>Pedido #${escapeHtml(item.numero_loja || item.pedido_id)}</strong><small>${escapeHtml(item.cliente || "Cliente")} · ${money(item.total)} · ${escapeHtml(item.nivel)}</small><span style="margin-top:6px">${badge(item.status_revisao)}</span></span>
              <i class="fa-solid fa-chevron-right" style="margin-top:7px;color:#9c8a80"></i>
            </button>
          `;
        }).join("")
      : emptyState("fa-shield", "Sem análises", "Nenhum pedido corresponde ao filtro atual.");
  }

  function openFraud(id) {
    const detail = $("#gb31AdminDetail");
    if (!detail) return;
    const item = fraud.find(row => Number(row.id) === Number(id));
    if (!item) return;
    activeDetail = item;
    activeType = "fraud";
    const factors = Array.isArray(item.fatores) ? item.fatores : [];
    const color = item.nivel === "critico" ? "#c53c31" : item.nivel === "alto" ? "#d56a1f" : item.nivel === "medio" ? "#b68a16" : "#138a46";

    detail.innerHTML = `
      <span class="gb31-eyebrow"><i class="fa-solid fa-shield-halved"></i> ANÁLISE DE RISCO</span>
      <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">
        <span class="gb31-score" style="--gb31-score:${Number(item.score || 0)};--gb31-score-color:${color};width:74px;height:74px"><strong>${Number(item.score || 0)}</strong></span>
        <div><h3 style="margin:0;font-size:18px">Pedido #${escapeHtml(item.numero_loja || item.pedido_id)}</h3><p style="margin:5px 0;color:var(--gb31-muted);font-size:9px">${money(item.total)} · ${escapeHtml(item.forma_pagamento || "pagamento")}</p><div style="display:flex;gap:6px;flex-wrap:wrap">${badge(item.nivel)}${badge(item.status_revisao)}</div></div>
      </div>
      <div class="gb31-factors">${factors.length ? factors.map(factor => `<div class="gb31-factor"><span>${escapeHtml(factor.detalhe || factor.codigo)}</span><b>+${Number(factor.peso || 0)}</b></div>`).join("") : '<div class="gb31-factor"><span>Nenhum fator relevante detectado.</span><b>0</b></div>'}</div>
      <div class="gb31-incident" style="margin-top:14px"><span class="gb31-badge orange">IMPORTANTE</span><h4>Score é sinal, não sentença</h4><p>A Go-burger usa sinais operacionais para priorizar revisão. Não bloqueie um cliente apenas pelo score sem analisar contexto, histórico e pagamento.</p></div>
      <form class="gb31-compose" id="gb31AdminFraudReview">
        <label class="gb31-field"><span>Nota da revisão</span><textarea name="nota" maxlength="3000" placeholder="Registre o motivo da decisão..."></textarea></label>
        <div style="display:flex;gap:7px;justify-content:flex-end;flex-wrap:wrap"><button class="gb31-btn success" data-gb31-fraud-decision="aprovado" type="button"><i class="fa-solid fa-check"></i> Aprovar</button><button class="gb31-btn secondary" data-gb31-fraud-decision="monitorar" type="button"><i class="fa-solid fa-eye"></i> Monitorar</button><button class="gb31-btn danger" data-gb31-fraud-decision="bloqueado" type="button"><i class="fa-solid fa-ban"></i> Marcar risco</button></div>
      </form>
    `;
  }

  function renderAudit(content) {
    content.innerHTML = `
      <section class="gb31-panel">
        <div class="gb31-panel-head"><div><h3>Auditoria da hamburgueria</h3><small>Produtos, pedidos, configurações, cupons, equipe e eventos operacionais</small></div></div>
        <div class="gb31-toolbar" style="margin:10px"><label class="gb31-search"><i class="fa-solid fa-magnifying-glass"></i><input id="gb31AdminAuditSearch" type="search" placeholder="Buscar ação, entidade ou responsável..."></label><button class="gb31-btn secondary" id="gb31AdminAuditExport" type="button"><i class="fa-solid fa-file-csv"></i> Exportar CSV</button></div>
        <div id="gb31AdminAuditRows"></div>
      </section>
    `;
    renderAuditRows();
  }

  function renderAuditRows(query = "") {
    const target = $("#gb31AdminAuditRows");
    if (!target) return;
    const q = query.toLowerCase().trim();
    const rows = audit.filter(item => !q || `${item.acao} ${item.entidade_tipo} ${item.entidade_id} ${item.ator_nome || ""}`.toLowerCase().includes(q));
    target.innerHTML = rows.length
      ? rows.map(item => `
          <div class="gb31-audit-row"><span>${badge(item.acao)}</span><strong>${escapeHtml(item.entidade_tipo)}</strong><span>#${escapeHtml(item.entidade_id || "—")} · ${(item.campos_alterados || []).map(escapeHtml).join(", ") || "evento"}</span><span>${escapeHtml(item.ator_nome || item.ator_tipo || "Sistema")}</span><time>${dateTime(item.criado_em)}</time></div>
        `).join("")
      : emptyState("fa-fingerprint", "Nenhum evento", "Não há auditoria correspondente ao filtro.");
  }

  function renderMessages(messages) {
    if (!messages.length) return emptyState("fa-comment-slash", "Sem mensagens", "A conversa ainda não possui respostas.");
    return messages.map(message => {
      const mine = message.autor_id === currentUser?.id;
      return `<article class="gb31-message ${mine ? "mine" : ""} ${message.interno ? "internal" : ""}"><div class="gb31-message-head"><span>${mine ? "Você" : escapeHtml(message.autor_tipo)}${message.interno ? " · nota interna" : ""}</span><time>${dateTime(message.criado_em)}</time></div><p>${escapeHtml(message.mensagem)}</p></article>`;
    }).join("");
  }

  function renderAttachments(attachments) {
    if (!attachments.length) return "";
    return `<div class="gb31-file-row" style="margin-top:12px">${attachments.map(file => `<button class="gb31-file" data-gb31-admin-file="${escapeHtml(file.storage_path)}" type="button"><i class="fa-solid fa-paperclip"></i>${escapeHtml(file.nome)}</button>`).join("")}</div>`;
  }

  async function uploadSingle(kind, entityId, file) {
    if (!file || !currentUser) return;
    if (file.size > 10 * 1024 * 1024) throw new Error("O anexo deve ter no máximo 10 MB.");
    const safeName = file.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-160) || "arquivo";
    const path = `${kind}/${entityId}/${currentUser.id}/${crypto.randomUUID()}-${safeName}`;
    const upload = await db.storage.from(BUCKET).upload(path, file, { upsert: false, contentType: file.type || "application/octet-stream" });
    if (upload.error) throw upload.error;
    const register = await db.rpc("go_burger_anexo_registrar_v31", { p_entidade_tipo: kind, p_entidade_id: Number(entityId), p_storage_path: path, p_nome: file.name, p_mime: file.type || null, p_tamanho: file.size });
    if (register.error) throw register.error;
  }

  async function openAttachment(path) {
    const result = await db.storage.from(BUCKET).createSignedUrl(path, 180);
    if (result.error || !result.data?.signedUrl) return toast(result.error?.message || "Não foi possível abrir o anexo.", "error");
    window.open(result.data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function submitSupportReply(form) {
    if (!activeDetail?.chamado?.id) return;
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    try {
      const result = await db.rpc("go_burger_suporte_responder_v31", { p_chamado_id: Number(activeDetail.chamado.id), p_mensagem: String(form.elements.mensagem.value || "").trim(), p_interno: form.elements.interno.checked });
      if (result.error) throw result.error;
      await uploadSingle("suporte", activeDetail.chamado.id, form.elements.anexo.files?.[0]);
      form.reset();
      await loadAll();
      await openSupport(activeDetail.chamado.id);
    } catch (error) {
      toast(error.message || "Não foi possível responder.", "error");
    } finally {
      button.disabled = false;
    }
  }

  async function submitDisputeReply(form) {
    if (!activeDetail?.disputa?.id) return;
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    try {
      const result = await db.rpc("go_burger_disputa_responder_v31", { p_disputa_id: Number(activeDetail.disputa.id), p_mensagem: String(form.elements.mensagem.value || "").trim(), p_interno: form.elements.interno.checked });
      if (result.error) throw result.error;
      await uploadSingle("disputa", activeDetail.disputa.id, form.elements.anexo.files?.[0]);
      form.reset();
      await loadAll();
      await openDispute(activeDetail.disputa.id);
    } catch (error) {
      toast(error.message || "Não foi possível responder.", "error");
    } finally {
      button.disabled = false;
    }
  }

  async function updateSupportStatus(status) {
    if (!activeDetail?.chamado?.id) return;
    const result = await db.rpc("go_burger_suporte_atualizar_v31", { p_chamado_id: Number(activeDetail.chamado.id), p_status: status, p_prioridade: activeDetail.chamado.prioridade, p_atribuido_a: null, p_tags: null });
    if (result.error) return toast(result.error.message, "error");
    toast("Chamado atualizado.");
    await loadAll();
    await openSupport(activeDetail.chamado.id);
  }

  async function reviewFraud(decision) {
    if (!activeDetail?.id) return;
    const note = String($("#gb31AdminFraudReview")?.elements?.nota?.value || "").trim();
    const result = await db.rpc("go_burger_fraude_revisar_v31", { p_score_id: Number(activeDetail.id), p_decisao: decision, p_nota: note || null });
    if (result.error) return toast(result.error.message, "error");
    toast("Revisão antifraude registrada.");
    await loadAll();
    setTab("fraud");
  }

  function exportAudit() {
    const rows = [["data", "acao", "entidade", "id", "campos", "responsavel"], ...audit.map(item => [dateTime(item.criado_em), item.acao, item.entidade_tipo, item.entidade_id || "", (item.campos_alterados || []).join("|"), item.ator_nome || item.ator_tipo || "Sistema"])];
    const csv = rows.map(row => row.map(value => `"${String(value ?? "").replaceAll('"', '""')}"`).join(";")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `go-burger-auditoria-loja-${storeId}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function bind() {
    document.addEventListener("click", async event => {
      const tab = event.target.closest("[data-gb31-admin-tab]");
      if (tab) return setTab(tab.dataset.gb31AdminTab);

      const ticket = event.target.closest("[data-gb31-admin-ticket]");
      if (ticket) return openSupport(ticket.dataset.gb31AdminTicket);

      const dispute = event.target.closest("[data-gb31-admin-dispute]");
      if (dispute) return openDispute(dispute.dataset.gb31AdminDispute);

      const fraudItem = event.target.closest("[data-gb31-admin-fraud]");
      if (fraudItem) return openFraud(fraudItem.dataset.gb31AdminFraud);

      const decision = event.target.closest("[data-gb31-fraud-decision]");
      if (decision) return reviewFraud(decision.dataset.gb31FraudDecision);

      const status = event.target.closest("[data-gb31-support-status]");
      if (status) return updateSupportStatus(status.dataset.gb31SupportStatus);

      const file = event.target.closest("[data-gb31-admin-file]");
      if (file) return openAttachment(file.dataset.gb31AdminFile);

      if (event.target.closest("#gb31AdminRefresh")) await loadAll();
      if (event.target.closest("#gb31AdminAuditExport")) exportAudit();
    });

    document.addEventListener("change", event => {
      if (event.target.id === "gb31AdminSupportFilter") renderSupportList(event.target.value);
      if (event.target.id === "gb31AdminFraudFilter") renderFraudList(event.target.value);
      if (event.target.id === "adminLojaSelect") {
        clearTimeout(refreshTimer);
        refreshTimer = setTimeout(loadAll, 350);
      }
    });

    document.addEventListener("input", event => {
      if (event.target.id === "gb31AdminAuditSearch") renderAuditRows(event.target.value);
    });

    document.addEventListener("submit", async event => {
      if (event.target.id === "gb31AdminSupportReply") {
        event.preventDefault();
        await submitSupportReply(event.target);
      }
      if (event.target.id === "gb31AdminDisputeReply") {
        event.preventDefault();
        await submitDisputeReply(event.target);
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (!window.supabase?.createClient) return;
    db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true, storageKey: "go-burger-auth-v1" } });
    bind();

    setTimeout(async () => {
      const auth = await db.auth.getUser();
      currentUser = auth.data?.user || null;
      await loadAll();
    }, 1400);
  });
})();
