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
  const money = value => Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
  const dateTime = value => value
    ? new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
    : "—";

  let db = null;
  let currentUser = null;
  let tickets = [];
  let disputes = [];
  let orders = [];
  let activeTab = "tickets";
  let activeEntity = null;
  let activeType = null;

  const statusLabel = status => ({
    aberto: "Aberto",
    em_atendimento: "Em atendimento",
    aguardando_usuario: "Aguardando você",
    resolvido: "Resolvido",
    fechado: "Fechado",
    aberta: "Aberta",
    em_analise: "Em análise",
    aguardando_cliente: "Aguardando você",
    aguardando_loja: "Aguardando loja",
    resolvida: "Resolvida",
    rejeitada: "Rejeitada",
    cancelada: "Cancelada"
  })[String(status || "").toLowerCase()] || String(status || "—").replaceAll("_", " ");

  const badgeClass = status => {
    const value = String(status || "").toLowerCase();
    if (["resolvido", "resolvida", "fechado"].includes(value)) return "green";
    if (["rejeitada", "cancelada"].includes(value)) return "red";
    if (["em_atendimento", "em_analise"].includes(value)) return "blue";
    return "amber";
  };

  function toast(message, type = "success") {
    if (window.GoBurgerUI?.toast) {
      window.GoBurgerUI.toast(message, type);
      return;
    }

    const node = document.createElement("div");
    node.textContent = message;
    node.style.cssText = [
      "position:fixed",
      "right:18px",
      "bottom:145px",
      "z-index:12000",
      "max-width:360px",
      "padding:12px 15px",
      "border-radius:13px",
      `background:${type === "error" ? "#a8322b" : "#20140f"}`,
      "color:#fff",
      "font:700 11px/1.45 'Plus Jakarta Sans',sans-serif",
      "box-shadow:0 18px 50px rgba(0,0,0,.22)"
    ].join(";");
    document.body.appendChild(node);
    setTimeout(() => node.remove(), 4200);
  }

  function injectEntryPoints() {
    if (!$("#gb31SupportFloat")) {
      document.body.insertAdjacentHTML("beforeend", `
        <button class="gb31-floating-support" id="gb31SupportFloat" type="button" aria-label="Abrir suporte Go-burger">
          <i class="fa-solid fa-headset" aria-hidden="true"></i>
          <span>Ajuda & suporte</span>
        </button>
      `);
    }

    const profileGrid = $(".profile-grid");
    if (profileGrid && !$("#gb31ProfileSupportCard")) {
      profileGrid.insertAdjacentHTML("beforeend", `
        <article class="gb31-panel gb31-profile-card" id="gb31ProfileSupportCard" style="padding:18px">
          <span class="gb31-eyebrow"><i class="fa-solid fa-shield-heart"></i> SUPORTE Go-burger</span>
          <h3 style="margin:0;color:var(--gb31-ink);font-size:17px">Precisou de ajuda?</h3>
          <p style="margin:7px 0 14px;color:var(--gb31-muted);font-size:10px;line-height:1.6">Abra chamados, acompanhe respostas e registre uma disputa vinculada ao pedido sem sair do aplicativo.</p>
          <button class="gb31-btn" id="gb31ProfileSupportButton" type="button"><i class="fa-solid fa-comments"></i> Abrir Central de Suporte</button>
        </article>
      `);
    }
  }

  function injectModal() {
    if ($("#gb31ClientModal")) return;

    document.body.insertAdjacentHTML("beforeend", `
      <div class="gb31-modal" id="gb31ClientModal" aria-hidden="true">
        <section class="gb31-modal-card" role="dialog" aria-modal="true" aria-labelledby="gb31ClientModalTitle">
          <header class="gb31-modal-head">
            <div>
              <span class="gb31-eyebrow"><i class="fa-solid fa-shield-heart"></i> CENTRAL DE CONFIANÇA</span>
              <h3 id="gb31ClientModalTitle">Suporte Go-burger</h3>
            </div>
            <button class="gb31-close" id="gb31ClientClose" type="button" aria-label="Fechar suporte"><i class="fa-solid fa-xmark"></i></button>
          </header>
          <div class="gb31-modal-body">
            <div class="gb31-tabbar" id="gb31ClientTabs" aria-label="Seções do suporte">
              <button class="active" data-gb31-tab="tickets" type="button">Chamados</button>
              <button data-gb31-tab="disputes" type="button">Disputas</button>
              <button data-gb31-tab="new-ticket" type="button">Novo chamado</button>
              <button data-gb31-tab="new-dispute" type="button">Nova disputa</button>
            </div>
            <div id="gb31ClientContent" style="margin-top:14px"></div>
          </div>
        </section>
      </div>
    `);
  }

  async function requireUser() {
    if (!db) return false;
    const { data } = await db.auth.getUser();
    currentUser = data?.user || null;
    if (currentUser) return true;

    toast("Entre na sua conta para usar a Central de Suporte.", "info");
    const profileButton = $('[data-page="perfil"]');
    profileButton?.click();
    return false;
  }

  async function openCenter(tab = "tickets") {
    if (!await requireUser()) return;
    injectModal();
    const modal = $("#gb31ClientModal");
    modal?.classList.add("open");
    modal?.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    await loadData();
    setTab(tab);
  }

  function closeCenter() {
    const modal = $("#gb31ClientModal");
    modal?.classList.remove("open");
    modal?.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    activeEntity = null;
    activeType = null;
  }

  async function loadData() {
    if (!currentUser) return;

    const [ticketResult, disputeResult, orderResult] = await Promise.all([
      db.rpc("go_burger_suporte_listar_v31", {
        p_loja_id: null,
        p_status: null,
        p_limit: 100
      }),
      db.rpc("go_burger_disputa_listar_v31", {
        p_loja_id: null,
        p_status: null,
        p_limit: 100
      }),
      db.from("pedidos")
        .select("id,numero_loja,loja_id,total,status,criado_em")
        .order("criado_em", { ascending: false })
        .limit(40)
    ]);

    if (ticketResult.error) console.warn("Go-burger suporte", ticketResult.error.message);
    if (disputeResult.error) console.warn("Go-burger disputas", disputeResult.error.message);
    if (orderResult.error) console.warn("Go-burger pedidos suporte", orderResult.error.message);

    tickets = Array.isArray(ticketResult.data) ? ticketResult.data : [];
    disputes = Array.isArray(disputeResult.data) ? disputeResult.data : [];
    orders = Array.isArray(orderResult.data) ? orderResult.data : [];
  }

  function setTab(tab) {
    activeTab = tab;
    activeEntity = null;
    activeType = null;
    $$('[data-gb31-tab]', $("#gb31ClientTabs")).forEach(button => {
      button.classList.toggle("active", button.dataset.gb31Tab === tab);
    });

    if (tab === "tickets") renderTickets();
    if (tab === "disputes") renderDisputes();
    if (tab === "new-ticket") renderNewTicket();
    if (tab === "new-dispute") renderNewDispute();
  }

  function renderTickets() {
    const content = $("#gb31ClientContent");
    if (!content) return;

    content.innerHTML = `
      <div class="gb31-kpis">
        <article class="gb31-kpi"><i class="fa-solid fa-headset"></i><small>Chamados</small><strong>${tickets.length}</strong><span>Seu histórico de atendimento</span></article>
        <article class="gb31-kpi"><i class="fa-solid fa-hourglass-half"></i><small>Em andamento</small><strong>${tickets.filter(item => !["resolvido", "fechado"].includes(item.status)).length}</strong><span>Esperando solução ou resposta</span></article>
        <article class="gb31-kpi"><i class="fa-solid fa-check"></i><small>Resolvidos</small><strong>${tickets.filter(item => ["resolvido", "fechado"].includes(item.status)).length}</strong><span>Atendimentos concluídos</span></article>
        <article class="gb31-kpi"><i class="fa-solid fa-triangle-exclamation"></i><small>SLA</small><strong>${tickets.filter(item => String(item.sla_status).includes("atrasad") || item.sla_status === "sla_estourado").length}</strong><span>Chamados fora do prazo</span></article>
      </div>
      <div class="gb31-grid" style="margin-top:14px">
        <section class="gb31-panel">
          <div class="gb31-panel-head"><div><h3>Meus chamados</h3><small>Clique para abrir a conversa</small></div><button class="gb31-btn secondary" data-gb31-client-new="ticket" type="button"><i class="fa-solid fa-plus"></i> Novo</button></div>
          <div class="gb31-list" id="gb31ClientTicketList"></div>
        </section>
        <section class="gb31-panel"><div class="gb31-detail" id="gb31ClientDetail">${emptyState("fa-comments", "Selecione um chamado", "A conversa, anexos e status aparecerão aqui.")}</div></section>
      </div>
    `;

    const list = $("#gb31ClientTicketList");
    list.innerHTML = tickets.length
      ? tickets.map(ticket => `
          <button class="gb31-case" data-gb31-ticket="${ticket.id}" type="button">
            <span class="gb31-case-icon"><i class="fa-solid fa-headset"></i></span>
            <span>
              <strong>${escapeHtml(ticket.assunto)}</strong>
              <small>${escapeHtml(ticket.protocolo)} · ${dateTime(ticket.atualizado_em)}</small>
              <span class="gb31-badge ${badgeClass(ticket.status)}" style="margin-top:7px">${escapeHtml(statusLabel(ticket.status))}</span>
            </span>
            <i class="fa-solid fa-chevron-right" style="margin-top:7px;color:#9c8a80"></i>
          </button>
        `).join("")
      : emptyState("fa-inbox", "Nenhum chamado ainda", "Quando precisar, abra um chamado e acompanhe tudo por aqui.");
  }

  function renderDisputes() {
    const content = $("#gb31ClientContent");
    if (!content) return;

    const active = disputes.filter(item => !["resolvida", "rejeitada", "cancelada"].includes(item.status));
    content.innerHTML = `
      <div class="gb31-kpis">
        <article class="gb31-kpi"><i class="fa-solid fa-scale-balanced"></i><small>Disputas</small><strong>${disputes.length}</strong><span>Pedidos contestados</span></article>
        <article class="gb31-kpi"><i class="fa-solid fa-magnifying-glass"></i><small>Em análise</small><strong>${active.length}</strong><span>Aguardando avaliação</span></article>
        <article class="gb31-kpi"><i class="fa-solid fa-circle-check"></i><small>Resolvidas</small><strong>${disputes.filter(item => item.status === "resolvida").length}</strong><span>Casos concluídos</span></article>
        <article class="gb31-kpi"><i class="fa-solid fa-clock"></i><small>Prazo</small><strong>${active.filter(item => item.prazo_resolucao && new Date(item.prazo_resolucao) < new Date()).length}</strong><span>Casos acima do prazo</span></article>
      </div>
      <div class="gb31-grid" style="margin-top:14px">
        <section class="gb31-panel">
          <div class="gb31-panel-head"><div><h3>Minhas disputas</h3><small>Vinculadas a pedidos</small></div><button class="gb31-btn secondary" data-gb31-client-new="dispute" type="button"><i class="fa-solid fa-plus"></i> Nova</button></div>
          <div class="gb31-list" id="gb31ClientDisputeList"></div>
        </section>
        <section class="gb31-panel"><div class="gb31-detail" id="gb31ClientDetail">${emptyState("fa-scale-balanced", "Selecione uma disputa", "Veja a análise, mensagens e decisão do caso.")}</div></section>
      </div>
    `;

    const list = $("#gb31ClientDisputeList");
    list.innerHTML = disputes.length
      ? disputes.map(dispute => `
          <button class="gb31-case" data-gb31-dispute="${dispute.id}" type="button">
            <span class="gb31-case-icon"><i class="fa-solid fa-scale-balanced"></i></span>
            <span>
              <strong>Pedido #${escapeHtml(dispute.numero_loja || dispute.pedido_id)}</strong>
              <small>${escapeHtml(dispute.protocolo)} · ${money(dispute.pedido_total)}</small>
              <span class="gb31-badge ${badgeClass(dispute.status)}" style="margin-top:7px">${escapeHtml(statusLabel(dispute.status))}</span>
            </span>
            <i class="fa-solid fa-chevron-right" style="margin-top:7px;color:#9c8a80"></i>
          </button>
        `).join("")
      : emptyState("fa-scale-balanced", "Nenhuma disputa", "Se um pedido tiver um problema sério, você poderá registrar o caso aqui.");
  }

  function renderNewTicket() {
    const content = $("#gb31ClientContent");
    if (!content) return;

    content.innerHTML = `
      <section class="gb31-panel" style="padding:18px">
        <span class="gb31-eyebrow"><i class="fa-solid fa-headset"></i> NOVO ATENDIMENTO</span>
        <h3 style="margin:0 0 5px">Como podemos ajudar?</h3>
        <p style="margin:0 0 16px;color:var(--gb31-muted);font-size:10px;line-height:1.6">Conte o que aconteceu. Se a solicitação for sobre um pedido específico, selecione-o para acelerar o atendimento.</p>
        <form class="gb31-form-grid" id="gb31NewTicketForm">
          <label class="gb31-field"><span>Categoria</span><select name="categoria"><option value="pedido">Pedido</option><option value="pagamento">Pagamento</option><option value="entrega">Entrega</option><option value="conta">Conta</option><option value="cupom">Cupom</option><option value="geral">Outro assunto</option></select></label>
          <label class="gb31-field"><span>Prioridade</span><select name="prioridade"><option value="normal">Normal</option><option value="alta">Alta</option><option value="baixa">Baixa</option><option value="urgente">Urgente</option></select></label>
          <label class="gb31-field full"><span>Pedido relacionado (opcional)</span><select name="pedido_id"><option value="">Nenhum pedido específico</option>${orderOptions()}</select></label>
          <label class="gb31-field full"><span>Assunto</span><input name="assunto" maxlength="180" required placeholder="Ex.: meu pedido não atualizou"></label>
          <label class="gb31-field full"><span>Mensagem</span><textarea name="mensagem" maxlength="6000" required placeholder="Descreva o problema com o máximo de detalhes possível."></textarea></label>
          <label class="gb31-field full"><span>Anexos opcionais</span><input name="anexos" type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf,text/plain"><small style="color:var(--gb31-muted);font-size:8px">Até 10 MB por arquivo · JPG, PNG, WEBP, PDF ou TXT.</small></label>
          <div class="full" style="display:flex;justify-content:flex-end;gap:8px"><button class="gb31-btn secondary" data-gb31-back="tickets" type="button">Cancelar</button><button class="gb31-btn" type="submit"><i class="fa-solid fa-paper-plane"></i> Enviar chamado</button></div>
        </form>
      </section>
    `;
  }

  function renderNewDispute() {
    const content = $("#gb31ClientContent");
    if (!content) return;

    content.innerHTML = `
      <section class="gb31-panel" style="padding:18px">
        <span class="gb31-eyebrow"><i class="fa-solid fa-scale-balanced"></i> CONTESTAR UM PEDIDO</span>
        <h3 style="margin:0 0 5px">Abrir uma disputa</h3>
        <p style="margin:0 0 16px;color:var(--gb31-muted);font-size:10px;line-height:1.6">Use este canal para problemas que precisam de análise formal. A hamburgueria poderá responder e a Go-burger mantém o histórico do caso.</p>
        <form class="gb31-form-grid" id="gb31NewDisputeForm">
          <label class="gb31-field full"><span>Pedido</span><select name="pedido_id" required><option value="">Selecione um pedido</option>${orderOptions()}</select></label>
          <label class="gb31-field"><span>Motivo</span><select name="categoria"><option value="nao_entregue">Pedido não entregue</option><option value="produto_errado">Produto errado</option><option value="item_faltando">Item faltando</option><option value="qualidade">Problema de qualidade</option><option value="atraso">Atraso relevante</option><option value="cobranca">Problema de cobrança</option><option value="outro">Outro</option></select></label>
          <label class="gb31-field"><span>Valor solicitado (opcional)</span><input name="valor_solicitado" min="0" step="0.01" type="number" placeholder="0,00"></label>
          <label class="gb31-field full"><span>O que aconteceu?</span><textarea name="descricao" maxlength="6000" minlength="10" required placeholder="Explique o problema, o que você recebeu e qual solução espera."></textarea></label>
          <label class="gb31-field full"><span>Evidências opcionais</span><input name="anexos" type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf,text/plain"><small style="color:var(--gb31-muted);font-size:8px">Fotos, PDF ou TXT · até 10 MB por arquivo.</small></label>
          <div class="full" style="display:flex;justify-content:flex-end;gap:8px"><button class="gb31-btn secondary" data-gb31-back="disputes" type="button">Cancelar</button><button class="gb31-btn" type="submit"><i class="fa-solid fa-scale-balanced"></i> Abrir disputa</button></div>
        </form>
      </section>
    `;
  }

  function orderOptions() {
    return orders.map(order => `
      <option value="${order.id}">Pedido #${escapeHtml(order.numero_loja || order.id)} · ${money(order.total)} · ${escapeHtml(order.status || "")}</option>
    `).join("");
  }

  function emptyState(icon, title, text) {
    return `
      <div class="gb31-empty">
        <div><i class="fa-solid ${icon}"></i><strong>${escapeHtml(title)}</strong><p>${escapeHtml(text)}</p></div>
      </div>
    `;
  }

  async function showTicket(id) {
    const detail = $("#gb31ClientDetail");
    if (!detail) return;
    detail.innerHTML = emptyState("fa-spinner fa-spin", "Carregando chamado", "Buscando a conversa com segurança...");

    const result = await db.rpc("go_burger_suporte_detalhe_v31", { p_chamado_id: Number(id) });
    if (result.error) {
      detail.innerHTML = emptyState("fa-triangle-exclamation", "Não foi possível abrir", result.error.message);
      return;
    }

    activeEntity = result.data;
    activeType = "support";
    const ticket = result.data?.chamado || {};
    const messages = result.data?.mensagens || [];
    const attachments = result.data?.anexos || [];

    detail.innerHTML = `
      <span class="gb31-eyebrow"><i class="fa-solid fa-headset"></i> ${escapeHtml(ticket.protocolo || "CHAMADO")}</span>
      <div style="display:flex;gap:10px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap">
        <div><h3 style="margin:0;font-size:18px">${escapeHtml(ticket.assunto)}</h3><p style="margin:5px 0 0;color:var(--gb31-muted);font-size:9px">Aberto em ${dateTime(ticket.criado_em)}</p></div>
        <span class="gb31-badge ${badgeClass(ticket.status)}">${escapeHtml(statusLabel(ticket.status))}</span>
      </div>
      <div class="gb31-meta"><span><i class="fa-solid fa-tag"></i>${escapeHtml(ticket.categoria || "geral")}</span><span><i class="fa-solid fa-gauge"></i>${escapeHtml(ticket.prioridade || "normal")}</span>${ticket.pedido_id ? `<span><i class="fa-solid fa-receipt"></i>Pedido #${ticket.pedido_id}</span>` : ""}</div>
      <div class="gb31-thread">${renderMessages(messages)}</div>
      ${attachments.length ? `<div class="gb31-file-row" style="margin-top:12px">${attachments.map(file => `<button class="gb31-file" data-gb31-file="${escapeHtml(file.storage_path)}" type="button"><i class="fa-solid fa-paperclip"></i>${escapeHtml(file.nome)}</button>`).join("")}</div>` : ""}
      ${["resolvido", "fechado"].includes(ticket.status) ? `<div class="gb31-empty" style="min-height:100px"><div><i class="fa-solid fa-circle-check"></i><strong>Atendimento concluído</strong><p>Este chamado está encerrado. Se precisar, abra um novo atendimento.</p></div></div>` : `
        <form class="gb31-compose" id="gb31ClientReplyForm">
          <label class="gb31-field"><span>Responder</span><textarea name="mensagem" maxlength="6000" required placeholder="Escreva sua mensagem..."></textarea></label>
          <div style="display:flex;justify-content:flex-end"><button class="gb31-btn" type="submit"><i class="fa-solid fa-reply"></i> Enviar resposta</button></div>
        </form>
      `}
    `;
  }

  async function showDispute(id) {
    const detail = $("#gb31ClientDetail");
    if (!detail) return;
    detail.innerHTML = emptyState("fa-spinner fa-spin", "Carregando disputa", "Buscando o histórico do caso...");

    const result = await db.rpc("go_burger_disputa_detalhe_v31", { p_disputa_id: Number(id) });
    if (result.error) {
      detail.innerHTML = emptyState("fa-triangle-exclamation", "Não foi possível abrir", result.error.message);
      return;
    }

    activeEntity = result.data;
    activeType = "dispute";
    const dispute = result.data?.disputa || {};
    const messages = result.data?.mensagens || [];
    const attachments = result.data?.anexos || [];
    const closed = ["resolvida", "rejeitada", "cancelada"].includes(dispute.status);

    detail.innerHTML = `
      <span class="gb31-eyebrow"><i class="fa-solid fa-scale-balanced"></i> ${escapeHtml(dispute.protocolo || "DISPUTA")}</span>
      <div style="display:flex;gap:10px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap">
        <div><h3 style="margin:0;font-size:18px">Pedido #${escapeHtml(dispute.pedido_id)}</h3><p style="margin:5px 0 0;color:var(--gb31-muted);font-size:9px">${escapeHtml(dispute.categoria || "outro")} · aberta em ${dateTime(dispute.criado_em)}</p></div>
        <span class="gb31-badge ${badgeClass(dispute.status)}">${escapeHtml(statusLabel(dispute.status))}</span>
      </div>
      <div class="gb31-meta"><span><i class="fa-solid fa-clock"></i>Prazo: ${dateTime(dispute.prazo_resolucao)}</span>${dispute.valor_solicitado != null ? `<span><i class="fa-solid fa-coins"></i>Solicitado: ${money(dispute.valor_solicitado)}</span>` : ""}${dispute.valor_aprovado != null ? `<span><i class="fa-solid fa-circle-check"></i>Aprovado: ${money(dispute.valor_aprovado)}</span>` : ""}</div>
      ${dispute.resolucao_tipo ? `<div class="gb31-incident" style="margin:10px 0"><span class="gb31-badge green">DECISÃO</span><h4>${escapeHtml(dispute.resolucao_tipo.replaceAll("_", " "))}</h4><p>${escapeHtml(dispute.resolucao_texto || "Caso concluído pela Go-burger.")}</p></div>` : ""}
      <div class="gb31-thread">${renderMessages(messages)}</div>
      ${attachments.length ? `<div class="gb31-file-row" style="margin-top:12px">${attachments.map(file => `<button class="gb31-file" data-gb31-file="${escapeHtml(file.storage_path)}" type="button"><i class="fa-solid fa-paperclip"></i>${escapeHtml(file.nome)}</button>`).join("")}</div>` : ""}
      ${closed ? "" : `
        <form class="gb31-compose" id="gb31ClientDisputeReplyForm">
          <label class="gb31-field"><span>Adicionar informação</span><textarea name="mensagem" maxlength="6000" required placeholder="Escreva sua resposta ou envie uma atualização do caso..."></textarea></label>
          <div style="display:flex;justify-content:flex-end"><button class="gb31-btn" type="submit"><i class="fa-solid fa-reply"></i> Enviar</button></div>
        </form>
      `}
    `;
  }

  function renderMessages(messages) {
    if (!messages.length) return emptyState("fa-comment-slash", "Sem mensagens", "A conversa ainda não começou.");
    return messages.map(message => {
      const mine = message.autor_id === currentUser?.id;
      const agent = ["loja", "suporte"].includes(message.autor_tipo);
      return `
        <article class="gb31-message ${mine ? "mine" : agent ? "agent" : ""} ${message.interno ? "internal" : ""}">
          <div class="gb31-message-head"><span>${mine ? "Você" : message.autor_tipo === "suporte" ? "Go-burger" : message.autor_tipo === "loja" ? "Hamburgueria" : "Cliente"}${message.interno ? " · nota interna" : ""}</span><time>${dateTime(message.criado_em)}</time></div>
          <p>${escapeHtml(message.mensagem)}</p>
        </article>
      `;
    }).join("");
  }

  async function submitTicket(form) {
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    const data = new FormData(form);
    const files = [...form.elements.anexos.files];

    try {
      const result = await db.rpc("go_burger_suporte_criar_v31", {
        p_assunto: String(data.get("assunto") || "").trim(),
        p_mensagem: String(data.get("mensagem") || "").trim(),
        p_categoria: String(data.get("categoria") || "geral"),
        p_prioridade: String(data.get("prioridade") || "normal"),
        p_pedido_id: data.get("pedido_id") ? Number(data.get("pedido_id")) : null,
        p_loja_id: null
      });
      if (result.error) throw result.error;
      await uploadFiles("suporte", result.data.id, files);
      toast(`Chamado ${result.data.protocolo} aberto com sucesso.`);
      await loadData();
      setTab("tickets");
      await showTicket(result.data.id);
    } catch (error) {
      toast(error.message || "Não foi possível abrir o chamado.", "error");
    } finally {
      submit.disabled = false;
    }
  }

  async function submitDispute(form) {
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    const data = new FormData(form);
    const files = [...form.elements.anexos.files];

    try {
      const result = await db.rpc("go_burger_disputa_criar_v31", {
        p_pedido_id: Number(data.get("pedido_id")),
        p_categoria: String(data.get("categoria") || "outro"),
        p_descricao: String(data.get("descricao") || "").trim(),
        p_valor_solicitado: data.get("valor_solicitado") ? Number(data.get("valor_solicitado")) : null
      });
      if (result.error) throw result.error;
      await uploadFiles("disputa", result.data.id, files);
      toast(`Disputa ${result.data.protocolo} registrada.`);
      await loadData();
      setTab("disputes");
      await showDispute(result.data.id);
    } catch (error) {
      toast(error.message || "Não foi possível abrir a disputa.", "error");
    } finally {
      submit.disabled = false;
    }
  }

  async function uploadFiles(kind, entityId, files) {
    if (!files.length || !currentUser) return;

    for (const file of files.slice(0, 5)) {
      if (file.size > 10 * 1024 * 1024) {
        toast(`${file.name}: arquivo acima de 10 MB e não foi enviado.`, "error");
        continue;
      }

      const safeName = file.name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9._-]+/g, "-")
        .slice(-160) || "arquivo";
      const path = `${kind}/${entityId}/${currentUser.id}/${crypto.randomUUID()}-${safeName}`;

      const upload = await db.storage.from(BUCKET).upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || "application/octet-stream"
      });
      if (upload.error) {
        toast(`${file.name}: ${upload.error.message}`, "error");
        continue;
      }

      const register = await db.rpc("go_burger_anexo_registrar_v31", {
        p_entidade_tipo: kind,
        p_entidade_id: Number(entityId),
        p_storage_path: path,
        p_nome: file.name,
        p_mime: file.type || null,
        p_tamanho: file.size
      });
      if (register.error) console.warn("Go-burger anexo", register.error.message);
    }
  }

  async function openFile(path) {
    const result = await db.storage.from(BUCKET).createSignedUrl(path, 180);
    if (result.error || !result.data?.signedUrl) {
      toast(result.error?.message || "Não foi possível abrir o anexo.", "error");
      return;
    }
    window.open(result.data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function replySupport(form) {
    const message = String(form.elements.mensagem.value || "").trim();
    if (!message || !activeEntity?.chamado?.id) return;
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    try {
      const result = await db.rpc("go_burger_suporte_responder_v31", {
        p_chamado_id: Number(activeEntity.chamado.id),
        p_mensagem: message,
        p_interno: false
      });
      if (result.error) throw result.error;
      form.reset();
      await loadData();
      await showTicket(activeEntity.chamado.id);
    } catch (error) {
      toast(error.message || "Não foi possível enviar a resposta.", "error");
    } finally {
      button.disabled = false;
    }
  }

  async function replyDispute(form) {
    const message = String(form.elements.mensagem.value || "").trim();
    if (!message || !activeEntity?.disputa?.id) return;
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    try {
      const result = await db.rpc("go_burger_disputa_responder_v31", {
        p_disputa_id: Number(activeEntity.disputa.id),
        p_mensagem: message,
        p_interno: false
      });
      if (result.error) throw result.error;
      form.reset();
      await loadData();
      await showDispute(activeEntity.disputa.id);
    } catch (error) {
      toast(error.message || "Não foi possível enviar a resposta.", "error");
    } finally {
      button.disabled = false;
    }
  }

  function bindEvents() {
    document.addEventListener("click", async event => {
      const open = event.target.closest("#gb31SupportFloat, #gb31ProfileSupportButton, [data-gb31-open-support]");
      if (open) {
        event.preventDefault();
        await openCenter(open.dataset.gb31OpenSupport || "tickets");
        return;
      }

      if (event.target.closest("#gb31ClientClose")) {
        closeCenter();
        return;
      }

      if (event.target === $("#gb31ClientModal")) {
        closeCenter();
        return;
      }

      const tab = event.target.closest("[data-gb31-tab]");
      if (tab) {
        setTab(tab.dataset.gb31Tab);
        return;
      }

      const newButton = event.target.closest("[data-gb31-client-new]");
      if (newButton) {
        setTab(newButton.dataset.gb31ClientNew === "dispute" ? "new-dispute" : "new-ticket");
        return;
      }

      const back = event.target.closest("[data-gb31-back]");
      if (back) {
        setTab(back.dataset.gb31Back);
        return;
      }

      const ticket = event.target.closest("[data-gb31-ticket]");
      if (ticket) {
        $$('[data-gb31-ticket]').forEach(item => item.classList.toggle("active", item === ticket));
        await showTicket(ticket.dataset.gb31Ticket);
        return;
      }

      const dispute = event.target.closest("[data-gb31-dispute]");
      if (dispute) {
        $$('[data-gb31-dispute]').forEach(item => item.classList.toggle("active", item === dispute));
        await showDispute(dispute.dataset.gb31Dispute);
        return;
      }

      const file = event.target.closest("[data-gb31-file]");
      if (file) await openFile(file.dataset.gb31File);
    });

    document.addEventListener("submit", async event => {
      if (event.target.id === "gb31NewTicketForm") {
        event.preventDefault();
        await submitTicket(event.target);
      }
      if (event.target.id === "gb31NewDisputeForm") {
        event.preventDefault();
        await submitDispute(event.target);
      }
      if (event.target.id === "gb31ClientReplyForm") {
        event.preventDefault();
        await replySupport(event.target);
      }
      if (event.target.id === "gb31ClientDisputeReplyForm") {
        event.preventDefault();
        await replyDispute(event.target);
      }
    });

    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && $("#gb31ClientModal")?.classList.contains("open")) closeCenter();
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (!window.supabase?.createClient) return;

    db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: "go-burger-auth-v1"
      }
    });

    injectEntryPoints();
    injectModal();
    bindEvents();

    const params = new URLSearchParams(location.search);
    if (params.get("support") === "1") setTimeout(() => openCenter("tickets"), 800);
    if (params.get("disputa") === "1") setTimeout(() => openCenter("new-dispute"), 800);
  });
})();
