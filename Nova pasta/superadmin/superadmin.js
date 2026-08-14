"use strict";

document.addEventListener("DOMContentLoaded", async () => {
  const SUPABASE_URL = "https://ethlgaszdextwckdwgsf.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_qEhxWcCbekPjYFUW-EQ1ow_xccHG8aJ";
  const AUTH_KEY = "go-burger-auth-v1";
  const FINANCE_ENABLED = false; // P602: monetização congelada no lançamento
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const money = v => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const number = v => Number(v || 0).toLocaleString("pt-BR");
  const dt = v => v ? new Date(v).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";
  const date = v => v ? new Date(v).toLocaleDateString("pt-BR") : "—";
  const html = v => String(v ?? "").replace(/[&<>'"]/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" }[c]));
  const slugify = v => String(v || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const initials = v => String(v || "Go burger").trim().split(/\s+/).slice(0,2).map(x => x[0] || "").join("").toUpperCase() || "GB";
  const lower = v => String(v || "").toLowerCase();

  if (!window.supabase?.createClient) {
    deny("Não foi possível carregar a conexão da Go-burger. Verifique sua internet.");
    return;
  }

  const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: AUTH_KEY }
  });

  const state = {
    user: null, me: null, metrics: {}, config: {}, stores: [], controls: [], storeUsers: [], profiles: [], userControls: [],
    orders: [], reviews: [], products: [], plans: [], subscriptions: [], categories: [], banners: [], campaigns: [],
    notifications: [], support: [], moderation: [], flags: [], alerts: [], audit: [], team: [], charts: {}, loading: false,
    currentPage: "dashboard", moderationTab: "reviews", metricsAdvanced: {}, metricDays:30, retentionStatus:{}, partnerRequests:[], driverRequests:[], financePrep:null, planResources:[], planCommercial:{}, planOps:{}, planFinal:{}, planCentral:{}, planMigrationPreview:null
  };

  const pageMeta = {
    dashboard:["COMMAND CENTER","Visão geral"], lojas:["PARCEIROS","Hamburguerias"], aprovacoes:["PARCEIROS","Parceiros & aprovações"],
    pedidos:["OPERAÇÃO","Pedidos globais"], usuarios:["COMUNIDADE","Usuários"], entregadores:["GO-BURGER ENTREGAS","Entregadores"], financeiro:["FINANCE READINESS","Financeiro · preparação"],
    planos:["MONETIZAÇÃO","Planos & assinaturas"], marketing:["GROWTH","Marketing"], categorias:["DESCOBERTA","Categorias"],
    moderacao:["TRUST & SAFETY","Moderação"], suporte:["CUSTOMER SUCCESS","Suporte"], disputas:["TRUST & SAFETY","Disputas"], antifraude:["RISK CENTER","Antifraude"], notificacoes:["COMUNICAÇÃO","Mensagens"],
    sistema:["OBSERVABILIDADE","Saúde do sistema"], incidentes:["OBSERVABILIDADE","Incidentes"], flags:["RELEASE CONTROL","Feature flags"], auditoria:["GOVERNANÇA","Auditoria"],
    seguranca:["SECURITY CENTER","Defesa da plataforma"], backups:["CONTINUIDADE","Backup & DR"], creditos:["RELACIONAMENTO","Créditos Go-burger"],
    equipe:["ACESSO INTERNO","Equipe Go-burger"], configuracoes:["PLATAFORMA","Configurações"]
  };

  function toast(message, type = "success") {
    const wrap = $("#saToastWrap"); if (!wrap) return;
    const node = document.createElement("div"); node.className = `sa-toast ${type}`;
    const icon = type === "error" ? "fa-triangle-exclamation" : type === "info" ? "fa-circle-info" : "fa-circle-check";
    node.innerHTML = `<span><i class="fa-solid ${icon}"></i></span><div><strong>${type === "error" ? "Atenção" : type === "info" ? "Go-burger" : "Concluído"}</strong><p>${html(message)}</p></div>`;
    wrap.appendChild(node); setTimeout(() => node.remove(), 4200);
  }

  function deny(message) {
    $("#saGateText").textContent = message;
    $("#saGateLoader")?.classList.add("hidden");
    $("#saBackButton")?.classList.remove("hidden");
  }

  function openModal(id) { $("#saOverlay")?.classList.add("active"); const m = $(`#${id}`); if (m) { m.classList.add("active"); m.setAttribute("aria-hidden","false"); } }
  function closeModal(id) { const m = $(`#${id}`); if (m) { m.classList.remove("active"); m.setAttribute("aria-hidden","true"); } if (!$(".sa-modal.active")) $("#saOverlay")?.classList.remove("active"); }
  function closeAllModals() { $$(".sa-modal.active").forEach(m => closeModal(m.id)); }

  function badge(value, kind) { return `<span class="sa-badge ${kind}">${html(value)}</span>`; }
  function statusBadge(status) {
    const s = lower(status);
    if (["ativa","ativo","aprovada","aprovado","publicada","resolvido","enviada"].includes(s)) return badge(status || "Ativo","green");
    if (["bloqueada","bloqueado","cancelada","cancelado","rejeitada","recusado","oculta","suspensa","suspenso"].includes(s)) return badge(status || "Bloqueado","red");
    if (["arquivada","arquivado"].includes(s)) return badge(status || "Arquivada","gray");
    if (["pendente","em_analise","aguardando_correcao","atrasada","aberto","aguardando_usuario","rascunho"].includes(s)) return badge(String(status || "Pendente").replaceAll("_"," "),"amber");
    if (["pausada","pausado","em_atendimento","agendada","trial"].includes(s)) return badge(String(status || "Pausado").replaceAll("_"," "),"blue");
    return badge(String(status || "—").replaceAll("_"," "),"gray");
  }

  function storeById(id) { return state.stores.find(x => Number(x.id) === Number(id)); }
  function controlByStore(id) { return state.controls.find(x => Number(x.loja_id) === Number(id)) || {}; }
  function subscriptionByStore(id) { return state.subscriptions.find(x => Number(x.loja_id) === Number(id)) || {}; }
  function planById(id) { return state.plans.find(x => Number(x.id) === Number(id)); }
  function profileById(id) { return state.profiles.find(x => x.id === id); }
  function userControl(id) { return state.userControls.find(x => x.user_id === id) || { status:"ativo" }; }
  function storeName(id) { return storeById(id)?.nome || `Loja #${id || "—"}`; }
  function storeLogo(store) { return store?.logo_url ? `<img src="${html(store.logo_url)}" alt="">` : "🍔"; }
  function orderCountStore(id) { return state.orders.filter(o => Number(o.loja_id) === Number(id)).length; }
  function reviewAvgStore(id) { const a = state.reviews.filter(r => Number(r.loja_id) === Number(id) && lower(r.status) !== "oculta"); return a.length ? a.reduce((s,r)=>s+Number(r.nota||0),0)/a.length : 0; }
  function userStoreCount(id) { return new Set(state.storeUsers.filter(x => x.user_id === id && x.ativo !== false).map(x => x.loja_id)).size; }
  function userOrderCount(id) { return state.orders.filter(x => x.user_id === id).length; }
  function partnerRequestById(id){ return state.partnerRequests.find(x=>Number(x.id)===Number(id)); }
  function maskDocument(value){ const d=String(value||"").replace(/\D/g,""); if(d.length===11)return `***.***.${d.slice(6,9)}-${d.slice(-2)}`; if(d.length===14)return `**.***.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(-2)}`; return "—"; }

  async function fetchRows(table, queryBuilder) {
    try { const q = queryBuilder ? queryBuilder(db.from(table)) : db.from(table).select("*"); const { data, error } = await q; if (error) throw error; return Array.isArray(data) ? data : []; }
    catch (e) { console.warn(`Go-burger Super Admin: ${table}`, e.message); return []; }
  }

  async function loadAll({ silent = false } = {}) {
    if (state.loading) return; state.loading = true;
    if (!silent) $("#saRefresh")?.classList.add("spinning");
    try {
      const tasks = await Promise.all([
        db.rpc("go_burger_super_dashboard_v1"),
        db.rpc("go_burger_super_metricas_v2",{p_dias:state.metricDays}),
        db.rpc("go_burger_retencao_status_v1"),
        db.rpc("go_burger_super_admin_solicitacoes_parceiro_v1"),
        db.rpc("go_burger_super_admin_entregador_solicitacoes_v45"),
        fetchRows("lojas", q => q.select("*").order("criado_em",{ascending:false}).limit(1000)),
        fetchRows("loja_controle_plataforma", q => q.select("*").limit(1000)),
        fetchRows("loja_usuarios", q => q.select("*").limit(3000)),
        fetchRows("profiles", q => q.select("*").order("criado_em",{ascending:false}).limit(3000)),
        fetchRows("usuario_controle_plataforma", q => q.select("*").limit(3000)),
        fetchRows("pedidos", q => q.select("id,user_id,cliente_nome,telefone,total,status,forma_pagamento,pagamento_status,tipo_entrega,criado_em,loja_id").order("criado_em",{ascending:false}).limit(1500)),
        fetchRows("avaliacoes", q => q.select("*").order("criado_em",{ascending:false}).limit(1000)),
        fetchRows("produtos", q => q.select("id,loja_id,ativo,destaque,categoria").limit(5000)),
        db.rpc("go_burger_planos_admin_v615"),
        Promise.resolve([]),
        fetchRows("plataforma_categorias", q => q.select("*").order("ordem").limit(300)),
        fetchRows("plataforma_banners", q => q.select("*").order("ordem").limit(300)),
        fetchRows("plataforma_campanhas", q => q.select("*").order("criado_em",{ascending:false}).limit(300)),
        fetchRows("plataforma_notificacoes", q => q.select("*").order("criado_em",{ascending:false}).limit(500)),
        fetchRows("suporte_chamados", q => q.select("*").order("criado_em",{ascending:false}).limit(1000)),
        fetchRows("moderacao_fila", q => q.select("*").order("criado_em",{ascending:false}).limit(1000)),
        fetchRows("plataforma_feature_flags", q => q.select("*").order("chave").limit(300)),
        fetchRows("plataforma_alertas", q => q.select("*").order("criado_em",{ascending:false}).limit(500)),
        fetchRows("plataforma_auditoria", q => q.select("*").order("criado_em",{ascending:false}).limit(1000)),
        fetchRows("super_admins", q => q.select("*").order("criado_em").limit(100)),
        db.from("plataforma_config").select("*").eq("id",1).maybeSingle(),
        db.rpc("go_burger_planos_comercial_admin_v660"),
        db.rpc("go_burger_planos_metricas_v665"),
        db.rpc("go_burger_planos_status_v700"),
        db.rpc("go_burger_planos_central_admin_v691")
      ]);
      const [metricsRes, advancedMetricsRes, retentionRes, partnerRequestsRes, driverRequestsRes, stores, controls, storeUsers, profiles, userControls, orders, reviews, products, plansRes, subscriptions, categories, banners, campaigns, notifications, support, moderation, flags, alerts, audit, team, configRes, commercialRes, planOpsRes, planFinalRes, planCentralRes] = tasks;
      if (metricsRes.error) throw metricsRes.error;if(advancedMetricsRes.error)console.warn("Métricas avançadas",advancedMetricsRes.error.message);if(retentionRes.error)console.warn("Retenção LGPD",retentionRes.error.message);if(partnerRequestsRes.error)throw partnerRequestsRes.error;if(driverRequestsRes.error)console.warn("Entregadores",driverRequestsRes.error.message);
      if(plansRes?.error)throw plansRes.error;
      if(commercialRes?.error)console.warn("Comercial de planos",commercialRes.error.message);
      if(planOpsRes?.error)console.warn("Operações de planos P680",planOpsRes.error.message);
      if(planFinalRes?.error)console.warn("Planos 1.0 P700",planFinalRes.error.message);
      if(planCentralRes?.error)console.warn("Central de planos P691",planCentralRes.error.message);
      const planPayload=plansRes?.data||{};
      Object.assign(state, { metrics:metricsRes.data || {}, metricsAdvanced:advancedMetricsRes.data || {}, retentionStatus:retentionRes.data || {}, partnerRequests:Array.isArray(partnerRequestsRes.data)?partnerRequestsRes.data:[], driverRequests:Array.isArray(driverRequestsRes.data)?driverRequestsRes.data:[], stores, controls, storeUsers, profiles, userControls, orders, reviews, products, plans:Array.isArray(planPayload.plans)?planPayload.plans:[], planResources:Array.isArray(planPayload.resources)?planPayload.resources:[], subscriptions, categories, banners, campaigns, notifications, support, moderation, flags, alerts, audit, team, config:configRes.data || {}, planCommercial:commercialRes?.data||{}, planOps:planOpsRes?.data||{}, planFinal:planFinalRes?.data||{}, planCentral:planCentralRes?.data||{} });
      renderAll();
      $("#saCoreStatus").textContent = `Online · ${state.stores.length} loja(s)`;
    } catch (e) { console.error(e); toast(e.message || "Não foi possível atualizar o Command Center.", "error"); }
    finally { state.loading = false; $("#saRefresh")?.classList.remove("spinning"); }
  }

  function renderAll() {
    renderDashboard(); renderStores(); renderApprovals(); renderOrders(); renderUsers(); renderDriversAdmin(); renderFinance(); renderPlans(); renderPlanCommercialP660(); renderPlanOpsP680(); renderPlanFinalP700();
    renderMarketing(); renderCategories(); renderModeration(); renderSupport(); renderNotifications(); renderFlags(); renderAudit(); renderTeam(); renderSettings(); renderRetentionStatus(); updateNavBadges();
  }

  function updateNavBadges() {
    const storePending = state.controls.filter(c => ["pendente","em_analise"].includes(c.aprovacao_status)).length;
    const partnerPending = state.partnerRequests.filter(r=>["pendente","em_analise","aguardando_correcao"].includes(String(r.status||""))).length;
    $("#navStoresBadge").textContent = state.stores.length; $("#navApprovalBadge").textContent = storePending + partnerPending; if($("#navDriverBadge"))$("#navDriverBadge").textContent=state.driverRequests.filter(x=>["pendente","em_analise","aguardando_correcao"].includes(String(x.status||""))).length;
    $("#navSupportBadge").textContent = state.support.filter(x => !["resolvido","fechado"].includes(x.status)).length;
    $("#navModerationBadge").textContent = state.moderation.filter(x => ["pendente","em_analise"].includes(x.status)).length;
  }

  function renderDashboard() {
    const m = state.metrics || {};
    $("#metricStores").textContent = number(m.lojas_total); $("#metricActiveStores").textContent = number(m.lojas_ativas);
    $("#metricOrdersMonth").textContent = number(m.pedidos_mes); $("#metricOrdersToday").textContent = number(m.pedidos_hoje);
    $("#metricGmvMonth").textContent = money(m.gmv_mes); $("#metricUsers").textContent = number(m.usuarios_total);
    const partnerPendingTotal=state.partnerRequests.filter(r=>["pendente","em_analise","aguardando_correcao"].includes(String(r.status||""))).length;
    const storePendingTotal=state.controls.filter(c=>["pendente","em_analise"].includes(c.aprovacao_status)).length;
    $("#metricApprovals").textContent = number(partnerPendingTotal + storePendingTotal); $("#metricRating").textContent = Number(m.nota_media || 0).toLocaleString("pt-BR",{minimumFractionDigits:1,maximumFractionDigits:1});
    $("#metricReviewCount").textContent = `${number(m.avaliacoes_total)} avaliações`; $("#metricSupport").textContent = number(m.suporte_aberto); $("#metricAlerts").textContent = number(m.alertas_criticos);
    const a=state.metricsAdvanced||{};
    if($("#metricRecurringCustomers"))$("#metricRecurringCustomers").textContent=number(a.clientes_recorrentes);
    document.querySelector("#metricRecurringCustomers")?.closest("article")?.querySelector("small")?.replaceChildren(document.createTextNode(`CLIENTES RECORRENTES · ${state.metricDays}D`));
    if($("#metricMrrAdvanced"))$("#metricMrrAdvanced").textContent=money(a.mrr);
    if($("#metricActiveSubs"))$("#metricActiveSubs").textContent=number(a.assinaturas_ativas);
    if($("#metricPeriodGmv"))$("#metricPeriodGmv").textContent=money(a.gmv);
    document.querySelector("#metricPeriodGmv")?.closest("article")?.querySelector("small")?.replaceChildren(document.createTextNode(`GMV · ${state.metricDays} DIAS`));
    if($("#metricMarketplaceConversion"))$("#metricMarketplaceConversion").textContent=`${Number(a.funil?.conversao_marketplace_pedido||0).toLocaleString("pt-BR",{maximumFractionDigits:2})}%`;
    if($("#metricActiveCarts"))$("#metricActiveCarts").textContent=number(a.carrinhos_ativos);
    if($("#metricActiveCartValue"))$("#metricActiveCartValue").textContent=`${money(a.valor_carrinhos_ativos)} em potencial`;
    if($("#metricCommissionRevenue"))$("#metricCommissionRevenue").textContent=money(a.receita_comissoes);
    if($("#metricCancelRate"))$("#metricCancelRate").textContent=`${Number(a.taxa_cancelamento||0).toLocaleString("pt-BR",{maximumFractionDigits:2})}%`;
    $("#financeGmvTotal").textContent = money(m.gmv_total); $("#financeMrr").textContent = money(m.receita_mensal_estimada); $("#financeTicket").textContent = money(m.ticket_medio); $("#financeOverdue").textContent = number(m.assinaturas_atrasadas);

    const pendingRequests=state.partnerRequests.filter(r=>["pendente","em_analise","aguardando_correcao"].includes(String(r.status||""))).slice(0,3);
    const pendingStores = state.stores.filter(s => ["pendente","em_analise"].includes(controlByStore(s.id).aprovacao_status)).slice(0,Math.max(0,5-pendingRequests.length));
    const approvalRows=[
      ...pendingRequests.map(r=>`<tr><td><div class="sa-store-cell"><span class="sa-store-logo"><i class="fa-solid fa-handshake"></i></span><div><strong>${html(r.nome)}</strong><small>Solicitação de entrada</small></div></div></td><td>${html([r.cidade,r.estado].filter(Boolean).join(" - ")||"—")}</td><td>${statusBadge(r.status)}</td><td>${date(r.criado_em)}</td><td><button class="sa-action-btn" data-open-partner-request="${r.id}" title="Revisar solicitação"><i class="fa-solid fa-arrow-right"></i></button></td></tr>`),
      ...pendingStores.map(s=>`<tr><td><div class="sa-store-cell"><span class="sa-store-logo">${storeLogo(s)}</span><div><strong>${html(s.nome)}</strong><small>Publicação da loja</small></div></div></td><td>${html([s.cidade,s.estado].filter(Boolean).join(" - ")||"—")}</td><td>${statusBadge(controlByStore(s.id).aprovacao_status)}</td><td>${date(s.criado_em)}</td><td><button class="sa-action-btn" data-open-store="${s.id}" title="Revisar publicação"><i class="fa-solid fa-arrow-right"></i></button></td></tr>`)
    ];
    $("#dashboardApprovals").innerHTML = approvalRows.length?approvalRows.join(""):`<tr><td colspan="5"><div class="sa-empty"><i class="fa-solid fa-circle-check"></i><strong>Nenhuma aprovação pendente</strong></div></td></tr>`;

    const unresolved = state.alerts.filter(a => !a.resolvido).slice(0,5);
    $("#dashboardAlerts").innerHTML = unresolved.length ? unresolved.map(alertHtml).join("") : `<div class="sa-empty"><i class="fa-solid fa-shield-check"></i><strong>Sem alertas abertos</strong></div>`;
    $("#dashboardAudit").innerHTML = state.audit.slice(0,7).map(auditTimelineHtml).join("") || `<div class="sa-empty"><i class="fa-solid fa-fingerprint"></i><strong>As próximas ações aparecerão aqui</strong></div>`;
    renderCharts();
  }

  function renderCharts() {
    if (!window.Chart) return;
    const days = Number($("#dashboardChartPeriod")?.value || 30), labels = [], gmv = [], counts = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()-i); const key = d.toISOString().slice(0,10);
      const list = state.orders.filter(o => { const od = new Date(o.criado_em); od.setHours(0,0,0,0); return od.toISOString().slice(0,10) === key; });
      labels.push(d.toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit"})); counts.push(list.length); gmv.push(list.filter(x=>!lower(x.status).includes("cancel")).reduce((s,x)=>s+Number(x.total||0),0));
    }
    state.charts.gmv?.destroy(); state.charts.gmv = new Chart($("#chartGmv"), { type:"line", data:{labels,datasets:[{label:"GMV",data:gmv,borderColor:"#ff6500",backgroundColor:"rgba(255,101,0,.09)",fill:true,tension:.38,yAxisID:"y"},{label:"Pedidos",data:counts,borderColor:"#7c3aed",backgroundColor:"rgba(124,58,237,.08)",tension:.35,yAxisID:"y1"}]}, options:{responsive:true,maintainAspectRatio:false,interaction:{mode:"index",intersect:false},plugins:{legend:{labels:{boxWidth:8,usePointStyle:true}}},scales:{x:{grid:{display:false},ticks:{font:{size:9}}},y:{beginAtZero:true,grid:{color:"rgba(128,128,128,.08)"},ticks:{font:{size:9},callback:v=>`R$ ${Number(v).toLocaleString("pt-BR")}`}},y1:{beginAtZero:true,position:"right",grid:{display:false},ticks:{font:{size:9},precision:0}}}} });
    const storeStatus = ["ativa","pausada","rascunho","bloqueada","arquivada"], storeValues = storeStatus.map(s=>state.stores.filter(x=>x.status===s).length);
    state.charts.stores?.destroy(); state.charts.stores = new Chart($("#chartStores"), { type:"doughnut", data:{labels:["Ativas","Pausadas","Rascunho","Bloqueadas","Arquivadas"],datasets:[{data:storeValues,backgroundColor:["#16a34a","#2563eb","#d97706","#dc2626","#64748b"],borderWidth:0}]}, options:{responsive:true,maintainAspectRatio:false,cutout:"72%",plugins:{legend:{position:"bottom",labels:{boxWidth:8,usePointStyle:true,font:{size:9}}}}} });
    const planCounts = state.plans.map(p=>state.subscriptions.filter(s=>Number(s.plano_id)===Number(p.id)).length);
    state.charts.plans?.destroy(); state.charts.plans = new Chart($("#chartPlans"), { type:"doughnut", data:{labels:state.plans.map(p=>p.nome),datasets:[{data:planCounts,backgroundColor:["#ff6500","#2563eb","#7c3aed","#16a34a","#d97706"],borderWidth:0}]}, options:{responsive:true,maintainAspectRatio:false,cutout:"68%",plugins:{legend:{position:"bottom",labels:{boxWidth:8,usePointStyle:true,font:{size:9}}}}} });
  }

  function renderStores() {
    const q = lower($("#storeSearch")?.value), status = $("#storeStatusFilter")?.value || "", approval = $("#storeApprovalFilter")?.value || "";
    let list = state.stores.filter(s => (!q || `${s.nome} ${s.slug} ${s.cidade} ${s.estado}`.toLowerCase().includes(q)) && (!status || s.status === status) && (!approval || controlByStore(s.id).aprovacao_status === approval));
    $("#storesTableBody").innerHTML = list.map(s => {
      const c = controlByStore(s.id), sub = subscriptionByStore(s.id), p = planById(sub.plano_id || c.plano_id), avg = reviewAvgStore(s.id);
      return `<tr><td><div class="sa-store-cell"><span class="sa-store-logo">${storeLogo(s)}</span><div><strong>${html(s.nome)} ${c.verificada?'<i class="fa-solid fa-circle-check" style="color:#2563eb" title="Verificada"></i>':''}</strong><small>go-burger.app/${html(s.slug)}</small></div></div></td><td><strong>${html([s.cidade,s.estado].filter(Boolean).join(" - ")||"—")}</strong><small>${html(s.endereco||"")}</small></td><td>${statusBadge(s.status)}</td><td>${statusBadge(c.aprovacao_status||"rascunho")}</td><td><strong>${html(p?.nome||"Sem plano")}</strong><small>${statusBadge(sub.status||c.status_financeiro||"ok")}</small></td><td><strong><i class="fa-solid fa-star" style="color:#e8a100"></i> ${avg.toFixed(1)}</strong></td><td><strong>${orderCountStore(s.id)}</strong></td><td><div class="sa-action-row"><button class="sa-action-btn" data-open-store="${s.id}" title="Detalhes"><i class="fa-solid fa-eye"></i></button><button class="sa-action-btn" data-open-public-store="${s.id}" title="Abrir loja"><i class="fa-solid fa-arrow-up-right-from-square"></i></button></div></td></tr>`;
    }).join("");
    $("#storesEmpty")?.classList.toggle("hidden", list.length > 0);
    const options = state.stores.map(s=>`<option value="${s.id}">${html(s.nome)}</option>`).join("");
    if ($("#orderStoreFilter")) { const v=$("#orderStoreFilter").value; $("#orderStoreFilter").innerHTML=`<option value="">Todas as lojas</option>${options}`; $("#orderStoreFilter").value=v; }
    if ($("#notificationStoreSelect")) { const v=$("#notificationStoreSelect").value; $("#notificationStoreSelect").innerHTML=`<option value="">Todas / não se aplica</option>${options}`; $("#notificationStoreSelect").value=v; }
  }

  function renderApprovals() {
    const requestGroups=Object.fromEntries(["pendente","em_analise","aguardando_correcao","recusado"].map(k=>[k,state.partnerRequests.filter(r=>String(r.status||"")===k).length]));
    $("#partnerRequestPendingCount").textContent=requestGroups.pendente||0;
    $("#partnerRequestReviewCount").textContent=requestGroups.em_analise||0;
    $("#partnerRequestCorrectionCount").textContent=requestGroups.aguardando_correcao||0;
    $("#partnerRequestRejectedCount").textContent=requestGroups.recusado||0;
    const requests=state.partnerRequests.filter(r=>["pendente","em_analise","aguardando_correcao","recusado"].includes(String(r.status||""))).sort((a,b)=>new Date(b.criado_em)-new Date(a.criado_em));
    $("#partnerRequestsGrid").innerHTML=requests.length?requests.map(r=>{
      const status=String(r.status||"pendente");
      const canDecide=["pendente","em_analise"].includes(status);
      return `<article class="sa-approval-card"><div class="sa-approval-top"><span class="sa-store-logo"><i class="fa-solid fa-handshake"></i></span><div><strong>${html(r.nome)}</strong><small>${html([r.cidade,r.estado].filter(Boolean).join(" - ")||"Localização não informada")}</small></div>${statusBadge(status)}</div><p>${html(r.descricao||"Solicitação de entrada de parceiro na Go-burger.")}</p><div class="sa-request-meta"><span>Responsável<strong>${html(r.nome_responsavel||"—")}</strong></span><span>Documento<strong>${html(maskDocument(r.documento))}</strong></span><span>Contato<strong>${html(r.whatsapp||r.telefone||r.email_contato||"—")}</strong></span><span>Enviada<strong>${dt(r.criado_em)}</strong></span></div>${r.observacao_super_admin?`<p class="sa-request-note">${html(r.observacao_super_admin)}</p>`:""}<div class="sa-approval-actions"><button class="sa-btn secondary" data-open-partner-request="${r.id}" type="button">Ver cadastro</button>${status==="pendente"?`<button class="sa-btn secondary" data-partner-request-action="em_analise" data-request-id="${r.id}" type="button">Iniciar análise</button>`:""}${canDecide?`<button class="sa-btn success" data-partner-request-action="aprovar" data-request-id="${r.id}" type="button">Aprovar e criar loja</button><button class="sa-btn warn" data-partner-request-action="pedir_correcao" data-request-id="${r.id}" type="button">Pedir correção</button><button class="sa-btn danger full" data-partner-request-action="recusar" data-request-id="${r.id}" type="button">Recusar entrada</button>`:""}</div></article>`;
    }).join(""):`<div class="sa-empty"><i class="fa-solid fa-handshake-angle"></i><strong>Nenhuma solicitação de parceiro aguardando decisão</strong></div>`;

    const groups = Object.fromEntries(["pendente","em_analise","aprovada","rejeitada"].map(k=>[k,state.controls.filter(c=>c.aprovacao_status===k).length]));
    $("#approvalPendingCount").textContent=groups.pendente||0; $("#approvalReviewCount").textContent=groups.em_analise||0; $("#approvalApprovedCount").textContent=groups.aprovada||0; $("#approvalRejectedCount").textContent=groups.rejeitada||0;
    const list = state.stores.filter(s => ["pendente","em_analise","rejeitada","rascunho"].includes(controlByStore(s.id).aprovacao_status)).sort((a,b)=>String(controlByStore(a.id).aprovacao_status).localeCompare(String(controlByStore(b.id).aprovacao_status)));
    $("#approvalsGrid").innerHTML = list.length ? list.map(s => { const c=controlByStore(s.id); return `<article class="sa-approval-card"><div class="sa-approval-top"><span class="sa-store-logo">${storeLogo(s)}</span><div><strong>${html(s.nome)}</strong><small>${html([s.cidade,s.estado].filter(Boolean).join(" - ")||"Localização não informada")}</small></div>${statusBadge(c.aprovacao_status)}</div><p>${html(s.descricao||"A hamburgueria ainda não adicionou uma descrição pública.")}</p><div class="sa-approval-checks"><span><i class="fa-solid ${s.logo_url?'fa-check':'fa-minus'}"></i> Logo</span><span><i class="fa-solid ${s.endereco?'fa-check':'fa-minus'}"></i> Endereço</span><span><i class="fa-solid ${s.whatsapp||s.telefone?'fa-check':'fa-minus'}"></i> Contato</span><span><i class="fa-solid ${s.descricao?'fa-check':'fa-minus'}"></i> Descrição</span></div><div class="sa-approval-actions"><button class="sa-btn secondary" data-open-store="${s.id}" type="button">Revisar loja</button>${c.aprovacao_status!=="aprovada"?`<button class="sa-btn success" data-store-action="aprovar" data-store-id="${s.id}" type="button">Autorizar publicação</button>`:""}${c.aprovacao_status!=="rejeitada"?`<button class="sa-btn danger full" data-store-action="rejeitar" data-store-id="${s.id}" type="button">Recusar publicação</button>`:""}</div></article>`; }).join("") : `<div class="sa-empty"><i class="fa-solid fa-badge-check"></i><strong>Nenhuma publicação aguardando decisão</strong></div>`;
  }

  function renderOrders() {
    const q = lower($("#orderSearch")?.value), status=$("#orderStatusFilter")?.value||"", store=$("#orderStoreFilter")?.value||"";
    const list=state.orders.filter(o=>(!q||`${o.id} ${o.cliente_nome} ${storeName(o.loja_id)}`.toLowerCase().includes(q))&&(!status||o.status===status)&&(!store||Number(o.loja_id)===Number(store)));
    $("#ordersTableBody").innerHTML=list.slice(0,500).map(o=>`<tr><td><strong>#${o.id}</strong><small>${html(o.tipo_entrega||"")}</small></td><td><strong>${html(storeName(o.loja_id))}</strong></td><td><strong>${html(o.cliente_nome||"Cliente")}</strong><small>${html(o.telefone||"")}</small></td><td>${statusBadge(o.status)}</td><td><strong>${html(o.forma_pagamento||"—")}</strong><small>${html(o.pagamento_status||"")}</small></td><td><strong>${money(o.total)}</strong></td><td>${dt(o.criado_em)}</td></tr>`).join("");
  }

  function renderUsers() {
    const q=lower($("#userSearch")?.value), status=$("#userStatusFilter")?.value||"";
    const list=state.profiles.filter(p=>{const c=userControl(p.id);return(!q||`${p.nome} ${p.email} ${p.telefone}`.toLowerCase().includes(q))&&(!status||c.status===status)});
    $("#usersTableBody").innerHTML=list.slice(0,1000).map(p=>{const c=userControl(p.id), stores=userStoreCount(p.id), isSA=state.team.some(x=>x.user_id===p.id&&x.ativo);return `<tr><td><div class="sa-store-cell"><span class="sa-store-logo">${html(initials(p.nome||p.email))}</span><div><strong>${html(p.nome||"Usuário")}${isSA?' <i class="fa-solid fa-shield-halved" style="color:#7c3aed"></i>':''}</strong><small>${html(p.email||"—")}</small></div></div></td><td><strong>${html(p.telefone||"—")}</strong><small>Último acesso: ${date(p.ultimo_acesso_em||p.ultimo_acesso)}</small></td><td>${badge(stores?"Parceiro":"Cliente",stores?"purple":"blue")}</td><td><strong>${stores}</strong></td><td><strong>${userOrderCount(p.id)}</strong></td><td>${statusBadge(c.status)}</td><td><div class="sa-action-row"><button class="sa-action-btn" data-open-user="${p.id}" title="Detalhes"><i class="fa-solid fa-eye"></i></button>${c.status!=="bloqueado"?`<button class="sa-action-btn" data-user-action="bloquear" data-user-id="${p.id}" title="Bloquear"><i class="fa-solid fa-user-lock"></i></button>`:`<button class="sa-action-btn" data-user-action="liberar" data-user-id="${p.id}" title="Liberar"><i class="fa-solid fa-user-check"></i></button>`}</div></td></tr>`}).join("");
  }

  function renderDriversAdmin(){
    const q=lower($("#driverSearch")?.value),status=$("#driverStatusFilter")?.value||"";
    const all=state.driverRequests||[],list=all.filter(r=>(!q||`${r.nome} ${r.telefone} ${r.email} ${r.cidade} ${r.estado} ${r.tipo_veiculo} ${r.placa}`.toLowerCase().includes(q))&&(!status||r.status===status));
    const count=s=>all.filter(r=>s.includes(r.status)).length;
    if($("#driverPendingCount"))$("#driverPendingCount").textContent=count(["pendente"]);if($("#driverReviewCount"))$("#driverReviewCount").textContent=count(["em_analise"]);if($("#driverApprovedCount"))$("#driverApprovedCount").textContent=count(["aprovada"]);if($("#driverAttentionCount"))$("#driverAttentionCount").textContent=count(["aguardando_correcao","rejeitada","suspensa"]);
    const wrap=$("#driverRequestsGrid");if(!wrap)return;wrap.innerHTML=list.length?list.map(r=>{const docs=Array.isArray(r.documentos)?r.documentos:[];return `<article class="sa-driver-card ${html(r.status)}"><div class="sa-driver-card-top"><span class="sa-driver-avatar"><i class="fa-solid fa-motorcycle"></i></span><div><strong>${html(r.nome)}</strong><small>${html(r.cidade||'—')} · ${html(r.estado||'—')} · ${html(r.telefone||'—')}</small></div>${statusBadge(r.status)}</div><div class="sa-driver-meta"><span>Veículo<strong>${html(String(r.tipo_veiculo||'—').replaceAll('_',' '))}${r.modelo_veiculo?` · ${html(r.modelo_veiculo)}`:''}</strong></span><span>Documento<strong>${html(r.cpf_mascarado||'—')}</strong></span><span>CNH<strong>${html(r.cnh_categoria||'Não se aplica')}${r.cnh_validade?` · ${date(r.cnh_validade)}`:''}</strong></span><span>Documentos<strong>${docs.length} enviado(s)</strong></span></div><div class="sa-driver-docs">${docs.slice(0,5).map(d=>`<span><i class="fa-solid fa-paperclip"></i> ${html(String(d.tipo||'arquivo').replaceAll('_',' '))}</span>`).join('')||'<span>Sem documentos</span>'}</div>${r.observacao_analise?`<div class="sa-driver-note"><i class="fa-solid fa-triangle-exclamation"></i> ${html(r.observacao_analise)}</div>`:''}<div class="sa-driver-actions"><button class="sa-btn secondary" data-open-driver="${r.id}" type="button">Revisar</button>${r.status==='pendente'?`<button class="sa-btn secondary" data-driver-action="analisar" data-driver-id="${r.id}" type="button">Iniciar análise</button>`:''}${['pendente','em_analise','aguardando_correcao','rejeitada'].includes(r.status)?`<button class="sa-btn success" data-driver-action="aprovar" data-driver-id="${r.id}" type="button">Aprovar</button>`:''}${r.status==='aprovada'?`<button class="sa-btn danger" data-driver-action="suspender" data-driver-id="${r.id}" type="button">Suspender</button>`:''}${r.status==='suspensa'?`<button class="sa-btn success" data-driver-action="reativar" data-driver-id="${r.id}" type="button">Reativar</button>`:''}</div></article>`}).join(''):`<div class="sa-empty"><i class="fa-solid fa-motorcycle"></i><strong>Nenhum entregador neste filtro</strong></div>`;
  }

  async function openDriverRequest(id){
    const r=state.driverRequests.find(x=>Number(x.id)===Number(id));if(!r)return;const docs=Array.isArray(r.documentos)?r.documentos:[];
    const docHtml=await Promise.all(docs.map(async d=>{let url='';try{const {data}=await db.storage.from('go-burger-drivers').createSignedUrl(d.storage_path,300);url=data?.signedUrl||''}catch{}return `<article class="sa-doc-review"><i class="fa-solid ${d.mime_type==='application/pdf'?'fa-file-pdf':'fa-image'}"></i><div><strong>${html(String(d.tipo||'documento').replaceAll('_',' '))}</strong><small>${html(d.nome_original||'Arquivo')} · ${html(d.status||'enviado')}</small></div>${url?`<a class="sa-btn secondary" href="${html(url)}" target="_blank" rel="noopener">Abrir</a>`:''}</article>`}));
    $("#entityModalContent").innerHTML=`<div class="sa-modal-head"><span>ENTREGADOR · #${r.id}</span><h2>${html(r.nome)}</h2><p>${html(r.email||'')} · ${html(r.telefone||'')}</p></div><div class="sa-detail-grid"><div class="sa-detail-item"><small>Status</small><strong>${html(String(r.status).replaceAll('_',' '))}</strong></div><div class="sa-detail-item"><small>CPF</small><strong>${html(r.cpf_mascarado||'—')}</strong></div><div class="sa-detail-item"><small>Nascimento</small><strong>${date(r.data_nascimento)}</strong></div><div class="sa-detail-item"><small>Localização</small><strong>${html([r.cidade,r.estado].filter(Boolean).join(' - ')||'—')}</strong></div><div class="sa-detail-item"><small>Veículo</small><strong>${html(String(r.tipo_veiculo||'—').replaceAll('_',' '))}</strong></div><div class="sa-detail-item"><small>Placa</small><strong>${html(r.placa||'—')}</strong></div></div>${r.observacoes?`<article class="sa-panel" style="margin-top:12px"><small>OBSERVAÇÕES DO CADASTRO</small><p style="font-size:9px;line-height:1.65">${html(r.observacoes)}</p></article>`:''}<div class="sa-doc-review-list">${docHtml.join('')||'<div class="sa-empty"><strong>Nenhum documento enviado</strong></div>'}</div><div class="sa-modal-actions"><button class="sa-btn secondary" data-driver-action="pedir_correcao" data-driver-id="${r.id}">Pedir correção</button><button class="sa-btn success" data-driver-action="aprovar" data-driver-id="${r.id}">Aprovar</button><button class="sa-btn danger" data-driver-action="rejeitar" data-driver-id="${r.id}">Rejeitar</button></div>`;openModal('entityModal');
  }

  async function driverRequestAction(id,action){
    let note=null;if(['pedir_correcao','rejeitar','suspender'].includes(action)){note=prompt(action==='pedir_correcao'?'O que o entregador precisa corrigir?':action==='suspender'?'Motivo da suspensão:':'Motivo da rejeição:');if(!note)return}
    if(action==='aprovar'&&!confirm('Aprovar este perfil de entregador após revisar os documentos?'))return;
    try{const {error}=await db.rpc('go_burger_super_admin_acao_entregador_v45',{p_solicitacao_id:Number(id),p_acao:action,p_observacao:note});if(error)throw error;toast(`Cadastro de entregador atualizado: ${action.replaceAll('_',' ')}.`);closeAllModals();await loadAll({silent:true})}catch(e){toast(e.message||'Não foi possível atualizar o entregador.','error')}
  }

  const financeCheckLabels={
    recebedor_validado:"Recebedor validado",kyc_aprovado:"KYC aprovado",credenciais_configuradas:"Credenciais do provedor",webhook_configurado:"Webhook verificado",sandbox_e2e_aprovado:"Fluxo E2E em sandbox",reconciliacao_configurada:"Conciliação financeira",repasses_configurados:"Fluxo de repasse",termos_financeiros_aprovados:"Termos financeiros",revisao_juridica_fiscal:"Revisão jurídica/fiscal"
  };

  async function loadFinancePreparation({silent=false}={}){
    if(!silent){const el=$("#financeReadySummary");if(el)el.textContent="Atualizando checklist...";}
    const {data,error}=await db.rpc("go_burger_finance_preparacao_v612");
    if(error){state.financePrep=null;toast(error.message||"Não foi possível carregar a preparação financeira.","error");return null;}
    state.financePrep=data||{};renderFinancePreparation();return state.financePrep;
  }

  function renderFinancePreparation(){
    const data=state.financePrep||{},prep=data.preparacao||{},live=data.live||{},checks=data.checks||{},counts=data.counts||{};
    if($("#financeLiveStatus"))$("#financeLiveStatus").textContent=live.finance_enabled?"ATIVO":"Desativado";
    if($("#financeLiveCommission"))$("#financeLiveCommission").textContent=`${Number(live.comissao_efetiva||0).toLocaleString("pt-BR")}%`;
    if($("#financePrepEnvironment"))$("#financePrepEnvironment").textContent=String(prep.ambiente||"desativado").replaceAll("_"," ");
    if($("#financeReadyStatus"))$("#financeReadyStatus").textContent=data.ready_for_activation?"Pronto para decisão":"Bloqueado";
    const blockers=Array.isArray(data.blockers)?data.blockers:[];
    if($("#financeReadySummary"))$("#financeReadySummary").textContent=data.ready_for_activation?"Checklist técnico completo; produção continua desativada até ativação separada.":`${blockers.length} requisito(s) ainda pendente(s).`;
    const checklist=$("#financeActivationChecklist");
    if(checklist)checklist.innerHTML=Object.entries(financeCheckLabels).map(([key,label])=>{const ok=checks[key]===true;return `<div class="gb-finance-check-item ${ok?'ok':'pending'}"><i class="fa-solid ${ok?'fa-circle-check':'fa-clock'}"></i><div><strong>${html(label)}</strong><small>${ok?'Concluído':'Pendente antes do go-live financeiro'}</small></div></div>`}).join("");
    const structure=$("#financeStructureCounts");
    if(structure)structure.innerHTML=[["Transações",counts.transacoes],["Splits",counts.splits],["Reembolsos",counts.reembolsos],["Contas de parceiros",counts.seller_accounts]].map(([label,value])=>`<div><span>${label}</span><strong>${number(value||0)}</strong></div>`).join("");
    const f=$("#financePreparationForm");
    if(f){
      ["ambiente","provedor_preferido","modelo_liquidacao","comissao_rascunho","recebedor_tipo","recebedor_status","pix_tipo","kyc_status","observacoes"].forEach(k=>{if(f.elements[k])f.elements[k].value=prep[k]??""});
      if(f.elements.pix_secret_ref)f.elements.pix_secret_ref.value=data.pix_secret_configurado?"CONFIGURADO_NO_VAULT":"";
      ["credenciais_configuradas","webhook_configurado","sandbox_e2e_aprovado","reconciliacao_configurada","repasses_configurados","termos_financeiros_aprovados","revisao_juridica_fiscal"].forEach(k=>{if(f.elements[k])f.elements[k].checked=prep[k]===true});
    }
  }

  async function saveFinancePreparation(e){
    e.preventDefault();const f=e.currentTarget,secretRaw=f.elements.pix_secret_ref.value.trim();
    const payload={p_ambiente:f.elements.ambiente.value,p_provedor_preferido:f.elements.provedor_preferido.value,p_modelo_liquidacao:f.elements.modelo_liquidacao.value,p_comissao_rascunho:Number(f.elements.comissao_rascunho.value||0),p_recebedor_tipo:f.elements.recebedor_tipo.value,p_recebedor_status:f.elements.recebedor_status.value,p_pix_tipo:f.elements.pix_tipo.value||null,p_pix_secret_ref:secretRaw&&secretRaw!=="CONFIGURADO_NO_VAULT"?secretRaw:null,p_kyc_status:f.elements.kyc_status.value,p_credenciais_configuradas:f.elements.credenciais_configuradas.checked,p_webhook_configurado:f.elements.webhook_configurado.checked,p_sandbox_e2e_aprovado:f.elements.sandbox_e2e_aprovado.checked,p_reconciliacao_configurada:f.elements.reconciliacao_configurada.checked,p_repasses_configurados:f.elements.repasses_configurados.checked,p_termos_financeiros_aprovados:f.elements.termos_financeiros_aprovados.checked,p_revisao_juridica_fiscal:f.elements.revisao_juridica_fiscal.checked,p_observacoes:f.elements.observacoes.value.trim()||null};
    const button=f.querySelector('button[type="submit"]');if(button)button.disabled=true;
    const {data,error}=await db.rpc("go_burger_finance_preparacao_salvar_v612",payload);if(button)button.disabled=false;
    if(error)return toast(error.message||"Não foi possível salvar a preparação financeira.","error");state.financePrep=data||{};renderFinancePreparation();toast("Preparação financeira salva. Dinheiro real continua desativado.");
  }

  async function simulateFinanceSplit(e){
    e.preventDefault();const f=e.currentTarget,value=Number(f.elements.valor_bruto.value||0),pctRaw=f.elements.comissao_percentual.value.trim();
    const {data,error}=await db.rpc("go_burger_finance_simular_split_v612",{p_valor_bruto:value,p_comissao_percentual:pctRaw===""?null:Number(pctRaw)});const out=$("#financeSimulatorResult");
    if(error){if(out)out.innerHTML=`<span>${html(error.message||"Simulação indisponível")}</span>`;return;}
    if(out)out.innerHTML=`<div class="gb-finance-sim-grid"><div><small>Pedido</small><strong>${money(data.valor_bruto)}</strong></div><div><small>Comissão Go-burger</small><strong>${money(data.comissao_plataforma)}</strong></div><div><small>Loja</small><strong>${money(data.valor_liquido_loja)}</strong></div><div><small>Percentual</small><strong>${Number(data.comissao_percentual||0).toLocaleString("pt-BR")}%</strong></div></div><span>Simulação apenas matemática; taxas do provedor não estão incluídas e nenhum registro financeiro foi criado.</span>`;
  }

  function renderFinance() {
    $("#financeSubscriptionsBody").innerHTML=state.subscriptions.map(s=>{const store=storeById(s.loja_id),plan=planById(s.plano_id);return `<tr><td><strong>${html(store?.nome||`Loja #${s.loja_id}`)}</strong></td><td>${html(plan?.nome||"—")}</td><td>${statusBadge(s.status)}</td><td>${money(s.valor_mensal)}</td><td>${Number(s.comissao_percentual||0).toLocaleString("pt-BR")}%</td><td>${date(s.proxima_cobranca)}</td></tr>`}).join("");
  }

  function renderPlans() {
    const grid=$("#plansGrid");if(!grid)return;
    if(!state.plans.length){grid.innerHTML='<div class="sa-empty"><i class="fa-solid fa-gem"></i><strong>Nenhum plano configurado</strong></div>';return;}
    const limit=v=>v==null?"∞":Number(v).toLocaleString("pt-BR");
    const resourceName=key=>state.planResources.find(r=>r.chave===key)?.nome||String(key).replaceAll('_',' ');
    grid.innerHTML=state.plans.map(p=>{
      const features=Object.entries(p.recursos||{}).filter(([,v])=>v===true).slice(0,6);
      const annual=p.preco_anual==null?Number(p.preco_mensal||0)*12:Number(p.preco_anual||0);
      const save=Math.max(0,Number(p.preco_mensal||0)*12-annual);
      return `<article class="sa-plan-card ${p.destaque?'featured':''}"><span>${p.ativo?'PLANO ATIVO':'INATIVO'} · v${Number(p.versao||1)}</span>${p.badge_texto?`<b class="sa-plan-card-badge">${html(p.badge_texto)}</b>`:''}<h3>${html(p.nome)}</h3><div class="sa-plan-price"><strong>${money(p.preco_mensal)}</strong><small>/mês</small></div><p>${html(p.descricao||"Plano da Go-burger.")}</p><div class="sa-plan-limits"><span>${limit(p.limite_produtos)} produtos</span><span>${limit(p.limite_usuarios)} usuários</span><span>${limit(p.limite_banners)} banners</span></div><div class="sa-plan-features">${features.map(([k])=>`<span><i class="fa-solid fa-check"></i>${html(resourceName(k))}</span>`).join("")||'<span><i class="fa-solid fa-check"></i>Recursos básicos</span>'}</div><div class="sa-plan-meta"><span>${Number(p.trial_dias||0)>0?`${Number(p.trial_dias)} dias trial`:'Sem trial'}</span><span>${Number(p.assinaturas_total||0)} ativa(s)</span><span>${Number(p.intencoes_pendentes||0)} pendente(s)</span>${save>0?`<span>Economia anual ${money(save)}</span>`:''}</div><div class="sa-plan-draft"><span>Comissão planejada</span><strong>${Number(p.comissao_rascunho_percentual??p.comissao_percentual??0).toLocaleString('pt-BR')}%</strong><small>rascunho · efetiva 0%</small></div><div class="sa-plan-footer"><button class="sa-btn secondary" data-edit-plan="${p.id}" type="button"><i class="fa-solid fa-pen"></i> Editar</button></div></article>`;
    }).join("");
  }


  function planCommercialEmpty(icon,title){return `<div class="sa-empty"><i class="fa-solid ${icon}"></i><strong>${html(title)}</strong></div>`;}
  function renderPlanCommercialP660(){
    const c=state.planCommercial||{},coupons=Array.isArray(c.coupons)?c.coupons:[],promos=Array.isArray(c.promotions)?c.promotions:[],offers=Array.isArray(c.offers)?c.offers:[],courtesies=Array.isArray(c.courtesies)?c.courtesies:[],summary=c.sandbox_summary||{},gateway=c.gateway||{},billing=c.billing_config||{};
    const setText=(id,v)=>{const el=$(id);if(el)el.textContent=String(v??0)};
    setText('#planCommercialCouponCount',coupons.length);setText('#planCommercialPromoCount',promos.length);setText('#planCommercialOfferCount',offers.length);setText('#planCommercialCourtesyCount',courtesies.filter(x=>x.status==='ativa').length);setText('#planCommercialCheckoutCount',summary.checkouts||0);
    const couponBox=$('#planCommercialCoupons');if(couponBox)couponBox.innerHTML=coupons.length?coupons.map(x=>`<article><div><strong>${html(x.codigo)} · ${html(x.nome)}</strong><small>${html(x.tipo_desconto)} ${Number(x.valor_desconto||0).toLocaleString('pt-BR')} · ${x.ativo?'ativo':'inativo'}</small></div>${statusBadge(x.ativo?'ativo':'inativo')}</article>`).join(''):planCommercialEmpty('fa-ticket','Nenhum cupom de assinatura');
    const promoBox=$('#planCommercialPromotions');if(promoBox)promoBox.innerHTML=promos.length?promos.map(x=>`<article><div><strong>${html(x.nome)}</strong><small>${html(x.tipo_desconto)} ${Number(x.valor||0).toLocaleString('pt-BR')} · prioridade ${Number(x.prioridade||100)}</small></div>${statusBadge(x.ativo?'ativa':'inativa')}</article>`).join(''):planCommercialEmpty('fa-tags','Nenhuma promoção');
    const offerBox=$('#planCommercialOffers');if(offerBox)offerBox.innerHTML=offers.length?offers.map(x=>`<article><div><strong>${html(storeName(x.loja_id))} · ${html(planById(x.plano_id)?.nome||`Plano #${x.plano_id}`)}</strong><small>${money(x.preco_ofertado)} · ${html(x.ciclo)} · ${html(x.status)}</small></div>${statusBadge(x.status)}</article>`).join(''):planCommercialEmpty('fa-handshake','Nenhuma oferta personalizada');
    const courBox=$('#planCommercialCourtesies');if(courBox)courBox.innerHTML=courtesies.length?courtesies.map(x=>`<article><div><strong>${html(storeName(x.loja_id))} · ${html(planById(x.plano_id)?.nome||`Plano #${x.plano_id}`)}</strong><small>${html(x.tipo)} · ${html(x.motivo||'')}</small></div><div>${statusBadge(x.status)}${x.status==='ativa'?`<button class="sa-action-btn" type="button" data-revoke-plan-courtesy="${x.id}" title="Revogar cortesia"><i class="fa-solid fa-xmark"></i></button>`:''}</div></article>`).join(''):planCommercialEmpty('fa-gift','Nenhuma cortesia');
    const gate=$('#planGatewayReadiness');if(gate)gate.innerHTML=`<div class="sa-readiness-item"><i class="fa-solid ${gateway.ready?'fa-check':'fa-clock'}"></i><div><strong>Mercado Pago · sandbox</strong><small>${gateway.ready?'Referências de teste configuradas':'Ainda faltam referências de teste'}</small></div><b>${gateway.ready?'PRONTO':'PREPARAÇÃO'}</b></div><div class="sa-readiness-item"><i class="fa-solid fa-lock"></i><div><strong>Produção</strong><small>Bloqueada por contrato da release P660</small></div><b>OFF</b></div>`;
    const bill=$('#planBillingReadiness');if(bill)bill.innerHTML=`<div class="sa-readiness-item"><i class="fa-solid fa-clock"></i><div><strong>Grace</strong><small>${Number(billing.grace_dias||0)} dias · retries ${(billing.retry_dias||[]).join(', ')||'—'}</small></div><b>DRY-RUN</b></div><div class="sa-readiness-item"><i class="fa-solid fa-shield-halved"></i><div><strong>Inadimplência automática</strong><small>Somente preview nesta release</small></div><b>OFF</b></div>`;
  }

  function renderPlanOpsP680(){
    const o=state.planOps||{},f=o.funnel||{},dist=Array.isArray(o.por_plano)?o.por_plano:[],rec=o.recovery||{};
    const set=(id,val)=>{const el=$(id);if(el)el.textContent=val;};
    set("#planOpsMrr",money(o.mrr_estimado||0));set("#planOpsArr",money(o.arr_estimado||0));set("#planOpsArpu",money(o.arpu_estimado||0));set("#planOpsChurn",`${Number(o.churn_estimado_pct||0).toLocaleString("pt-BR",{maximumFractionDigits:2})}%`);
    const funnel=$("#planOpsFunnel");if(funnel)funnel.innerHTML=[["Seleções",f.selecoes],["Pendentes",f.selecoes_pendentes],["Trials",f.trials_iniciados],["Ativas",f.assinaturas_ativas],["Isentas",f.isentas],["Canceladas",f.canceladas]].map(([k,v])=>`<div><small>${html(k)}</small><strong>${number(v||0)}</strong></div>`).join("");
    const body=$("#planOpsDistributionBody");if(body)body.innerHTML=dist.length?dist.map(x=>`<tr><td><strong>${html(x.plano)}</strong></td><td>${number(x.assinaturas||0)}</td><td>${number(x.ativas||0)}</td><td>${money(x.mrr_estimado||0)}</td></tr>`).join(""):`<tr><td colspan="4"><div class="sa-empty"><strong>Sem dados de planos</strong></div></td></tr>`;
    const recovery=$("#planRecoverySummary");if(recovery)recovery.innerHTML=`<span>${number(rec.candidatos||0)} candidato(s) sandbox</span><span>${number(rec.casos_abertos||0)} caso(s) aberto(s)</span><span>Produção ${o.finance_live?'ON':'OFF'}</span>`;
    const opts=state.plans.filter(p=>p.ativo!==false).map(p=>`<option value="${p.id}">${html(p.nome)}</option>`).join("");
    ["#planMigrationFrom","#planMigrationTo"].forEach(id=>{const el=$(id);if(el&&el.dataset.loaded!=="1"){el.innerHTML=opts;el.dataset.loaded="1";}});
    const from=$("#planMigrationFrom"),to=$("#planMigrationTo");if(from&&to&&from.value===to.value&&to.options.length>1)to.selectedIndex=1;
  }

  function renderPlanMigrationPreviewP680(data){
    const box=$("#planMigrationResult");if(!box)return;const shops=Array.isArray(data?.lojas)?data.lojas:[],ok=shops.filter(x=>x.elegivel).length,bad=shops.length-ok;
    box.innerHTML=`<div class="summary"><span>${shops.length} loja(s)</span><span>${ok} elegível(is)</span><span>${bad} bloqueada(s)</span></div><div class="sa-plan-migration-list">${shops.length?shops.map(x=>`<article><div><strong>${html(x.loja_nome||`Loja #${x.loja_id}`)}</strong><small>Produtos ${number(x.uso?.produtos||0)} · Equipe ${number(x.uso?.usuarios||0)} · Banners ${number(x.uso?.banners||0)}</small>${!x.elegivel?`<small>${html((x.blockers||[]).join(" · "))}</small>`:''}</div><b class="${x.elegivel?'ok':'blocked'}">${x.elegivel?'ELEGÍVEL':'BLOQUEADA'}</b></article>`).join(""):'<article><div><strong>Nenhuma loja vinculada ao plano origem.</strong></div></article>'}</div><button class="sa-btn secondary" type="button" data-create-plan-migration ${shops.length?'':'disabled'}><i class="fa-solid fa-layer-group"></i> Criar lote rascunho</button>`;
  }

  async function previewPlanMigrationP680(e){e.preventDefault();const from=Number($("#planMigrationFrom")?.value),to=Number($("#planMigrationTo")?.value);if(!from||!to||from===to)return toast("Escolha planos de origem e destino diferentes.","error");const btn=e.currentTarget.querySelector('button[type="submit"]');btn&&(btn.disabled=true);try{const {data,error}=await db.rpc("go_burger_plano_migracao_preview_v667",{p_plano_origem_id:from,p_plano_destino_id:to});if(error)throw error;state.planMigrationPreview={from,to,data};renderPlanMigrationPreviewP680(data);}catch(err){toast(err.message||"Falha no preview da migração.","error");}finally{btn&&(btn.disabled=false);}}

  async function createPlanMigrationP680(){const p=state.planMigrationPreview;if(!p)return toast("Faça o preview primeiro.","error");const typed=prompt('Digite exatamente: CRIAR LOTE DE MIGRACAO');if(typed!=="CRIAR LOTE DE MIGRACAO")return toast("Confirmação incorreta. Lote não criado.","info");const {data,error}=await db.rpc("go_burger_plano_migracao_lote_criar_v666",{p_plano_origem_id:p.from,p_plano_destino_id:p.to,p_aplicar_em:null,p_confirmacao:typed});if(error)return toast(error.message,"error");toast(`Lote #${data.lote_id} criado em rascunho. Nenhuma migração foi executada.`);state.planMigrationPreview=null;renderPlanOpsP680();}

  function renderPlanFinalP700(){
    const f=state.planFinal||{},c=state.planCentral||{},r=f.readiness||{},q=f.qa||{},blockers=Array.isArray(r.blockers)?r.blockers:[],pilots=Array.isArray(c.piloto)?c.piloto:[],enterprise=Array.isArray(c.enterprise)?c.enterprise:[],addons=Array.isArray(c.addons)?c.addons:[];
    const set=(id,v)=>{const el=$(id);if(el)el.textContent=String(v??"—")};
    set("#planP700Status",f.status||"release_candidate_pilot_ready");set("#planP700KillSwitchState",f.kill_switch_engaged?"ENGAJADO":"—");set("#planP700Billing",f.production_billing_allowed?"ON":"OFF");set("#planP700PilotCount",pilots.filter(x=>x.status==='aprovada').length);
    const ready=$("#planP700Readiness");if(ready)ready.innerHTML=`<div class="sa-plan-final-banner ${f.qa_passed?'ok':'warn'}"><i class="fa-solid ${f.qa_passed?'fa-circle-check':'fa-triangle-exclamation'}"></i><div><strong>Planos 1.0 · ${html(f.release||'P700')}</strong><p>Código ${f.code_complete?'completo':'em andamento'} · piloto ${f.pilot_ready?'pronto':'pendente'} · produção financeira OFF.</p></div></div>${blockers.length?`<div class="sa-plan-blocker-list">${blockers.map(x=>`<span><i class="fa-solid fa-lock"></i>${html(String(x))}</span>`).join('')}</div>`:'<div class="sa-empty"><strong>Nenhum blocker listado.</strong></div>'}`;
    const qa=$("#planP700Qa");if(qa){const checks=q.checks||{};qa.innerHTML=Object.entries(checks).map(([k,v])=>`<span class="${v===false?'bad':'ok'}"><i class="fa-solid ${v===false?'fa-xmark':'fa-check'}"></i>${html(k.replaceAll('_',' '))}: ${html(String(v))}</span>`).join('');}
    const pilot=$("#planP700Pilots");if(pilot)pilot.innerHTML=pilots.length?pilots.map(x=>`<article><div><strong>${html(x.nome||storeName(x.loja_id))}</strong><small>${html(x.observacoes||'Piloto sem cobrança')}</small></div>${statusBadge(x.status)}</article>`).join(''):planCommercialEmpty('fa-flask','Nenhuma loja no piloto');
    const ent=$("#planP700Enterprise");if(ent)ent.innerHTML=enterprise.length?enterprise.map(x=>`<article><div><strong>${html(storeName(x.loja_id))} · Enterprise</strong><small>${money(x.preco_mensal_rascunho||0)}/mês · rascunho</small></div>${statusBadge(x.status)}</article>`).join(''):planCommercialEmpty('fa-building','Nenhuma proposta Enterprise');
    const ad=$("#planP700Addons");if(ad)ad.innerHTML=addons.length?addons.map(x=>`<article><div><strong>${html(x.nome)}</strong><small>${html(x.slug)} · ${x.ativo?'ativo':'template inativo'}</small></div>${statusBadge(x.ativo?'ativo':'inativo')}</article>`).join(''):planCommercialEmpty('fa-puzzle-piece','Nenhum add-on cadastrado');
  }

  async function setPlanPilotModeP700(mode){const phrase=mode==='pilot_no_charge'?'ARMAR PILOTO SEM COBRANCA':'DESATIVAR PILOTO';if(!confirm(mode==='pilot_no_charge'?'Armar piloto SEM cobrança real?':'Desativar o piloto de planos?'))return;const {error}=await db.rpc('go_burger_planos_ativacao_controlada_v699',{p_modo:mode,p_confirmacao:phrase});if(error)return toast(error.message,'error');toast(mode==='pilot_no_charge'?'Piloto sem cobrança armado.':'Piloto desativado.');await loadAll({silent:true});}
  async function engagePlanKillSwitchP700(){if(!confirm('Engajar o kill switch e manter toda cobrança de planos desligada?'))return;const {error}=await db.rpc('go_burger_planos_kill_switch_v693',{p_engage:true,p_confirmacao:'ENGAGE PLAN KILL SWITCH'});if(error)return toast(error.message,'error');toast('Kill switch de planos engajado.');await loadAll({silent:true});}
  function openPlanPilotP700(){commercialModal('Adicionar loja ao piloto P700','Piloto sem cobrança e sem comissão real.',`<form class="sa-form-grid modal-grid"><label class="span-2"><span>Hamburgueria</span><select name="loja_id" required>${storeSelectOptions()}</select></label><label><span>Status</span><select name="status"><option value="candidata">Candidata</option><option value="aprovada">Aprovada</option><option value="pausada">Pausada</option><option value="concluida">Concluída</option></select></label><label class="span-2"><span>Observações</span><textarea name="obs" rows="3"></textarea></label><button class="sa-btn primary span-2" type="submit">Salvar piloto</button></form>`,async f=>{const {error}=await db.rpc('go_burger_planos_piloto_admin_v695',{p_loja_id:Number(f.loja_id.value),p_status:f.status.value,p_observacoes:f.obs.value||null});if(error)throw error;});}
  function openPlanEnterpriseP700(){commercialModal('Proposta Enterprise','Rascunho comercial; não cria cobrança nem altera plano automaticamente.',`<form class="sa-form-grid modal-grid"><label class="span-2"><span>Hamburgueria</span><select name="loja_id" required>${storeSelectOptions()}</select></label><label><span>Mensal rascunho</span><input name="mensal" type="number" min="0" step="0.01" value="0"></label><label><span>Anual rascunho</span><input name="anual" type="number" min="0" step="0.01" value="0"></label><label class="span-2"><span>Observações</span><textarea name="obs" rows="3"></textarea></label><button class="sa-btn primary span-2" type="submit">Criar rascunho Enterprise</button></form>`,async f=>{const {error}=await db.rpc('go_burger_plano_enterprise_proposta_v686',{p_loja_id:Number(f.loja_id.value),p_preco_mensal:Number(f.mensal.value||0),p_preco_anual:Number(f.anual.value||0),p_limites:{},p_recursos:{},p_observacoes:f.obs.value||null});if(error)throw error;});}

  function planSelectOptions(selected=''){return state.plans.filter(p=>p.ativo!==false).map(p=>`<option value="${p.id}" ${String(p.id)===String(selected)?'selected':''}>${html(p.nome)}</option>`).join('');}
  function storeSelectOptions(selected=''){return state.stores.filter(s=>s.status!=='arquivada').map(s=>`<option value="${s.id}" ${String(s.id)===String(selected)?'selected':''}>${html(s.nome)}</option>`).join('');}
  function commercialModal(title,subtitle,formHtml,onSubmit){const host=$('#entityModalContent');if(!host)return;host.innerHTML=`<div class="sa-modal-head"><span>P641–P660 · SANDBOX</span><h2>${html(title)}</h2><p>${html(subtitle)}</p></div>${formHtml}`;openModal('entityModal');const form=host.querySelector('form');form?.addEventListener('submit',async e=>{e.preventDefault();const b=form.querySelector('[type="submit"]'),old=b?.innerHTML;if(b){b.disabled=true;b.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Salvando...';}try{await onSubmit(form);closeModal('entityModal');await loadAll({silent:true});toast('Configuração salva em modo de preparação.');}catch(err){toast(err.message||'Não foi possível salvar.','error');}finally{if(b){b.disabled=false;b.innerHTML=old;}}});}
  function openPlanCouponP660(){commercialModal('Novo cupom de assinatura','O desconto só é usado em preview/checkout sandbox.',`<form class="sa-form-grid modal-grid"><label><span>Código</span><input name="codigo" required maxlength="40"></label><label><span>Nome</span><input name="nome" required></label><label><span>Plano</span><select name="plano_id"><option value="">Todos</option>${planSelectOptions()}</select></label><label><span>Ciclo</span><select name="ciclo"><option value="">Todos</option><option value="mensal">Mensal</option><option value="anual">Anual</option></select></label><label><span>Tipo</span><select name="tipo"><option value="percentual">Percentual</option><option value="fixo">Valor fixo</option></select></label><label><span>Desconto</span><input name="valor" type="number" min="0" step="0.01" required></label><label><span>Ciclos</span><input name="ciclos" type="number" min="1" value="1"></label><label><span>Uso máximo</span><input name="uso" type="number" min="1"></label><label class="span-2 check-field"><input name="ativo" type="checkbox" checked> Ativo</label><button class="sa-btn primary span-2" type="submit">Salvar cupom</button></form>`,async f=>{const {error}=await db.rpc('go_burger_plano_cupom_admin_salvar_v641',{p_id:null,p_codigo:f.codigo.value,p_nome:f.nome.value,p_descricao:null,p_plano_id:f.plano_id.value?Number(f.plano_id.value):null,p_ciclo:f.ciclo.value||null,p_tipo_desconto:f.tipo.value,p_valor_desconto:Number(f.valor.value),p_ciclos_aplicaveis:Number(f.ciclos.value||1),p_uso_maximo:f.uso.value?Number(f.uso.value):null,p_inicia_em:null,p_termina_em:null,p_ativo:f.ativo.checked});if(error)throw error;});}
  function openPlanPromoP660(){commercialModal('Nova promoção de plano','A promoção altera apenas valores de simulação/sandbox.',`<form class="sa-form-grid modal-grid"><label class="span-2"><span>Nome</span><input name="nome" required></label><label><span>Plano</span><select name="plano_id"><option value="">Todos</option>${planSelectOptions()}</select></label><label><span>Ciclo</span><select name="ciclo"><option value="">Todos</option><option value="mensal">Mensal</option><option value="anual">Anual</option></select></label><label><span>Tipo</span><select name="tipo"><option value="percentual">Percentual</option><option value="fixo">Valor fixo</option><option value="preco_final">Preço final</option></select></label><label><span>Valor</span><input name="valor" type="number" min="0" step="0.01" required></label><label><span>Prioridade</span><input name="prioridade" type="number" value="100"></label><label class="check-field"><input name="publica" type="checkbox" checked> Pública</label><label class="check-field"><input name="ativo" type="checkbox" checked> Ativa</label><button class="sa-btn primary span-2" type="submit">Salvar promoção</button></form>`,async f=>{const {error}=await db.rpc('go_burger_plano_promocao_admin_salvar_v642',{p_id:null,p_nome:f.nome.value,p_descricao:null,p_plano_id:f.plano_id.value?Number(f.plano_id.value):null,p_ciclo:f.ciclo.value||null,p_tipo_desconto:f.tipo.value,p_valor:Number(f.valor.value),p_inicia_em:null,p_termina_em:null,p_publica:f.publica.checked,p_prioridade:Number(f.prioridade.value||100),p_ativo:f.ativo.checked});if(error)throw error;});}
  function openPlanOfferP660(){commercialModal('Oferta por hamburgueria','Condição personalizada sem cobrar dinheiro nesta release.',`<form class="sa-form-grid modal-grid"><label class="span-2"><span>Hamburgueria</span><select name="loja_id" required>${storeSelectOptions()}</select></label><label><span>Plano</span><select name="plano_id" required>${planSelectOptions()}</select></label><label><span>Ciclo</span><select name="ciclo"><option value="mensal">Mensal</option><option value="anual">Anual</option></select></label><label><span>Preço ofertado</span><input name="preco" type="number" min="0" step="0.01" required></label><label><span>Comissão rascunho</span><input name="comissao" type="number" min="0" max="100" step="0.01" value="0"></label><label class="span-2"><span>Observação</span><input name="obs"></label><button class="sa-btn primary span-2" type="submit">Criar oferta</button></form>`,async f=>{const {error}=await db.rpc('go_burger_plano_oferta_admin_criar_v643',{p_loja_id:Number(f.loja_id.value),p_plano_id:Number(f.plano_id.value),p_ciclo:f.ciclo.value,p_preco:Number(f.preco.value),p_comissao_rascunho:Number(f.comissao.value||0),p_termina_em:null,p_observacoes:f.obs.value||null});if(error)throw error;});}
  function openPlanCourtesyP660(){commercialModal('Conceder cortesia','Isenção administrativa. Comissão efetiva fica em 0%.',`<form class="sa-form-grid modal-grid"><label class="span-2"><span>Hamburgueria</span><select name="loja_id" required>${storeSelectOptions()}</select></label><label><span>Plano</span><select name="plano_id" required>${planSelectOptions()}</select></label><label><span>Tipo</span><select name="tipo"><option value="temporaria">Temporária</option><option value="interna">Interna</option><option value="vitalicia">Vitalícia</option></select></label><label><span>Dias (temporária)</span><input name="dias" type="number" min="1" value="30"></label><label class="span-2"><span>Motivo</span><textarea name="motivo" required rows="3"></textarea></label><button class="sa-btn primary span-2" type="submit">Conceder cortesia</button></form>`,async f=>{const {error}=await db.rpc('go_burger_plano_cortesia_conceder_v645',{p_loja_id:Number(f.loja_id.value),p_plano_id:Number(f.plano_id.value),p_tipo:f.tipo.value,p_dias:f.tipo.value==='temporaria'?Number(f.dias.value||30):null,p_motivo:f.motivo.value});if(error)throw error;});}
  function openPlanBillingConfigP660(){const c=state.planCommercial?.billing_config||{};commercialModal('Grace & cobrança futura','As regras ficam em dry-run. Inadimplência automática continua desligada.',`<form class="sa-form-grid modal-grid"><label><span>Grace (dias)</span><input name="grace" type="number" min="0" max="30" value="${Number(c.grace_dias||5)}"></label><label><span>Retries (dias, vírgula)</span><input name="retries" value="${html((c.retry_dias||[1,3,5]).join(','))}"></label><label><span>Suspender após</span><input name="suspender" type="number" min="1" value="${Number(c.suspender_apos_dias||15)}"></label><label><span>Cancelável após</span><input name="cancelar" type="number" min="1" value="${Number(c.cancelar_apos_dias||45)}"></label><button class="sa-btn primary span-2" type="submit">Salvar dry-run</button></form>`,async f=>{const retry=f.retries.value.split(',').map(x=>Number(x.trim())).filter(Number.isFinite);const {error}=await db.rpc('go_burger_plano_cobranca_config_salvar_v651',{p_grace_dias:Number(f.grace.value),p_retry_dias:retry,p_suspender:Number(f.suspender.value),p_cancelar:Number(f.cancelar.value)});if(error)throw error;});}
  function openPlanGatewayConfigP660(){const g=state.planCommercial?.gateway||{};commercialModal('Mercado Pago · sandbox','Informe apenas REFERÊNCIAS de segredos seguros. Não cole Access Token no navegador.',`<form class="sa-form-grid modal-grid"><label><span>Public key ref</span><input name="public_ref" value="${html(g.public_key_ref||'')}"></label><label><span>Access token secret ref</span><input name="token_ref" placeholder="vault://..."></label><label><span>Webhook secret ref</span><input name="webhook_ref" placeholder="vault://..."></label><label><span>URL webhook de teste</span><input name="webhook_url" type="url" value="${html(g.webhook_test_url||'')}"></label><label><span>Test seller ref</span><input name="seller"></label><label><span>Test buyer ref</span><input name="buyer"></label><label class="span-2 check-field"><input name="enabled" type="checkbox"> Marcar adapter sandbox habilitado</label><div class="sa-inline-alert info span-2"><i class="fa-solid fa-lock"></i><div><strong>Produção permanece bloqueada</strong><p>Esta configuração não ativa cobrança externa.</p></div></div><button class="sa-btn primary span-2" type="submit">Salvar referências</button></form>`,async f=>{const {error}=await db.rpc('go_burger_plano_gateway_config_salvar_v657',{p_public_key_ref:f.public_ref.value||null,p_access_token_secret_ref:f.token_ref.value||null,p_webhook_secret_ref:f.webhook_ref.value||null,p_webhook_test_url:f.webhook_url.value||null,p_test_seller_ref:f.seller.value||null,p_test_buyer_ref:f.buyer.value||null,p_habilitado:f.enabled.checked});if(error)throw error;});}
  async function revokePlanCourtesyP660(id){if(!confirm('Revogar esta cortesia e retornar a loja ao Grátis?'))return;const {error}=await db.rpc('go_burger_plano_cortesia_revogar_v645',{p_cortesia_id:Number(id)});if(error)return toast(error.message,'error');toast('Cortesia revogada.');await loadAll({silent:true});}

  function renderMarketing() {
    $("#platformBannersGrid").innerHTML=state.banners.length?state.banners.map(b=>`<article class="sa-banner-card">${b.imagem_url?`<img src="${html(b.imagem_url)}" alt="">`:""}<div class="sa-banner-copy"><small>${html(b.publico?.toUpperCase()||"TODOS")}</small><strong>${html(b.titulo)}</strong><p>${html(b.subtitulo||"")}</p><div class="sa-banner-actions"><button data-edit-banner="${b.id}" title="Editar"><i class="fa-solid fa-pen"></i></button><button data-delete-banner="${b.id}" title="Excluir"><i class="fa-solid fa-trash"></i></button></div></div></article>`).join(""):`<div class="sa-empty"><i class="fa-solid fa-images"></i><strong>Nenhum banner global</strong></div>`;
    $("#campaignList").innerHTML=state.campaigns.length?state.campaigns.slice(0,12).map(c=>`<article class="sa-campaign-item"><div><strong>${html(c.nome)}</strong>${statusBadge(c.status)}</div><p>${html(c.mensagem||c.titulo||"Campanha sem mensagem.")}</p></article>`).join(""):`<div class="sa-empty"><i class="fa-solid fa-bullhorn"></i><strong>Nenhuma campanha</strong></div>`;
  }

  function renderCategories() {
    $("#categoriesGrid").innerHTML=state.categories.map(c=>`<article class="sa-category-card"><span class="sa-category-icon"><i class="fa-solid ${html(c.icone||'fa-tag')}"></i></span><h3>${html(c.nome)}</h3><p>${html(c.descricao||`Categoria ${c.nome} na Go-burger.`)}</p><div class="sa-category-meta"><span>${c.destaque?'Destaque · ':''}${c.ativo?'Ativa':'Inativa'}</span><button class="sa-action-btn" data-edit-category="${c.id}" type="button"><i class="fa-solid fa-pen"></i></button></div></article>`).join("");
  }

  function renderModeration() {
    $("#reviewsGrid").innerHTML=state.reviews.length?state.reviews.slice(0,100).map(r=>{const p=profileById(r.user_id);return `<article class="sa-review-card"><div class="sa-review-stars">${"★".repeat(Number(r.nota||0))}${"☆".repeat(Math.max(0,5-Number(r.nota||0)))}</div><p>${html(r.comentario||"Sem comentário.")}</p><div class="sa-review-meta"><span>${html(storeName(r.loja_id))}</span><span>${html(p?.nome||"Cliente")}</span></div><div class="sa-review-actions">${lower(r.status)==='oculta'?`<button class="sa-btn tiny" data-review-status="publicada" data-review-id="${r.id}">Publicar</button>`:`<button class="sa-btn tiny" data-review-status="oculta" data-review-id="${r.id}">Ocultar</button>`}<span>${statusBadge(r.status)}</span></div></article>`}).join(""):`<div class="sa-empty"><i class="fa-solid fa-star"></i><strong>Ainda não há avaliações</strong></div>`;
    $("#moderationQueueBody").innerHTML=state.moderation.map(m=>`<tr><td>${badge(m.tipo,"purple")}</td><td><strong>${html(m.motivo)}</strong><small>${html(storeName(m.loja_id))}</small></td><td>${Number(m.risco_score||0).toFixed(0)}%</td><td>${statusBadge(m.status)}</td><td>${dt(m.criado_em)}</td><td><button class="sa-action-btn" data-resolve-moderation="${m.id}"><i class="fa-solid fa-check"></i></button></td></tr>`).join("");
  }

  function renderSupport() {
    const q=lower($("#supportSearch")?.value), status=$("#supportStatusFilter")?.value||"";
    const list=state.support.filter(t=>(!q||`${t.protocolo} ${t.assunto} ${t.mensagem}`.toLowerCase().includes(q))&&(!status||t.status===status));
    $("#supportGrid").innerHTML=list.length?list.map(t=>`<article class="sa-ticket"><div class="sa-ticket-top"><strong>${html(t.protocolo||`#${t.id}`)}</strong>${statusBadge(t.prioridade)}</div><h3>${html(t.assunto)}</h3><p>${html(t.mensagem).slice(0,180)}</p><div class="sa-ticket-foot"><span>${html(t.origem)} · ${dt(t.criado_em)}</span><button class="sa-action-btn" data-open-ticket="${t.id}"><i class="fa-solid fa-arrow-right"></i></button></div></article>`).join(""):`<div class="sa-empty"><i class="fa-solid fa-headset"></i><strong>Nenhum chamado encontrado</strong></div>`;
  }

  function renderNotifications() {
    $("#notificationsTableBody").innerHTML=state.notifications.map(n=>`<tr><td><strong>${html(n.titulo)}</strong><small>${html(n.mensagem).slice(0,80)}</small></td><td>${badge(n.alvo,"blue")}</td><td>${badge(n.tipo,"purple")}</td><td>${statusBadge(n.status)}</td><td>${dt(n.agendada_para)}</td><td>${dt(n.criado_em)}</td></tr>`).join("");
  }

  function alertHtml(a) { return `<article class="sa-alert-item ${html(a.severidade)}"><span><i class="fa-solid ${a.severidade==='critico'?'fa-triangle-exclamation':a.severidade==='aviso'?'fa-circle-exclamation':'fa-circle-info'}"></i></span><div><strong>${html(a.titulo)}</strong><p>${html(a.mensagem)}</p></div><small>${date(a.criado_em)}</small></article>`; }
  function auditTimelineHtml(a) { return `<div class="sa-timeline-item"><span><i class="fa-solid fa-fingerprint"></i></span><div><strong>${html(a.acao.replaceAll('_',' '))}</strong><p>${html(a.entidade)} ${a.entidade_id?`#${html(a.entidade_id)}`:''}</p></div><time>${dt(a.criado_em)}</time></div>`; }

  function renderSystemHealth(results = null) {
    const items=results||[
      {name:"Supabase",ok:true,detail:"Sessão e banco conectados"},{name:"RLS",ok:true,detail:"Super Admin validado por política"},{name:"Storage",ok:null,detail:"Executar diagnóstico para testar"},{name:"PWA",ok:"serviceWorker" in navigator,detail:"Service Worker disponível no navegador"},
      {name:"Multi-lojas",ok:state.stores.length>0,detail:`${state.stores.length} loja(s) carregada(s)`},{name:"Auditoria",ok:true,detail:`${state.audit.length} evento(s) recentes`},{name:"Suporte",ok:true,detail:`${state.support.length} chamado(s)`},{name:"Feature flags",ok:true,detail:`${state.flags.length} flag(s) configurada(s)`}
    ];
    $("#healthGrid").innerHTML=items.map(x=>`<article class="sa-health-card ${x.ok===false?'error':x.ok==null?'warning':''}"><span><i class="fa-solid ${x.ok===false?'fa-xmark':x.ok==null?'fa-clock':'fa-check'}"></i></span><div><strong>${html(x.name)} · ${x.ok===false?'ERRO':x.ok==null?'AGUARDANDO':'OK'}</strong><small>${html(x.detail)}</small></div></article>`).join("");
    $("#systemAlerts").innerHTML=state.alerts.filter(a=>!a.resolvido).map(alertHtml).join("")||`<div class="sa-empty"><i class="fa-solid fa-shield-check"></i><strong>Sem alertas internos</strong></div>`;
    $("#appReadiness").innerHTML=[
      ["Shell unificado",true,"index.html como entrada"],["Sessão única",true,AUTH_KEY],["Multi-lojas",true,"loja_id presente"],["Super Admin",true,"Etapa 9 ativa"],["PWA",true,"manifest + service worker"],["Play/App Store",false,"empacotamento futuro"]
    ].map(([n,ok,d])=>`<div class="sa-readiness-item"><i class="fa-solid ${ok?'fa-check':'fa-clock'}"></i><div><strong>${n}</strong><small>${d}</small></div><b>${ok?'PRONTO':'ROADMAP'}</b></div>`).join("");
  }

  function renderRetentionStatus(){
    const box=$("#retentionStatusGrid"),status=state.retentionStatus||{},policies=Array.isArray(status.politicas)?status.politicas:[];
    if(box)box.innerHTML=policies.length?policies.map(p=>`<article class="sa-retention-item"><strong>${html(String(p.chave||"").replaceAll("_"," "))}</strong><small>${html(p.descricao||"")}</small><small><b>${number(p.dias_retencao)}</b> dias · ${p.ativo?"ativa":"pausada"}</small></article>`).join(""):`<div class="sa-empty"><i class="fa-solid fa-clock-rotate-left"></i><strong>Políticas não carregadas</strong></div>`;
    const last=status.ultima_execucao||null,lastEl=$("#retentionLastRun");
    if(lastEl)lastEl.textContent=last?`Última execução: ${dt(last.executado_em)} · analytics ${number(last.analytics_removidos)} · carrinhos expirados ${number(last.carrinhos_expirados)} · removidos ${number(last.carrinhos_removidos)} · sessões ${number(last.sessoes_removidas)}.`:"A rotina automática executa diariamente às 03:37 (UTC do banco).";
  }

  async function refreshRetentionStatus(){
    const button=$("#refreshRetentionStatus");button?.classList.add("spinning");
    try{const {data,error}=await db.rpc("go_burger_retencao_status_v1");if(error)throw error;state.retentionStatus=data||{};renderRetentionStatus();toast("Status de retenção atualizado.");}catch(error){toast(error.message||"Falha ao carregar retenção.","error");}finally{button?.classList.remove("spinning");}
  }

  function exportPlatformMetrics(){
    const m=state.metrics||{},a=state.metricsAdvanced||{};
    const rows=[
      ["Período avançado (dias)",state.metricDays],["Hamburguerias",m.lojas_total],["Lojas ativas",m.lojas_ativas],["Pedidos no mês",m.pedidos_mes],["Pedidos hoje",m.pedidos_hoje],["GMV do mês",m.gmv_mes],["GMV período",a.gmv],["Clientes recorrentes",a.clientes_recorrentes],["Taxa de recorrência (%)",a.taxa_recorrencia],["Conversão marketplace→pedido (%)",a.funil?.conversao_marketplace_pedido],["Conversão loja→checkout (%)",a.funil?.conversao_loja_checkout],["Conversão checkout→pedido (%)",a.funil?.conversao_checkout_pedido],["Carrinhos ativos",a.carrinhos_ativos],["Valor carrinhos ativos",a.valor_carrinhos_ativos],["MRR",a.mrr],["Assinaturas ativas",a.assinaturas_ativas],["Assinaturas atrasadas",a.assinaturas_atrasadas],["Assinaturas canceladas no período",a.assinaturas_canceladas_periodo],["Receita comissões",a.receita_comissoes],["Pagamentos online aprovados",a.pagamentos_online_aprovados],["Reembolsos concluídos",a.reembolsos_concluidos],["Taxa cancelamento pedidos (%)",a.taxa_cancelamento],["Ticket médio",m.ticket_medio],["Usuários",m.usuarios_total],["Avaliações",m.avaliacoes_total]
    ];
    const csv="indicador;valor\n"+rows.map(([k,v])=>`"${String(k).replaceAll('"','""')}";"${String(v??'').replaceAll('"','""')}"`).join("\n");
    const blob=new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),aEl=document.createElement("a");aEl.href=url;aEl.download=`go-burger-metricas-${new Date().toISOString().slice(0,10)}.csv`;aEl.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }

  async function changeMetricPeriod(){
    state.metricDays=Number($("#dashboardChartPeriod")?.value||30);
    renderCharts();
    try{const {data,error}=await db.rpc("go_burger_super_metricas_v2",{p_dias:state.metricDays});if(error)throw error;state.metricsAdvanced=data||{};renderDashboard();}catch(error){toast(error.message||"Falha ao atualizar período.","error");}
  }

  function renderFlags() { $("#flagsGrid").innerHTML=state.flags.map(f=>`<article class="sa-flag-card"><div class="sa-flag-top"><div><small>${html(f.chave)}</small><strong>${html(f.nome)}</strong></div><label class="sa-toggle"><input type="checkbox" data-flag-toggle="${html(f.chave)}" ${f.ativo?'checked':''}><i></i></label></div><p>${html(f.descricao||"")}</p><div class="sa-flag-meta"><span>${html(f.publico)}</span><span>Rollout ${f.rollout_percent}%</span></div></article>`).join(""); }
  function renderAudit() { $("#auditTableBody").innerHTML=state.audit.map(a=>`<tr><td><strong>${html(a.acao.replaceAll('_',' '))}</strong></td><td>${html(a.entidade)} ${a.entidade_id?`#${html(a.entidade_id)}`:''}</td><td><small>${html(JSON.stringify(a.detalhes||{})).slice(0,150)}</small></td><td>${html(profileById(a.super_admin_id)?.nome||"Go-burger")}</td><td>${dt(a.criado_em)}</td></tr>`).join(""); }

  function renderTeam() {
    $("#teamGrid").innerHTML=state.team.map(t=>{const p=profileById(t.user_id);return `<article class="sa-team-card"><span class="sa-team-avatar">${html(initials(t.nome_exibicao||p?.nome||p?.email))}</span><h3>${html(t.nome_exibicao||p?.nome||"Equipe Go-burger")}</h3><p>${html(p?.email||"")}</p>${badge(t.nivel.replaceAll('_',' '),t.nivel==='owner'?'orange':'purple')}<div class="sa-team-actions">${state.me?.nivel==='owner'&&t.user_id!==state.user.id?`<button class="sa-btn tiny" data-team-toggle="${t.user_id}" data-team-active="${t.ativo?'1':'0'}">${t.ativo?'Desativar':'Ativar'}</button>`:''}</div></article>`}).join("");
    const currentIds=new Set(state.team.map(x=>x.user_id)); $("#teamUserSelect").innerHTML=`<option value="">Selecione um usuário</option>`+state.profiles.filter(p=>!currentIds.has(p.id)).slice(0,500).map(p=>`<option value="${p.id}">${html(p.nome||p.email||p.id)} — ${html(p.email||"")}</option>`).join("");
    $("#addTeamButton")?.classList.toggle("hidden",state.me?.nivel!=="owner");
  }

  function renderSettings() {
    const f=$("#platformSettingsForm"); if(!f)return; const c=state.config||{}, flags=c.config||{};
    ["nome","slogan","suporte_email","suporte_whatsapp","site_url","instagram","comissao_padrao","avaliacao_min_destaque","pedidos_min_ranking","raio_busca_padrao_km","manutencao_mensagem"].forEach(k=>{if(f.elements[k])f.elements[k].value=c[k]??""});
    ["aprovacao_manual","novos_cadastros_ativos","manutencao"].forEach(k=>{if(f.elements[k])f.elements[k].checked=!!c[k]});
    if(f.elements.user_signups_enabled)f.elements.user_signups_enabled.checked=flags.user_signups_enabled!==false;
    if(f.elements.driver_applications_enabled)f.elements.driver_applications_enabled.checked=flags.driver_applications_enabled!==false;
  }

  function navigate(page) {
    if (!pageMeta[page]) page="dashboard"; state.currentPage=page;
    $$(".sa-page").forEach(x=>{
      const active=x.dataset.section===page;
      x.classList.toggle("active",active);
      x.hidden=!active;
      x.setAttribute("aria-hidden",active?"false":"true");
    });
    $$(".sa-nav button[data-page]").forEach(x=>{
      const active=x.dataset.page===page;
      x.classList.toggle("active",active);
      x.setAttribute("aria-current",active?"page":"false");
    });
    $("#saPageEyebrow").textContent=pageMeta[page][0]; $("#saPageTitle").textContent=pageMeta[page][1];
    $("#saSidebar")?.classList.remove("open"); $("#saOverlay")?.classList.remove("menu-active");
    history.replaceState(null,"",`#${page}`); scrollTo({top:0,behavior:"smooth"});
    if(page==="sistema")renderSystemHealth();
    if(page==="financeiro"){renderCharts();loadFinancePreparation();}
    if(page==="planos"){renderPlans();renderPlanCommercialP660();renderPlanOpsP680();renderPlanFinalP700();}
  }

  function openStoreDetail(id) {
    const s=storeById(id); if(!s)return; const c=controlByStore(id), sub=subscriptionByStore(id), plan=planById(sub.plano_id||c.plano_id), owners=state.storeUsers.filter(x=>Number(x.loja_id)===Number(id)&&x.ativo).map(x=>profileById(x.user_id)?.nome||x.papel).join(", ");
    const archived=String(s.status||"").toLowerCase()==="arquivada";
    const lifecycle=c.encerrada_em?`<div class="sa-lifecycle-box"><strong><i class="fa-solid fa-box-archive"></i> Loja arquivada</strong><span>Origem: ${c.encerrada_origem==="super_admin"?"Super Admin":"Dono da hamburgueria"}</span><span>Desde: ${dt(c.encerrada_em)}</span>${c.motivo_encerramento?`<span>Motivo: ${html(c.motivo_encerramento)}</span>`:""}</div>`:"";
    $("#entityModalContent").innerHTML=`<div class="sa-detail-hero"><span class="sa-store-logo">${storeLogo(s)}</span><div><h2>${html(s.nome)}</h2><p>go-burger.app/${html(s.slug)} · ${html([s.cidade,s.estado].filter(Boolean).join(" - ")||"Localização não informada")}</p></div>${statusBadge(s.status)}</div>${lifecycle}<div class="sa-detail-grid"><div class="sa-detail-item"><small>Aprovação</small><strong>${html(c.aprovacao_status||"rascunho")}</strong></div><div class="sa-detail-item"><small>Verificação</small><strong>${c.verificada?'Verificada':'Não verificada'}</strong></div><div class="sa-detail-item"><small>Plano</small><strong>${html(plan?.nome||"Sem plano")}</strong></div><div class="sa-detail-item"><small>Responsáveis</small><strong>${html(owners||"—")}</strong></div><div class="sa-detail-item"><small>Contato</small><strong>${html(s.whatsapp||s.telefone||s.email_contato||"—")}</strong></div><div class="sa-detail-item"><small>Pedidos carregados</small><strong>${orderCountStore(id)}</strong></div><div class="sa-detail-item"><small>Nota média</small><strong>${reviewAvgStore(id).toFixed(1)}</strong></div><div class="sa-detail-item"><small>Risco</small><strong>${Number(c.risco_score||0).toFixed(0)}%</strong></div><div class="sa-detail-item"><small>Onboarding</small><strong>${Number(c.onboarding_percent||0)}%</strong></div></div><div class="sa-modal-actions">${!archived?`<button class="sa-btn secondary" data-open-public-store="${id}" type="button"><i class="fa-solid fa-arrow-up-right-from-square"></i>Abrir loja</button>`:""}${c.aprovacao_status!=="aprovada"&&!archived?`<button class="sa-btn success" data-store-action="aprovar" data-store-id="${id}" type="button">Autorizar publicação</button>`:''}${c.aprovacao_status!=="rejeitada"&&!archived?`<button class="sa-btn secondary" data-store-action="rejeitar" data-store-id="${id}" type="button">Recusar publicação</button>`:''}${c.verificada?`<button class="sa-btn secondary" data-store-action="desverificar" data-store-id="${id}">Remover selo</button>`:`<button class="sa-btn secondary" data-store-action="verificar" data-store-id="${id}">Verificar</button>`}${s.destaque?`<button class="sa-btn secondary" data-store-action="remover_destaque" data-store-id="${id}">Remover destaque</button>`:(!archived&&s.status!=="bloqueada"?`<button class="sa-btn secondary" data-store-action="destacar" data-store-id="${id}">Destacar</button>`:"")}${s.status==='bloqueada'?`<button class="sa-btn success" data-store-action="desbloquear" data-store-id="${id}">Desbloquear</button>`:(!archived?`<button class="sa-btn danger" data-store-action="bloquear" data-store-id="${id}">Bloquear</button>`:"")}${archived?`<button class="sa-btn success" data-store-action="restaurar" data-store-id="${id}"><i class="fa-solid fa-rotate-left"></i> Restaurar</button><button class="sa-btn danger full" data-delete-store="${id}" type="button"><i class="fa-solid fa-trash-can"></i> Excluir definitivamente</button>`:`<button class="sa-btn danger full" data-store-action="arquivar" data-store-id="${id}"><i class="fa-solid fa-box-archive"></i> Arquivar hamburgueria</button>`}</div>`;
    openModal("entityModal");
  }

  function openUserDetail(id) {
    const p=profileById(id); if(!p)return; const c=userControl(id); $("#entityModalContent").innerHTML=`<div class="sa-detail-hero"><span class="sa-store-logo">${html(initials(p.nome||p.email))}</span><div><h2>${html(p.nome||"Usuário Go-burger")}</h2><p>${html(p.email||"—")} · ${html(p.telefone||"—")}</p></div>${statusBadge(c.status)}</div><div class="sa-detail-grid"><div class="sa-detail-item"><small>Pedidos</small><strong>${userOrderCount(id)}</strong></div><div class="sa-detail-item"><small>Lojas vinculadas</small><strong>${userStoreCount(id)}</strong></div><div class="sa-detail-item"><small>Risco</small><strong>${Number(c.risco_score||0)}%</strong></div><div class="sa-detail-item"><small>Cadastro</small><strong>${date(p.criado_em)}</strong></div><div class="sa-detail-item"><small>Último acesso</small><strong>${dt(p.ultimo_acesso_em||p.ultimo_acesso)}</strong></div><div class="sa-detail-item"><small>Tipo</small><strong>${html(p.tipo||"cliente")}</strong></div></div><div class="sa-modal-actions">${c.status!=='bloqueado'?`<button class="sa-btn danger" data-user-action="bloquear" data-user-id="${id}">Bloquear conta</button>`:`<button class="sa-btn success" data-user-action="liberar" data-user-id="${id}">Liberar conta</button>`}${c.status==='ativo'?`<button class="sa-btn secondary" data-user-action="suspender" data-user-id="${id}">Suspender</button>`:''}</div>`; openModal("entityModal");
  }

  function openPartnerRequestDetail(id){
    const r=partnerRequestById(id);if(!r)return;
    const service=[r.entrega_propria?"Entrega":null,r.retirada_local?"Retirada":null,r.consumo_local?"Consumo no local":null].filter(Boolean).join(", ")||"—";
    const doc=String(r.documento||"");
    $("#entityModalContent").innerHTML=`<div class="sa-detail-hero"><span class="sa-store-logo"><i class="fa-solid fa-handshake"></i></span><div><h2>${html(r.nome)}</h2><p>Solicitação #${r.id} · go-burger.app/${html(r.slug)}</p></div>${statusBadge(r.status)}</div><div class="sa-detail-grid"><div class="sa-detail-item"><small>Responsável</small><strong>${html(r.nome_responsavel||"—")}</strong></div><div class="sa-detail-item"><small>${r.tipo_pessoa==="pf"?"CPF":"CNPJ"}</small><strong>${html(doc||"—")}</strong></div><div class="sa-detail-item"><small>Razão social</small><strong>${html(r.razao_social||"—")}</strong></div><div class="sa-detail-item"><small>Contato</small><strong>${html(r.whatsapp||r.telefone||r.email_contato||"—")}</strong></div><div class="sa-detail-item"><small>Localização</small><strong>${html([r.endereco,r.cidade,r.estado,r.cep].filter(Boolean).join(" · ")||"—")}</strong></div><div class="sa-detail-item"><small>Atendimento</small><strong>${html(service)}</strong></div><div class="sa-detail-item"><small>Instagram</small><strong>${html(r.instagram||"—")}</strong></div><div class="sa-detail-item"><small>Cardápio digital</small><strong>${r.cardapio_digital===true?"Sim":r.cardapio_digital===false?"Não":"Não informado"}</strong></div><div class="sa-detail-item"><small>Produtos estimados</small><strong>${r.quantidade_produtos??"—"}</strong></div></div><div class="sa-request-detail-section"><strong>Descrição</strong><div class="sa-detail-item sa-request-long">${html(r.descricao||"—")}</div></div><div class="sa-request-detail-section"><strong>Horário / região de entrega</strong><div class="sa-detail-item sa-request-long">${html([r.horario_funcionamento,r.regiao_entrega].filter(Boolean).join("\n")||"—")}</div></div><div class="sa-request-detail-section"><strong>Site ou cardápio atual</strong><div class="sa-detail-item sa-request-long">${html(r.link_atual||"—")}</div></div><div class="sa-request-detail-section"><strong>Observações do parceiro</strong><div class="sa-detail-item sa-request-long">${html(r.observacoes||"—")}</div></div>${r.observacao_super_admin?`<div class="sa-request-detail-section"><strong>Observação do Super Admin</strong><div class="sa-detail-item sa-request-long">${html(r.observacao_super_admin)}</div></div>`:""}<div class="sa-modal-actions"><button class="sa-btn secondary" data-close-modal="entityModal" type="button">Fechar</button>${r.status==="pendente"?`<button class="sa-btn secondary" data-partner-request-action="em_analise" data-request-id="${r.id}" type="button">Iniciar análise</button>`:""}${["pendente","em_analise"].includes(r.status)?`<button class="sa-btn success" data-partner-request-action="aprovar" data-request-id="${r.id}" type="button">Aprovar e criar loja</button><button class="sa-btn warn" data-partner-request-action="pedir_correcao" data-request-id="${r.id}" type="button">Pedir correção</button><button class="sa-btn danger" data-partner-request-action="recusar" data-request-id="${r.id}" type="button">Recusar entrada</button>`:""}</div>`;
    openModal("entityModal");
  }

  async function partnerRequestAction(id,action){
    const r=partnerRequestById(id);if(!r)return;
    let observacao=null;
    if(action==="pedir_correcao"){
      observacao=prompt("O que o parceiro precisa corrigir?")||null;
      if(!observacao)return;
    }
    if(action==="recusar"){
      observacao=prompt("Informe o motivo da recusa da parceria:")||null;
      if(!observacao)return;
    }
    if(action==="aprovar"&&!confirm(`Aprovar a entrada de ${r.nome}?\n\nA hamburgueria será criada SOMENTE como rascunho e ainda dependerá de outra autorização antes de ser publicada.`))return;
    try{
      const {data,error}=await db.rpc("go_burger_super_admin_acao_solicitacao_parceiro_v1",{p_solicitacao_id:Number(id),p_acao:action,p_observacao:observacao});
      if(error)throw error;
      closeAllModals();
      if(action==="aprovar")toast(`Entrada aprovada. A hamburgueria foi criada em rascunho${data?.loja_id?` (#${data.loja_id})`:""} e ainda não está pública.`);
      else if(action==="pedir_correcao")toast("Correção solicitada ao parceiro.","info");
      else if(action==="recusar")toast("Solicitação de parceria recusada.","info");
      else toast("Solicitação marcada como em análise.","info");
      await loadAll({silent:true});
    }catch(error){toast(error.message||"Não foi possível atualizar a solicitação.","error");}
  }

  async function storeAction(id, action) {
    let motivo=null;
    if(["rejeitar","bloquear","arquivar"].includes(action)){
      motivo=prompt(action==="rejeitar"?"Motivo da recusa de publicação:":action==="arquivar"?"Motivo do arquivamento da hamburgueria:":"Motivo do bloqueio:")||null;
      if(!motivo)return;
    }
    if(action==="restaurar"&&!confirm("Restaurar esta hamburgueria? Ela voltará em modo pausado/fechado para revisão antes de receber novos pedidos."))return;
    const {error}=await db.rpc("go_burger_super_admin_acao_loja_v1",{p_loja_id:Number(id),p_acao:action,p_motivo:motivo}); if(error){toast(error.message,"error");return;}
    const msg=action==="aprovar"?"Publicação autorizada pelo Super Admin.":action==="rejeitar"?"Publicação recusada. O parceiro poderá ajustar o cadastro.":action==="arquivar"?"Hamburgueria arquivada e retirada do marketplace.":action==="restaurar"?"Hamburgueria restaurada em modo seguro.":`Ação “${action.replaceAll('_',' ')}” aplicada na hamburgueria.`;
    toast(msg); closeAllModals(); await loadAll({silent:true});
  }

  async function listStoreAssetPaths(prefix){
    const bucket=db.storage.from("burger-assets"), files=[];
    async function walk(path,depth=0){
      if(depth>8)throw new Error("Estrutura de arquivos da loja excedeu a profundidade esperada.");
      const limit=100;let offset=0;
      while(true){
        const {data,error}=await bucket.list(path,{limit,offset,sortBy:{column:"name",order:"asc"}});if(error)throw error;
        const rows=Array.isArray(data)?data:[];
        for(const item of rows){
          const child=path?`${path}/${item.name}`:item.name;
          if(item.id||item.metadata)files.push(child);else await walk(child,depth+1);
        }
        if(rows.length<limit)break;
        offset+=rows.length;
      }
    }
    await walk(prefix);return files;
  }

  async function purgeStoreAssets(id){
    const paths=await listStoreAssetPaths(`lojas/${Number(id)}`);if(!paths.length)return 0;
    const bucket=db.storage.from("burger-assets");
    for(let i=0;i<paths.length;i+=100){const {error}=await bucket.remove(paths.slice(i,i+100));if(error)throw error;}
    return paths.length;
  }

  function formatDeletionBlockers(diag){
    const blockers=diag?.bloqueios||{};const entries=Object.entries(blockers);
    if(!entries.length)return "Existem dependências de banco que impedem a exclusão física.";
    return entries.map(([table,count])=>`• ${table}: ${count}`).join("\n");
  }

  async function deleteStorePermanently(id){
    const store=storeById(id);if(!store)return;
    try{
      const {data:diag,error:diagError}=await db.rpc("go_burger_super_admin_diagnostico_exclusao_loja_v42",{p_loja_id:Number(id)});if(diagError)throw diagError;
      if(!diag?.pode_excluir){alert(`A exclusão física de ${store.nome} foi bloqueada para proteger o histórico.

${formatDeletionBlockers(diag)}

Mantenha a hamburgueria arquivada.`);return;}
      if(!confirm(`EXCLUSÃO DEFINITIVA

${store.nome} não possui histórico bloqueador detectado. Esta ação apagará a estrutura da loja do banco e os arquivos da pasta de Storage.

Essa operação não poderá ser desfeita.`))return;
      const typed=prompt(`Digite exatamente o slug para confirmar:
${store.slug}`);if(typed===null)return;
      if(String(typed).trim().toLowerCase()!==String(store.slug).toLowerCase())return toast("Confirmação incorreta. Exclusão cancelada.","error");
      toast("Executando a exclusão protegida no banco...","info");
      const {data,error}=await db.rpc("go_burger_super_admin_excluir_loja_v42",{p_loja_id:Number(id),p_confirmacao:String(typed).trim()});if(error)throw error;
      if(!data?.ok){alert(`${data?.mensagem||"A exclusão foi bloqueada."}

${formatDeletionBlockers(data?.diagnostico)}`);await loadAll({silent:true});return;}
      let removedAssets=0, storageWarning="";
      try{removedAssets=await purgeStoreAssets(id);}catch(storageError){console.warn("Go-burger: limpeza pós-exclusão do Storage",storageError);storageWarning=" A loja foi excluída do banco, mas alguns arquivos do Storage podem exigir limpeza administrativa.";}
      closeAllModals();toast(`Hamburgueria excluída definitivamente. ${removedAssets} arquivo(s) de Storage removido(s).${storageWarning}`,storageWarning?"info":undefined);await loadAll({silent:true});
    }catch(e){toast(e.message||"Não foi possível excluir a hamburgueria.","error");}
  }

  async function userAction(id, action) { let motivo=null;if(["bloquear","suspender"].includes(action)){motivo=prompt(`Motivo para ${action} o usuário:`)||null;if(!motivo)return;} const {error}=await db.rpc("go_burger_super_admin_acao_usuario_v1",{p_user_id:id,p_acao:action,p_motivo:motivo});if(error)return toast(error.message,"error");toast("Controle de usuário atualizado.");closeAllModals();await loadAll({silent:true}); }

  function renderPlanResourceEditor(plan=null){
    const host=$("#planResourcesGrid");if(!host)return;
    host.innerHTML=state.planResources.map(r=>{const checked=r.core===true||(plan?.recursos||{})[r.chave]===true;return `<label class="sa-plan-resource-item ${r.core?'core':''}"><input type="checkbox" name="recurso_${html(r.chave)}" data-plan-resource="${html(r.chave)}" ${checked?'checked':''} ${r.core?'disabled':''}><span><strong>${html(r.nome)}</strong><small>${html(r.descricao||'')}</small></span></label>`}).join("");
  }

  function openPlan(plan=null) {
    const f=$("#planForm"); f.reset(); f.elements.ativo.checked=true; $("#planModalTitle").textContent=plan?"Editar plano":"Novo plano";
    if(plan){Object.keys(plan).forEach(k=>{if(f.elements[k]&&!["recursos"].includes(k)){if(f.elements[k].type==="checkbox")f.elements[k].checked=!!plan[k];else f.elements[k].value=plan[k]??""}})}
    renderPlanResourceEditor(plan); openModal("planModal");
  }

  async function savePlan(e){
    e.preventDefault();const f=e.currentTarget,submit=f.querySelector('button[type="submit"]'),oldHtml=submit?.innerHTML;
    if(submit){submit.disabled=true;submit.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Salvando...';}
    try{
      const resources={};$$('[data-plan-resource]',f).forEach(input=>{resources[input.dataset.planResource]=input.checked||input.disabled;});
      const n=v=>String(v??"").trim()===""?null:Number(v),id=f.elements.id.value?Number(f.elements.id.value):null,oldPlan=state.plans.find(p=>Number(p.id)===Number(id));
      const current={preco_mensal:Number(f.elements.preco_mensal.value||0),preco_anual:n(f.elements.preco_anual.value),comissao_percentual:Number(f.elements.comissao_percentual.value||0),limite_produtos:n(f.elements.limite_produtos.value),limite_usuarios:n(f.elements.limite_usuarios.value),limite_banners:n(f.elements.limite_banners.value),ativo:f.elements.ativo.checked};
      const critical=id&&oldPlan&&["preco_mensal","preco_anual","comissao_percentual","limite_produtos","limite_usuarios","limite_banners","ativo"].some(k=>String(oldPlan[k]??"")!==String(current[k]??""));
      let confirmation=null;if(critical){if(!confirm("Esta alteração muda preço, comissão, limite ou status do plano. O backend fará análise de impacto. Continuar?"))return;confirmation=prompt('Digite exatamente: CONFIRMAR ALTERACAO CRITICA');if(confirmation!=="CONFIRMAR ALTERACAO CRITICA")throw new Error("Confirmação crítica incorreta. Nenhuma alteração foi salva.");}
      const args={p_id:id,p_slug:slugify(f.elements.slug.value),p_nome:f.elements.nome.value.trim(),p_descricao:f.elements.descricao.value.trim()||null,p_preco_mensal:current.preco_mensal,p_preco_anual:current.preco_anual,p_comissao_percentual:current.comissao_percentual,p_limite_produtos:current.limite_produtos,p_limite_usuarios:current.limite_usuarios,p_limite_banners:current.limite_banners,p_trial_dias:Number(f.elements.trial_dias.value||0),p_ordem:Number(f.elements.ordem.value||0),p_ativo:current.ativo,p_destaque:f.elements.destaque.checked,p_recursos:resources,p_badge_texto:f.elements.badge_texto.value.trim()||null,p_badge_tipo:f.elements.badge_tipo.value||null,p_recomendado_manual:f.elements.recomendado_manual.checked,p_confirmacao:confirmation};
      const {error}=await db.rpc("go_burger_plano_admin_salvar_v670",args);if(error)throw error;
      toast("Catálogo salvo com proteção P669/P670. Financeiro real continua bloqueado.");closeModal("planModal");await loadAll({silent:true});
    }catch(error){toast(error.message||"Não foi possível salvar o plano.","error");}
    finally{if(submit){submit.disabled=false;submit.innerHTML=oldHtml||'Salvar plano';}}
  }

  function openCategory(c=null){const f=$("#categoryForm");f.reset();f.elements.ativo.checked=true;$("#categoryModalTitle").textContent=c?"Editar categoria":"Nova categoria";if(c)Object.keys(c).forEach(k=>{if(f.elements[k]){if(f.elements[k].type==="checkbox")f.elements[k].checked=!!c[k];else f.elements[k].value=c[k]??""}});openModal("categoryModal");}
  async function saveCategory(e){e.preventDefault();const f=e.currentTarget,id=f.elements.id.value,p={nome:f.elements.nome.value.trim(),slug:slugify(f.elements.slug.value),icone:f.elements.icone.value.trim()||null,descricao:f.elements.descricao.value.trim()||null,ordem:Number(f.elements.ordem.value||0),ativo:f.elements.ativo.checked,destaque:f.elements.destaque.checked};const q=id?db.from("plataforma_categorias").update(p).eq("id",id):db.from("plataforma_categorias").insert(p);const{error}=await q;if(error)return toast(error.message,"error");toast("Categoria salva.");closeModal("categoryModal");await loadAll({silent:true});}

  function renderGlobalBannerPreview(url="") {
    const box=$("#globalBannerPreview"); if(!box)return;
    box.innerHTML=url?`<img src="${html(url)}" alt="Prévia do banner Go-burger"><button type="button" id="clearGlobalBannerImage" title="Remover imagem"><i class="fa-solid fa-xmark"></i></button>`:`<i class="fa-regular fa-image"></i><span>Prévia do banner</span>`;
  }
  function openBanner(b=null){const f=$("#bannerForm");f.reset();f.elements.ativo.checked=true;$("#bannerModalTitle").textContent=b?"Editar banner":"Novo banner";if(b)Object.keys(b).forEach(k=>{if(f.elements[k]){if(f.elements[k].type==="checkbox")f.elements[k].checked=!!b[k];else f.elements[k].value=b[k]??""}});renderGlobalBannerPreview(b?.imagem_url||"");openModal("bannerModal");}
  async function uploadGlobalBanner(file){
    if(!file)return null;
    const allowed=["image/png","image/jpeg","image/webp"];
    if(!allowed.includes(file.type))throw new Error("Use uma imagem PNG, JPG ou WEBP.");
    if(file.size>5*1024*1024)throw new Error("A imagem deve ter no máximo 5 MB.");
    const ext=(file.name.split(".").pop()||"webp").toLowerCase().replace(/[^a-z0-9]/g,"")||"webp";
    const path=`plataforma/banners/${Date.now()}-${crypto.randomUUID?.()||Math.random().toString(36).slice(2)}.${ext}`;
    const {error}=await db.storage.from("burger-assets").upload(path,file,{cacheControl:"3600",upsert:false,contentType:file.type});
    if(error)throw error;
    return db.storage.from("burger-assets").getPublicUrl(path).data.publicUrl;
  }
  async function saveBanner(e){
    e.preventDefault(); const f=e.currentTarget,id=f.elements.id.value,submit=f.querySelector('button[type="submit"]');
    const old=submit?.innerHTML; if(submit){submit.disabled=true;submit.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Salvando...';}
    try{
      let imageUrl=f.elements.imagem_url.value.trim()||null;
      const file=$("#globalBannerFile")?.files?.[0];
      if(file){imageUrl=await uploadGlobalBanner(file);f.elements.imagem_url.value=imageUrl;renderGlobalBannerPreview(imageUrl);}
      const p={titulo:f.elements.titulo.value.trim(),subtitulo:f.elements.subtitulo.value.trim()||null,imagem_url:imageUrl,link_tipo:f.elements.link_tipo.value,link_valor:f.elements.link_valor.value.trim()||null,publico:f.elements.publico.value,ordem:Number(f.elements.ordem.value||0),ativo:f.elements.ativo.checked,criado_por:state.user.id};
      const q=id?db.from("plataforma_banners").update(p).eq("id",id):db.from("plataforma_banners").insert(p);const{error}=await q;if(error)throw error;
      toast("Banner global salvo na Go-burger.");closeModal("bannerModal");await loadAll({silent:true});
    }catch(err){toast(err?.message||"Não foi possível salvar o banner.","error");}
    finally{if(submit){submit.disabled=false;submit.innerHTML=old;}}
  }
  async function deleteBanner(id){if(!confirm("Excluir este banner global?"))return;const{error}=await db.from("plataforma_banners").delete().eq("id",id);if(error)return toast(error.message,"error");toast("Banner excluído.");await loadAll({silent:true});}

  async function saveCampaign(e){e.preventDefault();const f=e.currentTarget,p={nome:f.elements.nome.value.trim(),tipo:f.elements.tipo.value,publico:f.elements.publico.value,status:f.elements.inicia_em.value?"agendada":"rascunho",titulo:f.elements.titulo.value.trim()||null,mensagem:f.elements.mensagem.value.trim()||null,inicia_em:f.elements.inicia_em.value?new Date(f.elements.inicia_em.value).toISOString():null,termina_em:f.elements.termina_em.value?new Date(f.elements.termina_em.value).toISOString():null,criado_por:state.user.id};const{error}=await db.from("plataforma_campanhas").insert(p);if(error)return toast(error.message,"error");toast("Campanha criada.");f.reset();closeModal("campaignModal");await loadAll({silent:true});}
  async function saveNotification(e){e.preventDefault();const f=e.currentTarget,when=f.elements.agendada_para.value,p={alvo:f.elements.alvo.value,loja_id:f.elements.loja_id.value?Number(f.elements.loja_id.value):null,titulo:f.elements.titulo.value.trim(),mensagem:f.elements.mensagem.value.trim(),tipo:f.elements.tipo.value,status:when?"agendada":"rascunho",agendada_para:when?new Date(when).toISOString():null,criado_por:state.user.id};const{error}=await db.from("plataforma_notificacoes").insert(p);if(error)return toast(error.message,"error");toast("Mensagem salva na central da Go-burger.");f.reset();closeModal("notificationModal");await loadAll({silent:true});}

  async function saveSettings(e){e.preventDefault();const f=e.currentTarget,existingFlags=state.config?.config||{},p={nome:f.elements.nome.value.trim()||"Go-burger",slogan:f.elements.slogan.value.trim(),suporte_email:f.elements.suporte_email.value.trim()||null,suporte_whatsapp:f.elements.suporte_whatsapp.value.trim()||null,site_url:f.elements.site_url.value.trim()||null,instagram:f.elements.instagram.value.trim()||null,comissao_padrao:0,avaliacao_min_destaque:Number(f.elements.avaliacao_min_destaque.value||0),pedidos_min_ranking:Number(f.elements.pedidos_min_ranking.value||0),raio_busca_padrao_km:Number(f.elements.raio_busca_padrao_km.value||20),aprovacao_manual:f.elements.aprovacao_manual.checked,novos_cadastros_ativos:f.elements.novos_cadastros_ativos.checked,manutencao:f.elements.manutencao.checked,manutencao_mensagem:f.elements.manutencao_mensagem.value.trim(),config:{...existingFlags,user_signups_enabled:f.elements.user_signups_enabled?.checked!==false,partner_applications_enabled:!!f.elements.novos_cadastros_ativos.checked,driver_applications_enabled:f.elements.driver_applications_enabled?.checked!==false},atualizado_por:state.user.id};const{error}=await db.from("plataforma_config").update(p).eq("id",1);if(error)return toast(error.message,"error");$("#settingsSaveStatus").textContent="Salvo agora na Go-burger.";toast("Configurações globais atualizadas.");await loadAll({silent:true});}

  async function toggleFlag(key,active){const{error}=await db.from("plataforma_feature_flags").update({ativo:active,atualizado_por:state.user.id}).eq("chave",key);if(error){toast(error.message,"error");await loadAll({silent:true});return;}toast(`${active?'Ativado':'Desativado'}: ${key}`,"info");await loadAll({silent:true});}
  async function reviewStatus(id,status){const{error}=await db.from("avaliacoes").update({status}).eq("id",id);if(error)return toast(error.message,"error");toast(status==="oculta"?"Avaliação ocultada.":"Avaliação publicada.");await loadAll({silent:true});}
  async function resolveModeration(id){const{error}=await db.from("moderacao_fila").update({status:"resolvido",atribuido_a:state.user.id}).eq("id",id);if(error)return toast(error.message,"error");toast("Item de moderação resolvido.");await loadAll({silent:true});}

  function openTicket(id){const t=state.support.find(x=>Number(x.id)===Number(id));if(!t)return;const p=profileById(t.user_id);$("#entityModalContent").innerHTML=`<div class="sa-modal-head"><span>SUPORTE · ${html(t.protocolo||`#${t.id}`)}</span><h2>${html(t.assunto)}</h2></div><div class="sa-detail-grid"><div class="sa-detail-item"><small>Usuário</small><strong>${html(p?.nome||p?.email||"—")}</strong></div><div class="sa-detail-item"><small>Origem</small><strong>${html(t.origem)}</strong></div><div class="sa-detail-item"><small>Prioridade</small><strong>${html(t.prioridade)}</strong></div></div><article class="sa-panel" style="margin-top:12px"><p style="font-size:9px;line-height:1.7;margin:0">${html(t.mensagem)}</p></article><div class="sa-modal-actions">${["aberto","em_atendimento","aguardando_usuario","resolvido","fechado"].map(s=>`<button class="sa-btn ${t.status===s?'primary':'secondary'}" data-ticket-status="${s}" data-ticket-id="${t.id}">${s.replaceAll('_',' ')}</button>`).join("")}</div>`;openModal("entityModal");}
  async function ticketStatus(id,status){const p={status,atribuido_a:state.user.id,resolvido_em:status==="resolvido"?new Date().toISOString():null};const{error}=await db.from("suporte_chamados").update(p).eq("id",id);if(error)return toast(error.message,"error");toast("Chamado atualizado.");closeAllModals();await loadAll({silent:true});}

  async function openSubscriptionEdit(id){const s=state.subscriptions.find(x=>Number(x.id)===Number(id));if(!s)return;$("#entityModalContent").innerHTML=`<div class="sa-modal-head"><span>ASSINATURA</span><h2>${html(storeName(s.loja_id))}</h2></div><form id="quickSubscriptionForm" class="sa-form-grid modal-grid"><input type="hidden" name="id" value="${s.id}"><label class="span-2"><span>Plano</span><select name="plano_id">${state.plans.map(p=>`<option value="${p.id}" ${Number(p.id)===Number(s.plano_id)?'selected':''}>${html(p.nome)}</option>`).join("")}</select></label><label><span>Status</span><select name="status">${["trial","ativa","atrasada","suspensa","cancelada","isenta"].map(x=>`<option ${x===s.status?'selected':''}>${x}</option>`).join("")}</select></label><label><span>Mensalidade</span><input name="valor_mensal" type="number" step="0.01" value="${Number(s.valor_mensal||0)}"></label><label><span>Comissão (%)</span><input name="comissao_percentual" type="number" step="0.001" value="${Number(s.comissao_percentual||0)}"></label><label><span>Próxima cobrança</span><input name="proxima_cobranca" type="date" value="${s.proxima_cobranca||''}"></label><button class="sa-btn primary span-2" type="submit">Salvar assinatura</button></form>`;openModal("entityModal");$("#quickSubscriptionForm")?.addEventListener("submit",saveSubscription);}
  async function saveSubscription(e){if(!FINANCE_ENABLED){toast("Monetização congelada nesta versão.","info");return;}e.preventDefault();const f=e.currentTarget,id=f.elements.id.value,plan=planById(f.elements.plano_id.value),p={plano_id:Number(f.elements.plano_id.value),status:f.elements.status.value,valor_mensal:Number(f.elements.valor_mensal.value||0),comissao_percentual:Number(f.elements.comissao_percentual.value||plan?.comissao_percentual||0),proxima_cobranca:f.elements.proxima_cobranca.value||null};const{error}=await db.from("loja_assinaturas").update(p).eq("id",id);if(error)return toast(error.message,"error");await db.from("loja_controle_plataforma").update({plano_id:p.plano_id,comissao_percentual:p.comissao_percentual,status_financeiro:["atrasada","suspensa"].includes(p.status)?"atrasado":"ok"}).eq("loja_id",state.subscriptions.find(x=>Number(x.id)===Number(id))?.loja_id);toast("Assinatura atualizada.");closeAllModals();await loadAll({silent:true});}

  async function saveTeam(e){e.preventDefault();if(state.me?.nivel!=="owner")return toast("Somente o Owner pode alterar a equipe.","error");const f=e.currentTarget,userId=f.elements.user_id.value,p=profileById(userId);const{error}=await db.from("super_admins").insert({user_id:userId,nivel:f.elements.nivel.value,ativo:true,nome_exibicao:p?.nome||null});if(error)return toast(error.message,"error");toast("Membro adicionado à equipe Go-burger.");f.reset();closeModal("teamModal");await loadAll({silent:true});}
  async function toggleTeam(id,active){if(state.me?.nivel!=="owner")return toast("Somente o Owner pode alterar a equipe.","error");const{error}=await db.from("super_admins").update({ativo:!active}).eq("user_id",id);if(error)return toast(error.message,"error");toast("Acesso da equipe atualizado.");await loadAll({silent:true});}

  function csvDownload(name,rows){if(!rows.length)return toast("Não há dados para exportar.","info");const keys=Object.keys(rows[0]),esc=v=>`"${String(v??"").replaceAll('"','""')}"`,csv=[keys.map(esc).join(","),...rows.map(r=>keys.map(k=>esc(r[k])).join(","))].join("\n");const blob=new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}

  async function runDiagnostics(){const results=[];const test=async(name,fn)=>{try{await fn();results.push({name,ok:true,detail:"Teste concluído com sucesso"});}catch(e){results.push({name,ok:false,detail:e.message||"Falhou"});}};results.push({name:"Sessão Super Admin",ok:!!state.user,detail:state.user?.email||"Sem sessão"});await test("RPC Dashboard",async()=>{const{error}=await db.rpc("go_burger_super_dashboard_v1");if(error)throw error});await test("Tabela de lojas",async()=>{const{error}=await db.from("lojas").select("id",{head:true,count:"exact"});if(error)throw error});await test("Controles da plataforma",async()=>{const{error}=await db.from("loja_controle_plataforma").select("loja_id").limit(1);if(error)throw error});await test("Storage burger-assets",async()=>{const{error}=await db.storage.from("burger-assets").list("",{limit:1});if(error)throw error});await test("Onboarding de entregadores",async()=>{const{error}=await db.rpc("go_burger_super_admin_entregador_solicitacoes_v45");if(error)throw error});results.push({name:"Service Worker",ok:"serviceWorker" in navigator,detail:"serviceWorker" in navigator?"API disponível":"API não disponível"});results.push({name:"Chart.js",ok:!!window.Chart,detail:window.Chart?"Biblioteca carregada":"Biblioteca indisponível"});renderSystemHealth(results);toast(results.every(x=>x.ok!==false)?"Diagnóstico Go-burger concluído sem falhas.":"Diagnóstico encontrou itens para revisar.",results.every(x=>x.ok!==false)?"success":"error");}

  function globalSearch(value){const q=lower(value).trim();if(!q)return;const store=state.stores.find(s=>`${s.nome} ${s.slug} ${s.cidade}`.toLowerCase().includes(q));if(store){navigate("lojas");$("#storeSearch").value=value;renderStores();toast(`Hamburgueria encontrada: ${store.nome}`,"info");return;}const user=state.profiles.find(p=>`${p.nome} ${p.email} ${p.telefone}`.toLowerCase().includes(q));if(user){navigate("usuarios");$("#userSearch").value=value;renderUsers();toast(`Usuário encontrado: ${user.nome||user.email}`,"info");return;}const driver=state.driverRequests.find(r=>`${r.nome} ${r.telefone} ${r.email} ${r.placa}`.toLowerCase().includes(q));if(driver){navigate("entregadores");$("#driverSearch").value=value;renderDriversAdmin();toast(`Entregador encontrado: ${driver.nome}`,"info");return;}const order=state.orders.find(o=>String(o.id)===q.replace("#","")||lower(o.cliente_nome).includes(q));if(order){navigate("pedidos");$("#orderSearch").value=value;renderOrders();toast(`Pedido #${order.id} encontrado`,"info");return;}toast("Nenhum resultado para esta busca.","info");}

  function bindEvents(){
    document.addEventListener("click",e=>{const el=s=>e.target.closest?.(s);
      const page=el("[data-page]");if(page){navigate(page.dataset.page);return;}
      if(el("[data-close-modal]")){closeModal(el("[data-close-modal]").dataset.closeModal);return;}
      if(el("[data-open-store]")){openStoreDetail(el("[data-open-store]").dataset.openStore);return;}
      if(el("[data-open-partner-request]")){openPartnerRequestDetail(el("[data-open-partner-request]").dataset.openPartnerRequest);return;}
      if(el("[data-partner-request-action]")){partnerRequestAction(el("[data-partner-request-action]").dataset.requestId,el("[data-partner-request-action]").dataset.partnerRequestAction);return;}
      if(el("[data-open-public-store]")){const s=storeById(el("[data-open-public-store]").dataset.openPublicStore);if(s)open(`../cliente/cliente.html?loja=${encodeURIComponent(s.slug)}`,"_blank","noopener");return;}
      if(el("[data-store-action]")){storeAction(el("[data-store-action]").dataset.storeId,el("[data-store-action]").dataset.storeAction);return;}
      if(el("[data-delete-store]")){deleteStorePermanently(el("[data-delete-store]").dataset.deleteStore);return;}
      if(el("[data-open-user]")){openUserDetail(el("[data-open-user]").dataset.openUser);return;}
      if(el("[data-open-driver]")){openDriverRequest(el("[data-open-driver]").dataset.openDriver);return;}
      if(el("[data-driver-action]")){driverRequestAction(el("[data-driver-action]").dataset.driverId,el("[data-driver-action]").dataset.driverAction);return;}
      if(el("[data-user-action]")){userAction(el("[data-user-action]").dataset.userId,el("[data-user-action]").dataset.userAction);return;}
      if(el("[data-create-plan-migration]")){createPlanMigrationP680();return;}
      if(el("[data-edit-plan]")){openPlan(state.plans.find(p=>Number(p.id)===Number(el("[data-edit-plan]").dataset.editPlan)));return;}
      if(el("[data-revoke-plan-courtesy]")){revokePlanCourtesyP660(el("[data-revoke-plan-courtesy]").dataset.revokePlanCourtesy);return;}
      if(el("[data-edit-subscription]")){openSubscriptionEdit(el("[data-edit-subscription]").dataset.editSubscription);return;}
      if(el("[data-edit-category]")){openCategory(state.categories.find(c=>Number(c.id)===Number(el("[data-edit-category]").dataset.editCategory)));return;}
      if(el("[data-edit-banner]")){openBanner(state.banners.find(b=>Number(b.id)===Number(el("[data-edit-banner]").dataset.editBanner)));return;}
      if(el("[data-delete-banner]")){deleteBanner(el("[data-delete-banner]").dataset.deleteBanner);return;}
      if(el("[data-review-status]")){reviewStatus(el("[data-review-status]").dataset.reviewId,el("[data-review-status]").dataset.reviewStatus);return;}
      if(el("[data-resolve-moderation]")){resolveModeration(el("[data-resolve-moderation]").dataset.resolveModeration);return;}
      if(el("[data-open-ticket]")){openTicket(el("[data-open-ticket]").dataset.openTicket);return;}
      if(el("[data-ticket-status]")){ticketStatus(el("[data-ticket-status]").dataset.ticketId,el("[data-ticket-status]").dataset.ticketStatus);return;}
      if(el("[data-team-toggle]")){toggleTeam(el("[data-team-toggle]").dataset.teamToggle,el("[data-team-toggle]").dataset.teamActive==="1");return;}
    });
    $("#saOverlay")?.addEventListener("click",()=>{closeAllModals();$("#saSidebar")?.classList.remove("open");$("#saOverlay")?.classList.remove("menu-active")});
    $("#saMobileMenu")?.addEventListener("click",()=>{$("#saSidebar")?.classList.toggle("open");$("#saOverlay")?.classList.toggle("menu-active")});
    $("#saExit")?.addEventListener("click",()=>{parent!==window?parent.postMessage({type:"go-burger-mode",mode:"cliente"},location.origin):location.href="../burger/index.html?modo=cliente"});
    $("#saBackButton")?.addEventListener("click",()=>{if(parent!==window){parent.postMessage({type:"go-burger-mode",mode:"cliente"},location.origin);}else{location.href="../burger/index.html?modo=cliente";}});
    $("#saRefresh")?.addEventListener("click",()=>loadAll());
    
    $("#saGlobalSearch")?.addEventListener("keydown",e=>{if(e.key==="Enter")globalSearch(e.target.value)});
    document.addEventListener("keydown",e=>{if(e.key==="Escape")closeAllModals();if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"){e.preventDefault();$("#saGlobalSearch")?.focus()}});
    ["#storeSearch","#storeStatusFilter","#storeApprovalFilter"].forEach(x=>$(x)?.addEventListener("input",renderStores));
    ["#orderSearch","#orderStatusFilter","#orderStoreFilter"].forEach(x=>$(x)?.addEventListener("input",renderOrders));
    ["#userSearch","#userStatusFilter"].forEach(x=>$(x)?.addEventListener("input",renderUsers));["#driverSearch","#driverStatusFilter"].forEach(x=>$(x)?.addEventListener("input",renderDriversAdmin));
    ["#supportSearch","#supportStatusFilter"].forEach(x=>$(x)?.addEventListener("input",renderSupport));
    $("#dashboardChartPeriod")?.addEventListener("change",changeMetricPeriod);$("#exportPlatformMetrics")?.addEventListener("click",exportPlatformMetrics);$("#refreshRetentionStatus")?.addEventListener("click",refreshRetentionStatus);
    $("#moderationTabs")?.addEventListener("click",e=>{const b=e.target.closest("[data-mod-tab]");if(!b)return;$$('[data-mod-tab]').forEach(x=>x.classList.toggle("active",x===b));$$('[data-mod-pane]').forEach(x=>x.classList.toggle("active",x.dataset.modPane===b.dataset.modTab))});
    document.addEventListener("change",e=>{const f=e.target.closest("[data-flag-toggle]");if(f)toggleFlag(f.dataset.flagToggle,f.checked)});
    $("#newPlanButton")?.addEventListener("click",()=>openPlan());$("#newCategoryButton")?.addEventListener("click",()=>openCategory());$("#newBannerButton")?.addEventListener("click",()=>openBanner());
    $("#newPlanCouponButton")?.addEventListener("click",openPlanCouponP660);$("#newPlanPromoButton")?.addEventListener("click",openPlanPromoP660);$("#newPlanOfferButton")?.addEventListener("click",openPlanOfferP660);$("#newPlanCourtesyButton")?.addEventListener("click",openPlanCourtesyP660);$("#planBillingConfigButton")?.addEventListener("click",openPlanBillingConfigP660);$("#planGatewayConfigButton")?.addEventListener("click",openPlanGatewayConfigP660);
    $("#planP700PilotOn")?.addEventListener("click",()=>setPlanPilotModeP700('pilot_no_charge'));$("#planP700PilotOff")?.addEventListener("click",()=>setPlanPilotModeP700('disabled'));$("#planP700KillSwitch")?.addEventListener("click",engagePlanKillSwitchP700);$("#newPlanPilotP700")?.addEventListener("click",openPlanPilotP700);$("#newPlanEnterpriseP700")?.addEventListener("click",openPlanEnterpriseP700);
    $("#newCampaignButton")?.addEventListener("click",()=>openModal("campaignModal"));$("#newNotificationButton")?.addEventListener("click",()=>openModal("notificationModal"));$("#addTeamButton")?.addEventListener("click",()=>openModal("teamModal"));
    $("#financePreparationForm")?.addEventListener("submit",saveFinancePreparation);$("#financeSimulatorForm")?.addEventListener("submit",simulateFinanceSplit);$("#planForm")?.addEventListener("submit",savePlan);$("#planMigrationForm")?.addEventListener("submit",previewPlanMigrationP680);$("#categoryForm")?.addEventListener("submit",saveCategory);$("#bannerForm")?.addEventListener("submit",saveBanner);$("#campaignForm")?.addEventListener("submit",saveCampaign);$("#notificationForm")?.addEventListener("submit",saveNotification);$("#teamForm")?.addEventListener("submit",saveTeam);$("#platformSettingsForm")?.addEventListener("submit",saveSettings);
    $("#globalBannerFile")?.addEventListener("change",e=>{const file=e.target.files?.[0];if(!file)return renderGlobalBannerPreview($("#bannerForm")?.elements.imagem_url.value||"");const reader=new FileReader();reader.onload=()=>renderGlobalBannerPreview(String(reader.result||""));reader.readAsDataURL(file);});
    $("#bannerForm")?.elements.imagem_url?.addEventListener("input",e=>renderGlobalBannerPreview(e.target.value.trim()));
    $("#globalBannerPreview")?.addEventListener("click",e=>{if(!e.target.closest("#clearGlobalBannerImage"))return;const f=$("#bannerForm");f.elements.imagem_url.value="";if($("#globalBannerFile"))$("#globalBannerFile").value="";renderGlobalBannerPreview("");});
    $("#runDiagnostics")?.addEventListener("click",runDiagnostics);
    $("#exportStores")?.addEventListener("click",()=>csvDownload("go-burger-hamburguerias.csv",state.stores));$("#exportOrdersGlobal")?.addEventListener("click",()=>csvDownload("go-burger-pedidos.csv",state.orders));$("#exportAudit")?.addEventListener("click",()=>csvDownload("go-burger-auditoria.csv",state.audit));
    $("#newAlertButton")?.addEventListener("click",async()=>{const titulo=prompt("Título do alerta:");if(!titulo)return;const mensagem=prompt("Mensagem:")||titulo;const{error}=await db.from("plataforma_alertas").insert({titulo,mensagem,severidade:"aviso",tipo:"manual"});if(error)return toast(error.message,"error");toast("Alerta criado.");await loadAll({silent:true})});
  }

  function mfaPanel() {
    let panel = $("#saMfaPanel");
    if (panel) return panel;
    panel = document.createElement("div");
    panel.id = "saMfaPanel";
    panel.className = "sa-mfa-panel";
    $(".sa-gate-card")?.appendChild(panel);
    return panel;
  }

  function setMfaStatus(message = "", type = "") {
    const el = $("#saMfaStatus");
    if (!el) return;
    el.textContent = message;
    el.className = `sa-mfa-status${type ? ` ${type}` : ""}`;
  }

  async function verifiedTotpFactors() {
    const factors = await db.auth.mfa.listFactors();
    if (factors.error) throw factors.error;
    // Supabase data.totp contém apenas TOTP verificados. Para recuperar
    // enrollments interrompidos é obrigatório inspecionar data.all.
    const all = Array.isArray(factors.data?.all) ? factors.data.all : [];
    const totp = all.filter(f => String(f.factor_type || f.type || "").toLowerCase() === "totp");
    return {
      verified: totp.filter(f => String(f.status || "").toLowerCase() === "verified"),
      unverified: totp.filter(f => String(f.status || "").toLowerCase() !== "verified")
    };
  }

  async function recoverPendingMfaServerSide() {
    const recovery = await db.functions.invoke("go-burger-mfa-recovery", {
      body: { action: "cleanup_unverified" }
    });
    if (recovery.error) throw new Error(recovery.error.message || "Não foi possível recuperar o MFA pendente.");
    if (recovery.data?.error) throw new Error(recovery.data.error);
    return recovery.data || { ok: true, removed: 0 };
  }

  async function verifyMfaCode(factorId, code) {
    const clean = String(code || "").replace(/\D/g, "").slice(0, 6);
    if (clean.length !== 6) throw new Error("Digite o código de 6 dígitos do aplicativo autenticador.");
    const challenge = await db.auth.mfa.challenge({ factorId });
    if (challenge.error) throw challenge.error;
    const verified = await db.auth.mfa.verify({ factorId, challengeId: challenge.data.id, code: clean });
    if (verified.error) throw verified.error;
    await db.auth.refreshSession();
    const aal = await db.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal.error) throw aal.error;
    if (aal.data?.currentLevel !== "aal2") throw new Error("A verificação foi recebida, mas a sessão ainda não atingiu AAL2. Tente novamente.");
    return true;
  }

  function waitForExistingMfa(factor) {
    return new Promise(resolve => {
      const panel = mfaPanel();
      $("#saGateText").textContent = "Confirme o segundo fator para entrar no Command Center.";
      $("#saGateLoader")?.classList.add("hidden");
      $("#saBackButton")?.classList.remove("hidden");
      panel.innerHTML = `
        <p class="sa-mfa-intro">Abra seu aplicativo autenticador e informe o código temporário da Go Burger.</p>
        <form class="sa-mfa-form" id="saMfaChallengeForm">
          <label>Código do autenticador
            <input id="saMfaChallengeCode" inputmode="numeric" autocomplete="one-time-code" maxlength="6" minlength="6" pattern="[0-9]{6}" placeholder="000000" required>
          </label>
          <button class="sa-btn primary" type="submit"><i class="fa-solid fa-shield-halved"></i> Verificar e entrar</button>
        </form>
        <p class="sa-mfa-status" id="saMfaStatus"></p>
        <div class="sa-mfa-security-note"><i class="fa-solid fa-lock"></i><span>O Super Admin continua protegido por AAL2. A senha sozinha não libera ações administrativas.</span></div>`;
      const form = $("#saMfaChallengeForm");
      form?.addEventListener("submit", async event => {
        event.preventDefault();
        const button = form.querySelector('button[type="submit"]');
        button.disabled = true;
        setMfaStatus("Verificando código...");
        try {
          await verifyMfaCode(factor.id, $("#saMfaChallengeCode")?.value);
          setMfaStatus("MFA confirmado. Abrindo o Command Center...", "success");
          resolve(true);
        } catch (error) {
          setMfaStatus(error.message || "Código inválido. Tente novamente.", "error");
          button.disabled = false;
          $("#saMfaChallengeCode")?.focus();
        }
      });
      requestAnimationFrame(() => {
        const field = $("#saMfaChallengeCode");
        field?.scrollIntoView({ behavior: "smooth", block: "center" });
        field?.focus({ preventScroll: true });
      });
    });
  }

  async function waitForMfaEnrollment(unverified = []) {
    // P608: data.all detecta fatores incompletos; a Edge Function Admin MFA
    // remove somente fatores unverified da própria conta Super Admin.
    // Isso também recupera fatores órfãos que não aparecem no array data.totp.
    if (unverified.length) {
      for (const factor of unverified) {
        const removed = await db.auth.mfa.unenroll({ factorId: factor.id });
        if (removed.error) break;
      }
    }

    await recoverPendingMfaServerSide();

    const afterCleanup = await verifiedTotpFactors();
    if (afterCleanup.verified.length) return waitForExistingMfa(afterCleanup.verified[0]);
    if (afterCleanup.unverified.length) {
      throw new Error("Ainda existe um MFA incompleto. Clique em atualizar e tente novamente; a recuperação automática não apagou o fator pendente.");
    }

    const enrollmentName = `Go Burger Super Admin ${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    const enrollment = await db.auth.mfa.enroll({ factorType: "totp", friendlyName: enrollmentName });
    if (enrollment.error) {
      const msg = String(enrollment.error.message || "");
      if (/factor.*already exists|friendly name/i.test(msg)) {
        await recoverPendingMfaServerSide();
        throw new Error("Havia um MFA incompleto preso e ele foi limpo. Atualize esta página uma vez para gerar um novo QR Code.");
      }
      const latest = await verifiedTotpFactors();
      if (latest.verified.length) return waitForExistingMfa(latest.verified[0]);
      throw enrollment.error;
    }
    const factor = enrollment.data;
    const qr = factor?.totp?.qr_code || "";
    const secret = factor?.totp?.secret || "";
    if (!factor?.id || !qr) throw new Error("Não foi possível gerar o QR Code do MFA.");

    return new Promise(resolve => {
      const panel = mfaPanel();
      $("#saGateText").textContent = "Proteção obrigatória do Super Admin";
      $("#saGateLoader")?.classList.add("hidden");
      $("#saBackButton")?.classList.remove("hidden");
      panel.innerHTML = `
        <p class="sa-mfa-intro">Esta conta é Super Admin, mas ainda não possui segundo fator. Escaneie o QR Code com Google Authenticator, Microsoft Authenticator, Authy ou outro app TOTP.</p>
        <div class="sa-mfa-qr-wrap"><img class="sa-mfa-qr" id="saMfaQr" alt="QR Code para configurar MFA"></div>
        <form class="sa-mfa-form sa-mfa-form-primary" id="saMfaEnrollForm">
          <label><span>Depois de escanear, digite o código de 6 dígitos</span>
            <input id="saMfaEnrollCode" inputmode="numeric" autocomplete="one-time-code" maxlength="6" minlength="6" pattern="[0-9]{6}" placeholder="000000" aria-describedby="saMfaCodeHelp" required>
          </label>
          <small id="saMfaCodeHelp" class="sa-mfa-code-help">O código aparece no aplicativo autenticador e muda aproximadamente a cada 30 segundos.</small>
          <button class="sa-btn primary" type="submit"><i class="fa-solid fa-shield-halved"></i> Ativar MFA e entrar</button>
        </form>
        <details class="sa-mfa-manual"><summary>Não conseguiu escanear? Usar chave manual</summary><div class="sa-mfa-secret"><span>Chave manual</span><code id="saMfaSecret"></code></div></details>
        <p class="sa-mfa-status" id="saMfaStatus"></p>
        <div class="sa-mfa-security-note"><i class="fa-solid fa-circle-info"></i><span>Guarde o autenticador em um dispositivo sob seu controle. A Go Burger não exibe esta chave depois que o cadastro termina.</span></div>`;
      const qrNode = $("#saMfaQr");
      if (qrNode) qrNode.src = qr;
      const secretNode = $("#saMfaSecret");
      if (secretNode) secretNode.textContent = secret;
      const form = $("#saMfaEnrollForm");
      form?.addEventListener("submit", async event => {
        event.preventDefault();
        const button = form.querySelector('button[type="submit"]');
        button.disabled = true;
        setMfaStatus("Ativando proteção MFA...");
        try {
          await verifyMfaCode(factor.id, $("#saMfaEnrollCode")?.value);
          setMfaStatus("MFA ativado. Abrindo o Command Center...", "success");
          resolve(true);
        } catch (error) {
          setMfaStatus(error.message || "Não foi possível validar o código.", "error");
          button.disabled = false;
          $("#saMfaEnrollCode")?.focus();
        }
      });
      requestAnimationFrame(() => {
        const field = $("#saMfaEnrollCode");
        field?.scrollIntoView({ behavior: "smooth", block: "center" });
        field?.focus({ preventScroll: true });
      });
    });
  }

  async function ensureSuperAdminMfa() {
    const member = await db.rpc("go_burger_e_super_admin_membro_v605");
    if (member.error) throw member.error;
    if (member.data !== true) {
      deny("Esta conta não integra a equipe Super Admin da Go-burger.");
      return false;
    }

    const aal = await db.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal.error) throw aal.error;
    if (aal.data?.currentLevel === "aal2") return true;

    const factors = await verifiedTotpFactors();
    if (factors.verified.length) return waitForExistingMfa(factors.verified[0]);
    return waitForMfaEnrollment(factors.unverified);
  }

  async function boot() {
    const gateBack = $("#saBackButton");
    if (gateBack && gateBack.dataset.bootstrapBound !== "1") {
      gateBack.dataset.bootstrapBound = "1";
      gateBack.addEventListener("click",()=>{if(parent!==window){parent.postMessage({type:"go-burger-mode",mode:"cliente"},location.origin);}else{location.href="../burger/index.html?modo=cliente";}});
    }
    const { data, error } = await db.auth.getSession(); if (error) throw error; state.user=data?.session?.user||null;
    if(!state.user){deny("Faça login na Go-burger antes de abrir o Command Center.");return;}
    const mfaOk = await ensureSuperAdminMfa();
    if (!mfaOk) return;
    const access=await db.rpc("go_burger_e_super_admin"); if(access.error)throw access.error; if(!access.data){deny("MFA confirmado, mas esta sessão ainda não possui autorização Super Admin. Atualize a página e tente novamente.");return;}
    const {data:me,error:meError}=await db.from("super_admins").select("*").eq("user_id",state.user.id).maybeSingle();if(meError)throw meError;state.me=me;
    await db.from("super_admins").update({ultimo_acesso_em:new Date().toISOString()}).eq("user_id",state.user.id);
    $("#saGate")?.classList.add("hidden");$("#superApp")?.classList.remove("hidden");
    document.dispatchEvent(new CustomEvent("go-burger-super-aal2-ready"));
    const profile=await db.from("profiles").select("nome,email").eq("id",state.user.id).maybeSingle();const name=me?.nome_exibicao||profile.data?.nome||state.user.email||"Super Admin";
    $("#saUserName").textContent=name;$("#saUserLevel").textContent=String(me?.nivel||"super_admin").replaceAll("_"," ").toUpperCase();$("#saAvatar").textContent=initials(name);
    window.GoBurgerTheme?.apply?.();
    bindEvents();await loadAll();renderSystemHealth();navigate(location.hash.slice(1)||"dashboard");
    if(parent!==window)parent.postMessage({type:"go-burger-super-ready"},location.origin);
  }

  db.auth.onAuthStateChange((event,session)=>{if(event==="SIGNED_OUT"){if(parent!==window){parent.postMessage({type:"go-burger-auth-refresh"},location.origin);}else{location.href="../burger/index.html";}}if(event==="TOKEN_REFRESHED"&&session?.user)state.user=session.user});
  boot().catch(e=>{console.error("Go-burger Super Admin",e);deny(e.message||"Não foi possível iniciar o Super Admin.")});
});
