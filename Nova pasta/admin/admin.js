"use strict";

document.addEventListener("DOMContentLoaded", async () => {
  const SUPABASE_URL = "https://ethlgaszdextwckdwgsf.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_qEhxWcCbekPjYFUW-EQ1ow_xccHG8aJ";
  const STORAGE_BUCKET = "burger-assets";
  const FINANCE_ENABLED = false; // P602: pagamentos/assinaturas congelados no lançamento
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const html = value => String(value ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  const money = value => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const dateTime = value => value ? new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "-";
  const dateOnly = value => value ? new Date(value).toLocaleDateString("pt-BR") : "-";
  const slug = value => String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const initials = value => String(value || "Administrador").trim().split(/\s+/).slice(0, 2).map(x => x[0] || "").join("").toUpperCase() || "AD";
  const today = value => value && new Date(value).toDateString() === new Date().toDateString();
  const asNumber = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const empty = (icon, title, text) => `<div class="empty-state"><i class="fa-solid ${icon}"></i><strong>${html(title)}</strong><p>${html(text)}</p></div>`;
  const ORDER_SELECT = "*,pedido_itens(*,pedido_item_opcoes(*),pedido_item_removidos(*))";
  const storagePathFromPublicUrl = url => {
    if (!url) return null;
    const marker = `/storage/v1/object/public/${STORAGE_BUCKET}/`;
    const i = String(url).indexOf(marker);
    return i >= 0 ? decodeURIComponent(String(url).slice(i + marker.length)) : null;
  };

  if (!window.supabase?.createClient) {
    const box = $("#adminAuthErro");
    if (box) { box.textContent = "O SDK do Supabase não foi carregado. Verifique sua internet."; box.classList.add("show"); }
    return;
  }

  const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: "go-burger-auth-v1" }
  });

  const state = {
    user: null, profile: null, lojas: [], loja: null,
    produtos: [], custos: [], pedidos: [], clientes: [], cupons: [], config: {},
    grupos: [], opcoes: [], produtoGrupos: [], ingredientes: [],
    bairros: [], horarios: [], banners: [], upsells: [],
    recompensas: [], fidelidade: [], resgates: [], avaliacoes: [], estoqueMov: [], notificacoes: [], logs: [],
    chart: null, realtime: null, loading: false, cozinha: false,
    health: {}, activeProductCustomization: null,
    platformControl: {}, subscription: {}, platformAccess: { status:"ativo", super_admin:false }, partnerRequest: null,
    equipe: [], marketplaceCategorias: [], lojaCategorias: [], faturas: [], transacoes: [], sellerAccount: {}, entregadores: [], pedidoEntregas: [], driverInvites: [], plans: [], reconciliation: {}, planUsage: {}, planPortal: {}, planCycle: localStorage.getItem("go-burger-plan-cycle")||"mensal", planRevenueEstimate: Number(localStorage.getItem("go-burger-plan-revenue")||0)
  };

  const pages = {
    dashboard:["VISÃO GERAL","Dashboard","Indicadores e operação da hamburgueria."],
    operacao:["COZINHA","Operação","Fila operacional em tempo real."],
    pedidos:["VENDAS","Pedidos","Gerencie pedidos, pagamento e entrega."],
    estoque:["INVENTÁRIO","Estoque","Controle, alertas e histórico de movimentações."],
    produtos:["CARDÁPIO","Produtos","Produtos, imagens, preço, custo e disponibilidade."],
    personalizacao:["CARDÁPIO PRO","Personalização","Adicionais, opções e ingredientes removíveis."],
    marketing:["CRESCIMENTO","Marketing","Banners e ofertas inteligentes."],
    cupons:["PROMOÇÕES","Cupons PRO","Descontos, limites e validade."],
    clientes:["CRM","Clientes","Relacionamento, segmentos e histórico."],
    equipe:["GESTÃO","Equipe","Dono, admin, gerente, cozinha, atendimento e entrega."],
    fidelidade:["RETENÇÃO","Fidelidade","Pontos, recompensas e movimentos."],
    avaliacoes:["QUALIDADE","Avaliações","Notas e comentários dos clientes."],
    entregas:["OPERAÇÃO","Entregas e horários","Bairros, taxas, retirada, agendamento e horários."],
    hamburgueria:["MINHA MARCA","Minha hamburgueria","Identidade, presença pública e prévia da sua loja."],
    relatorios:["ANÁLISE","Relatórios","Performance comercial e operacional."],
    planos:["PLANOS","Planos & assinatura","Escolha o plano da hamburgueria e acompanhe sua contratação."],
    financeiro:["SAAS","Financeiro & plano","Assinatura, faturas, comissão e pagamentos online."],
    entregadores:["LOGÍSTICA","Entregadores","Equipe de entrega, atribuições e acompanhamento de rota."],
    notificacoes:["CENTRAL","Notificações","Eventos importantes do sistema."],
    confianca:["TRUST & SAFETY","Suporte & confiança","Chamados, disputas, risco e auditoria da hamburgueria."],
    ativacao:["GO-LIVE","Ativação & saúde","Onboarding guiado, checklist e saúde da hamburgueria."],
    erp:["GESTÃO PRO","ERP & CMV","Ingredientes, ficha técnica, custos, DRE e fechamento de caixa."],
    inteligencia:["OPERAÇÃO PRO","Inteligência","Previsão, fila inteligente, cancelamentos e despacho."],
    mensagens:["RELACIONAMENTO","Chat de pedidos","Conversas protegidas entre cliente e hamburgueria."],
    salao:["CONSUMO LOCAL","Salão & mesas","QR Code, mesas e comandas digitais."],
    configuracoes:["SISTEMA","Configurações","Marca, loja, PIX, operação e fidelidade."],
    diagnostico:["SAÚDE","Diagnóstico","Verifique conexão, tabelas, Storage e Realtime."]
  };

  function toast(message, type="success") {
    const wrap = $("#toastContainer") || document.body;
    const node = document.createElement("div");
    node.className = `toast ${type}`;
    const icon = type === "error" ? "fa-triangle-exclamation" : type === "info" ? "fa-circle-info" : "fa-circle-check";
    node.innerHTML = `<span class="toast-icon"><i class="fa-solid ${icon}"></i></span><div><strong>${type === "error" ? "Erro" : type === "info" ? "Informação" : "Sucesso"}</strong><p>${html(message)}</p></div>`;
    wrap.appendChild(node); requestAnimationFrame(() => node.classList.add("show"));
    setTimeout(() => { node.classList.remove("show"); setTimeout(() => node.remove(), 280); }, 4200);
  }

  function setButton(button, loading, label="Processando...") {
    if (!button) return;
    if (loading) { button.dataset.oldHtml ||= button.innerHTML; button.disabled = true; button.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${html(label)}`; }
    else { button.disabled = false; if (button.dataset.oldHtml) { button.innerHTML = button.dataset.oldHtml; delete button.dataset.oldHtml; } }
  }

  function loginError(message="") {
    const box = $("#adminAuthErro"); if (!box) return;
    box.textContent = message; box.classList.toggle("show", Boolean(message));
  }
  function showLogin(message="") { $("#adminAuth")?.classList.remove("hidden"); $("#adminApp")?.classList.add("hidden"); $("#partnerOnboarding")?.classList.add("hidden"); loginError(message); }
  function showPanel() { $("#adminAuth")?.classList.add("hidden"); $("#partnerOnboarding")?.classList.add("hidden"); $("#adminApp")?.classList.remove("hidden"); loginError(""); }
  function showPartnerOnboarding() { $("#adminAuth")?.classList.add("hidden"); $("#adminApp")?.classList.add("hidden"); $("#partnerOnboarding")?.classList.remove("hidden"); renderPartnerRequestStatus(); loginError(""); }

  async function loadPartnerRequest(){
    try{
      const {data,error}=await db.rpc("go_burger_minha_solicitacao_parceiro_v1");
      if(error)throw error;
      state.partnerRequest=data||null;
    }catch(error){
      console.warn("Go-burger · solicitação de parceiro",error.message);
      state.partnerRequest=null;
    }
    return state.partnerRequest;
  }

  function renderPartnerRequestStatus(){
    const box=$("#partnerRequestStatus"),button=$("#btnOnboardingNovaHamburgueria"),title=$("#partnerOnboardingTitle"),text=$("#partnerOnboardingText");
    if(!box||!button)return;
    const r=state.partnerRequest;
    box.className="partner-request-status hidden";
    button.disabled=false;
    if(!r){
      if(title)title.textContent="Sua hamburgueria pode entrar para a Go-burger.";
      if(text)text.textContent="Envie seus dados para análise. A hamburgueria só será criada depois da autorização do Super Admin e continuará em rascunho até a aprovação final para publicação.";
      button.innerHTML='<i class="fa-solid fa-paper-plane"></i> Enviar solicitação';
      return;
    }
    const status=String(r.status||"pendente").toLowerCase();
    const map={
      pendente:{cls:"pending",icon:"fa-clock",label:"Solicitação pendente",msg:"Seus dados foram enviados. Nenhuma hamburgueria foi criada ainda; a solicitação aguarda análise do Super Admin."},
      em_analise:{cls:"review",icon:"fa-magnifying-glass",label:"Solicitação em análise",msg:"O Super Admin está revisando seu cadastro. A loja só será criada se a entrada for aprovada."},
      aguardando_correcao:{cls:"correction",icon:"fa-pen-to-square",label:"Correção solicitada",msg:"O Super Admin pediu ajustes antes de decidir sobre a entrada da hamburgueria."},
      recusado:{cls:"rejected",icon:"fa-circle-xmark",label:"Solicitação recusada",msg:"A entrada não foi autorizada com os dados atuais. Você pode revisar as informações e enviar novamente."}
    };
    const cfg=map[status]||map.pendente;
    box.className=`partner-request-status ${cfg.cls}`;
    box.innerHTML=`<strong><i class="fa-solid ${cfg.icon}"></i>${html(cfg.label)}</strong><p>${html(cfg.msg)}</p>${r.observacao_super_admin?`<div class="request-note"><i class="fa-solid fa-message"></i> ${html(r.observacao_super_admin)}</div>`:""}`;
    if(title)title.textContent=status==="aguardando_correcao"?"Sua solicitação precisa de uma correção.":status==="recusado"?"Revise os dados e tente novamente.":"Sua solicitação está com a Go-burger.";
    if(text)text.textContent=cfg.msg;
    if(["pendente","em_analise"].includes(status)){
      button.disabled=true;
      button.innerHTML='<i class="fa-solid fa-hourglass-half"></i> Aguardando Super Admin';
    }else{
      button.innerHTML=`<i class="fa-solid fa-pen"></i> ${status==="aguardando_correcao"?"Corrigir e reenviar":"Revisar e reenviar"}`;
    }
  }

  async function ensurePlatformAccess() {
    const { data, error } = await db.rpc("go_burger_status_usuario");
    if (error) throw new Error("Não foi possível validar seu acesso na Go-burger.");
    state.platformAccess = data || {status:"ativo",super_admin:false};
    const status = String(state.platformAccess.status || "ativo").toLowerCase();
    if (status !== "ativo" && state.platformAccess.super_admin !== true) {
      throw new Error(`Sua conta está ${status} na Go-burger. Fale com o suporte para continuar.`);
    }
    return true;
  }

  async function adminProfile(user) {
    const { data, error } = await db.from("profiles").select("*").eq("id", user.id).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Sua conta existe no Auth, mas não existe em public.profiles.");
    return data;
  }

  async function loadAdminStores() {
    const { data, error } = await db.rpc("minhas_lojas");
    if (error) throw error;
    const memberships = (data || []).filter(x => ["dono","admin","gerente","cozinha","atendente","entregador"].includes(String(x.papel || "").toLowerCase()));
    if (!memberships.length) {
      state.lojas = []; state.loja = null;
      renderStoreSwitcher();
      return [];
    }

    const ids = memberships.map(x => Number(x.id)).filter(Number.isFinite);
    const { data: details, error: detailsError } = await db.from("lojas").select("*").in("id", ids);
    if (detailsError) throw detailsError;
    const byId = new Map((details || []).map(x => [Number(x.id), x]));
    const managed = memberships.map(m => ({ ...(byId.get(Number(m.id)) || {}), ...m, papel:m.papel, principal:m.principal }));

    state.lojas = managed;
    const preferredId = Number(new URLSearchParams(location.search).get("loja_id") || 0);
    const savedId = Number(localStorage.getItem("go_burger_admin_loja_id") || 0);
    state.loja = managed.find(x => Number(x.id) === preferredId) || managed.find(x => Number(x.id) === savedId) || managed.find(x => x.principal) || managed[0];
    localStorage.setItem("go_burger_admin_loja_id", String(state.loja.id));
    renderStoreSwitcher();
    return managed;
  }

  function renderStoreSwitcher() {
    const select = $("#adminLojaSelect");
    const wrap = $("#adminLojaContext");
    if (!select || !wrap) return;
    if (!state.loja) {
      select.innerHTML = '<option value="">Nenhuma loja</option>';
      const label = $("#adminLojaContextLabel"); if (label) label.textContent = "Cadastre sua loja";
      wrap.classList.add("single");
      $("#btnNovaHamburgueria")?.classList.remove("hidden");
      return;
    }
    select.innerHTML = state.lojas.map(l => `<option value="${l.id}" ${Number(l.id)===Number(state.loja.id)?"selected":""}>${html(l.nome)}</option>`).join("");
    wrap.classList.toggle("single", state.lojas.length <= 1);
    const label = $("#adminLojaContextLabel");
    if (label) label.textContent = state.loja.nome || "Hamburgueria";
    const canCreate = ["dono","admin"].includes(String(state.loja.papel || "").toLowerCase());
    $("#btnNovaHamburgueria")?.classList.toggle("hidden", !canCreate);
  }

  async function switchAdminStore(id) {
    const next = state.lojas.find(x => Number(x.id) === Number(id));
    if (!next || Number(next.id) === Number(state.loja?.id)) return;
    state.loja = next;
    localStorage.setItem("go_burger_admin_loja_id", String(next.id));
    state.activeProductCustomization = null;
    renderStoreSwitcher();
    await loadAll(true);
    startRealtime();
    toast(`Painel alterado para ${next.nome}.`, "info");
  }

  async function signIn(event) {
    event.preventDefault();
    const form = event.currentTarget, button = form.querySelector('[type="submit"]');
    const email = String(form.elements.email.value || "").trim().toLowerCase();
    const password = String(form.elements.senha.value || "");
    if (!email || !password) return loginError("Informe e-mail e senha.");
    setButton(button, true, "Entrando..."); loginError("");
    try {
      const { data, error } = await db.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const profile = await adminProfile(data.user);
      state.user = data.user; state.profile = profile;
      await ensurePlatformAccess();
      await loadAdminStores();
      await loadPartnerRequest();
      if (!state.loja) { showPartnerOnboarding(); toast(state.partnerRequest?"Acompanhe aqui o status da sua solicitação de parceria.":"Bem-vindo ao Go-burger Parceiros. Envie sua solicitação para começar.","info"); }
      else { showPanel(); await initPanel(); toast("Login realizado com sucesso."); }
    } catch (e) {
      const msg = /invalid login credentials/i.test(e.message || "") ? "E-mail ou senha incorretos." : /email not confirmed/i.test(e.message || "") ? "Este e-mail ainda não foi confirmado." : e.message;
      showLogin(msg || "Não foi possível entrar.");
    } finally { setButton(button, false); }
  }

  async function recoverPassword() {
    const email = String($("#adminEmail")?.value || "").trim().toLowerCase();
    if (!email) { $("#adminEmail")?.focus(); return loginError("Digite seu e-mail primeiro."); }
    try {
      const redirectTo = ["http:","https:"].includes(location.protocol) ? `${location.origin}${location.pathname}` : undefined;
      const { error } = await db.auth.resetPasswordForEmail(email, redirectTo ? { redirectTo } : undefined);
      if (error) throw error; toast("Se o e-mail estiver cadastrado, você receberá as instruções.", "info");
    } catch(e) { loginError(e.message || "Não foi possível solicitar a recuperação."); }
  }

  async function signOut() {
    if (!confirm("Deseja sair do painel Go-burger?")) return;
    if (state.realtime) { try { await db.removeChannel(state.realtime); } catch {} }
    await db.auth.signOut(); state.user = null; state.profile = null; state.loja = null; state.lojas = []; showLogin();
  }

  function allowedPagesForRole(role){
    const r=String(role||"").toLowerCase();
    if(["dono","admin"].includes(r)) return Object.keys(pages);
    if(r==="gerente") return Object.keys(pages).filter(page=>!["planos","financeiro"].includes(page));
    if(r==="cozinha") return ["operacao","pedidos","notificacoes"];
    if(r==="atendente") return ["operacao","pedidos","notificacoes"];
    if(r==="entregador") return ["operacao","pedidos","notificacoes"];
    return ["pedidos"];
  }
  function canOpenPage(page){ return allowedPagesForRole(state.loja?.papel).includes(page); }
  function applyRolePermissions(){
    const allowed=new Set(allowedPagesForRole(state.loja?.papel));
    $$('[data-page]').forEach(btn=>{
      const page=btn.dataset.page;
      btn.classList.toggle("role-hidden", !allowed.has(page));
      btn.setAttribute("aria-hidden", allowed.has(page)?"false":"true");
    });
    document.body.dataset.storeRole=String(state.loja?.papel||"").toLowerCase();
  }

  function updateAdminUI() {
    const name = state.profile?.nome || "Administrador", email = state.user?.email || state.profile?.email || "-", av = initials(name);
    if ($("#perfilAdmin strong")) $("#perfilAdmin strong").textContent = name;
    if ($("#perfilAdmin .avatar-admin")) $("#perfilAdmin .avatar-admin").textContent = av;
    if ($("#nomeAdminDashboard")) $("#nomeAdminDashboard").textContent = name.split(/\s+/)[0];
    if ($("#configAdminNome")) $("#configAdminNome").textContent = name;
    if ($("#configAdminEmail")) $("#configAdminEmail").textContent = email; if ($(".account-card .big-avatar")) $(".account-card .big-avatar").textContent = av; if ($(".account-card .role-chip")) $(".account-card .role-chip").innerHTML = `<i class="fa-solid fa-shield-halved"></i> ${html(String(state.loja?.papel||state.profile?.tipo||"admin").toUpperCase())}`;
    document.title = `${state.loja?.nome || "Hamburgueria"} | Go-burger Admin`;
    renderStoreSwitcher();
    applyRolePermissions();
  }

  function planHasFeature(feature){const portal=state.planPortal||{},effective=portal.entitlements?.recursos||{},current=portal.current_plan||{};return effective[feature]===true||(current.recursos||{})[feature]===true;}
  function premiumFeatureForPage(page){return ({marketing:"marketing",cupons:"cupons",fidelidade:"fidelidade"})[page]||null;}
  function navigate(page, setHash=true) {
    if (!pages[page]) page = "dashboard";
    const premium=premiumFeatureForPage(page);if(premium&&state.planPortal?.current_plan&&!planHasFeature(premium)){toast(`Este recurso não está incluído no plano atual. Veja os planos disponíveis.`,"info");page="planos";}
    if (!canOpenPage(page)) page = allowedPagesForRole(state.loja?.papel)[0] || "pedidos";
    $$('[data-section]').forEach(x => x.classList.toggle("active", x.dataset.section === page));
    $$('[data-page]').forEach(x => x.classList.toggle("active", x.dataset.page === page));
    const [eyebrow,title,subtitle] = pages[page];
    if ($("#pageEyebrow")) $("#pageEyebrow").textContent = eyebrow;
    if ($("#pageTitle")) $("#pageTitle").textContent = title;
    if ($("#pageSubtitle")) $("#pageSubtitle").textContent = subtitle;
    if (setHash) history.replaceState(null,"",`#${page}`);
    closeMobile();
    if (page === "dashboard") { renderDashboard(); renderChart(); }
    if (page === "operacao") renderOperation();
    if (page === "relatorios") renderReports();
    if (page === "planos") renderPlansPortal();
    if (page === "hamburgueria") renderStoreStudio();
    if (page === "equipe") renderTeam();
    if (page === "diagnostico") renderDiagnostic();
    scrollTo({ top:0, behavior:"smooth" });
  }

  function openMobile(){ $("#sidebar")?.classList.add("open"); $("#mobileOverlay")?.classList.add("show"); }
  function closeMobile(){ $("#sidebar")?.classList.remove("open"); $("#mobileOverlay")?.classList.remove("show"); }
  function openModal(id){ const m=document.getElementById(id); if(!m)return; m.classList.add("active"); m.setAttribute("aria-hidden","false"); document.body.style.overflow="hidden"; }
  function closeModal(id){ const m=document.getElementById(id); if(!m)return; m.classList.remove("active"); m.setAttribute("aria-hidden","true"); if(!$(".modal.active")) document.body.style.overflow=""; }

  async function logAdmin(action, entity=null, entityId=null, details={}) {
    try { await db.rpc("registrar_admin_log_v10", { p_loja_id:state.loja?.id, p_acao:action, p_entidade:entity, p_entidade_id:entityId == null ? null : String(entityId), p_detalhes:details }); }
    catch(e){ console.warn("admin log", e.message); }
  }

  async function loadOne(key, builder, fallback=[]) {
    try { const result = await builder(); if (result.error) throw result.error; state[key] = result.data ?? fallback; state.health[key] = { ok:true, detail:`${Array.isArray(state[key]) ? state[key].length + " registro(s)" : "OK"}` }; }
    catch(e){ console.error(key,e); state.health[key]={ok:false,detail:e.message}; if (state[key] == null) state[key]=fallback; }
  }

  async function loadAll(silent=false) {
    if (state.loading) return; state.loading = true;
    try {
      await Promise.all([
        loadOne("produtos", () => db.from("produtos").select("*").eq("loja_id",state.loja.id).order("ordem").order("criado_em",{ascending:false})),
        loadOne("custos", () => db.from("produto_financeiro").select("*").eq("loja_id",state.loja.id)),
        loadOne("pedidos", async () => { const r=await db.from("pedidos").select(ORDER_SELECT).eq("loja_id",state.loja.id).order("criado_em",{ascending:false}); if(!r.error) r.data=(r.data||[]).map(normalizeOrder); return r; }),
        loadOne("clientes", () => db.rpc("go_burger_clientes_loja_v10",{p_loja_id:state.loja.id})),
        loadOne("cupons", () => db.from("cupons").select("*").eq("loja_id",state.loja.id).order("criado_em",{ascending:false})),
        loadOne("grupos", () => db.from("grupos_adicionais").select("*").eq("loja_id",state.loja.id).order("ordem")),
        loadOne("opcoes", () => db.from("grupo_adicional_opcoes").select("*").eq("loja_id",state.loja.id).order("ordem")),
        loadOne("produtoGrupos", () => db.from("produto_grupos").select("*").eq("loja_id",state.loja.id)),
        loadOne("ingredientes", () => db.from("produto_ingredientes").select("*").eq("loja_id",state.loja.id).order("ordem")),
        loadOne("bairros", () => db.from("bairros_entrega").select("*").eq("loja_id",state.loja.id).order("ordem")),
        loadOne("horarios", () => db.from("horarios_funcionamento").select("*").eq("loja_id",state.loja.id).order("dia_semana")),
        loadOne("banners", () => db.from("banners").select("*").eq("loja_id",state.loja.id).order("ordem")),
        loadOne("upsells", () => db.from("ofertas_upsell").select("*").eq("loja_id",state.loja.id).order("ordem")),
        loadOne("recompensas", () => db.from("fidelidade_recompensas").select("*").eq("loja_id",state.loja.id).order("pontos_necessarios")),
        loadOne("fidelidade", () => db.from("fidelidade_movimentos").select("*").eq("loja_id",state.loja.id).order("criado_em",{ascending:false})),
        loadOne("resgates", () => db.from("fidelidade_resgates").select("*").eq("loja_id",state.loja.id).order("criado_em",{ascending:false})),
        loadOne("avaliacoes", () => db.from("avaliacoes").select("*").eq("loja_id",state.loja.id).order("criado_em",{ascending:false})),
        loadOne("estoqueMov", () => db.from("estoque_movimentos").select("*").eq("loja_id",state.loja.id).order("criado_em",{ascending:false}).limit(100)),
        loadOne("notificacoes", () => db.from("notificacoes").select("*").eq("loja_id",state.loja.id).in("audiencia",["admin","todos"]).order("criado_em",{ascending:false}).limit(100)),
        loadOne("logs", () => db.from("admin_logs").select("*").eq("loja_id",state.loja.id).order("criado_em",{ascending:false}).limit(60)),
        loadOne("platformControl", () => db.from("loja_controle_plataforma").select("*").eq("loja_id",state.loja.id).maybeSingle(), {}),
        loadOne("planPortal", () => db.rpc("go_burger_planos_portal_v700",{p_loja_id:state.loja.id,p_faturamento_mensal:state.planRevenueEstimate||0}), {}),
        loadOne("equipe", () => db.rpc("go_burger_equipe_listar_v10",{p_loja_id:state.loja.id})),
        loadOne("marketplaceCategorias", () => db.from("plataforma_categorias").select("*").eq("ativo",true).order("ordem")),
        loadOne("lojaCategorias", () => db.from("loja_categorias").select("categoria_id,destaque").eq("loja_id",state.loja.id)),
        loadOne("entregadores", () => db.from("entregadores").select("*").eq("loja_id",state.loja.id).order("nome")),
        loadOne("pedidoEntregas", () => db.from("pedido_entregas").select("*").eq("loja_id",state.loja.id).order("atualizado_em",{ascending:false}).limit(100)),
        loadOne("driverInvites", () => db.rpc("go_burger_loja_convites_entregador_v45",{p_loja_id:state.loja.id})),
        loadConfig()
      ]);
      renderAll();
      if (!silent) toast("Painel atualizado.");
    } finally { state.loading=false; }
  }

  async function loadConfig(){
    try { if(!state.loja?.id)throw new Error("Nenhuma hamburgueria selecionada."); const {data,error}=await db.from("configuracoes").select("*").eq("loja_id",state.loja.id).maybeSingle(); if(error)throw error; state.config=data||{loja_id:state.loja.id,nome:state.loja.nome||"Hamburgueria",taxa_entrega:0,pedido_minimo:0,tempo_estimado_min:30,tempo_estimado_max:50,loja_modo:"automatico"}; state.health.config={ok:true,detail:"Configuração carregada"}; }
    catch(e){ state.health.config={ok:false,detail:e.message}; }
  }

  function normalizeItem(item={}) {
    const quantidade=Math.max(1,asNumber(item.quantidade ?? item.qtd,1));
    const preco=asNumber(item.preco ?? item.preco_unitario ?? item.valor_unitario,0);
    const opcoes=Array.isArray(item.pedido_item_opcoes)?item.pedido_item_opcoes:[];
    const removidos=Array.isArray(item.pedido_item_removidos)?item.pedido_item_removidos:[];
    return {...item,nome:String(item.nome ?? item.nome_produto ?? item.produto_nome ?? "Produto"),preco,quantidade,subtotal:asNumber(item.subtotal ?? item.total_item,preco*quantidade),pedido_item_opcoes:opcoes,pedido_item_removidos:removidos};
  }
  function normalizeOrder(order={}) { return {...order,pedido_itens:Array.isArray(order.pedido_itens)?order.pedido_itens.map(normalizeItem):[],forma_pagamento:order.forma_pagamento||order.pagamento||"Não informado",pagamento_status:order.pagamento_status||"Pendente",tipo_entrega:order.tipo_entrega||"Entrega"}; }
  function orderItems(order){ return (order.pedido_itens||[]).reduce((n,x)=>n+asNumber(x.quantidade),0); }
  function paymentText(order){ if(order.forma_pagamento==="Cartão")return `Cartão${order.cartao_tipo?` (${order.cartao_tipo})`:""}`; if(order.forma_pagamento==="Dinheiro"&&order.troco_para)return `Dinheiro · troco ${money(order.troco_para)}`; return order.forma_pagamento||"-"; }
  function productStatus(p){ if(p.ativo===false)return "Desativado"; if(asNumber(p.estoque)<=0)return "Indisponível"; return p.status||"Disponível"; }
  function productCost(id){ return asNumber(state.custos.find(x=>Number(x.produto_id)===Number(id))?.custo_unitario); }
  function productName(id){ return state.produtos.find(x=>Number(x.id)===Number(id))?.nome||"Produto"; }
  function profileName(id){ return state.clientes.find(x=>x.id===id)?.nome||"Cliente"; }

  async function uploadImage(file, folder="produtos") {
    if (!file) return null;
    if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) throw new Error("Use uma imagem JPG, PNG ou WEBP.");
    if (file.size > 5*1024*1024) throw new Error("A imagem deve ter no máximo 5 MB.");
    const ext=(file.name.split(".").pop()||"jpg").toLowerCase().replace(/[^a-z0-9]/g,"");
    if (!state.loja?.id) throw new Error("Nenhuma hamburgueria selecionada.");
    const path=`lojas/${state.loja.id}/${String(folder||"produtos").replace(/[^a-z0-9_-]/gi,"-")}/${Date.now()}-${crypto.randomUUID?.()||Math.random().toString(36).slice(2)}.${ext}`;
    const {error}=await db.storage.from(STORAGE_BUCKET).upload(path,file,{cacheControl:"3600",upsert:false}); if(error)throw error;
    const {data}=db.storage.from(STORAGE_BUCKET).getPublicUrl(path); return {path,url:data.publicUrl};
  }
  async function removeImage(path){ if(!path)return; try{await db.storage.from(STORAGE_BUCKET).remove([path]);}catch{} }

  function updateProductSelects(){
    const options='<option value="">Selecione...</option>'+state.produtos.filter(p=>p.ativo!==false).map(p=>`<option value="${p.id}">${html(p.nome)}</option>`).join("");
    ["#bannerProdutoSelect","#upsellGatilhoSelect","#upsellProdutoSelect","#cupomProdutoSelect","#recompensaProdutoSelect"].forEach(s=>{const el=$(s);if(el){const old=el.value;el.innerHTML=options;if([...el.options].some(o=>o.value===old))el.value=old;}});
  }

  function filteredProducts(){
    const q=String($("#pesquisaProduto")?.value||"").trim().toLowerCase(), cat=$("#filtroCategoria")?.value||"", status=$("#filtroStatusProduto")?.value||"", featured=$("#filtroDestaqueProduto")?.value||"";
    return state.produtos.filter(p=>{const text=`${p.nome||""} ${p.categoria||""} ${p.descricao||""}`.toLowerCase(); return (!q||text.includes(q))&&(!cat||p.categoria===cat)&&(!status||productStatus(p)===status)&&(!featured||(featured==="destaque"?p.destaque:featured==="novidade"?p.novidade:true));});
  }
  function renderProducts(){
    const body=$("#tabelaProdutos"); if(!body)return;
    const cats=[...new Set(state.produtos.map(x=>x.categoria).filter(Boolean))].sort(), select=$("#filtroCategoria");
    if(select){const old=select.value;select.innerHTML='<option value="">Todas as categorias</option>'+cats.map(x=>`<option>${html(x)}</option>`).join("");select.value=cats.includes(old)?old:"";}
    const list=filteredProducts();
    body.innerHTML=list.length?list.map(p=>{
      const exibicao=[p.destaque?'<span class="status ativo">Destaque</span>':'',p.novidade?'<span class="status ativo">Novidade</span>':''].filter(Boolean).join(' ')||'<span class="muted">Padrão</span>';
      return `<tr><td><div class="product-cell"><img src="${html(p.imagem||"../assets/placeholder-burger.svg")}" data-fallback-src="../assets/placeholder-burger.svg"><div><strong>${html(p.nome)}</strong><small>${html(p.descricao||"Sem descrição")}</small></div></div></td><td>${html(p.categoria||"-")}</td><td><strong>${money(p.preco)}</strong><small>Custo ${money(productCost(p.id))}</small></td><td>${asNumber(p.estoque)} <small>mín. ${asNumber(p.estoque_minimo,5)}</small></td><td>${exibicao}</td><td><span class="status ${slug(productStatus(p))}">${html(productStatus(p))}</span></td><td><div class="table-actions"><button class="action-btn" data-edit-product="${p.id}" title="Editar"><i class="fa-solid fa-pen"></i></button><button class="action-btn" data-custom-product="${p.id}" title="Personalizar"><i class="fa-solid fa-list-check"></i></button><button class="action-btn" data-stock-product="${p.id}" title="Estoque"><i class="fa-solid fa-boxes-stacked"></i></button><button class="action-btn ${p.ativo===false?"":"danger"}" data-toggle-product="${p.id}" title="${p.ativo===false?"Reativar":"Desativar"}"><i class="fa-solid ${p.ativo===false?"fa-rotate-left":"fa-power-off"}"></i></button></div></td></tr>`;
    }).join(""): `<tr><td colspan="7">${empty("fa-burger","Nenhum produto","Cadastre ou ajuste os filtros.")}</td></tr>`;
  }

  function newProduct(){ const f=$("#formProduto"); f.reset(); delete f.dataset.id; f.elements.estoque.value=0;f.elements.estoque_minimo.value=5;f.elements.custo_unitario.value=0;f.elements.ordem.value=0;f.elements.status.value="Disponível";f.elements.ativo.checked=true; $("#produtoImagemPreview").src="../assets/placeholder-burger.svg"; $("#modalProdutoTitulo").textContent="Novo produto"; openModal("modalProduto"); }
  function editProduct(id){ const p=state.produtos.find(x=>Number(x.id)===Number(id));if(!p)return;const f=$("#formProduto");f.dataset.id=p.id;["nome","categoria","preco","estoque","estoque_minimo","ordem","status","descricao","imagem","imagem_path"].forEach(k=>{if(f.elements[k])f.elements[k].value=p[k]??"";});f.elements.custo_unitario.value=productCost(p.id);f.elements.destaque.checked=!!p.destaque;f.elements.novidade.checked=!!p.novidade;f.elements.ativo.checked=p.ativo!==false;$("#produtoImagemPreview").src=p.imagem||"../assets/placeholder-burger.svg";$("#modalProdutoTitulo").textContent="Editar produto";openModal("modalProduto"); }
  async function saveProduct(event){
    event.preventDefault();const f=event.currentTarget,b=f.querySelector('[type="submit"]'),id=f.dataset.id; setButton(b,true,"Salvando...");
    let uploaded=null, oldPath=id?state.produtos.find(x=>Number(x.id)===Number(id))?.imagem_path:null;
    try{
      const file=$("#produtoImagemArquivo")?.files?.[0];if(file)uploaded=await uploadImage(file,"produtos");
      const stock=Math.max(0,Math.trunc(asNumber(f.elements.estoque.value))), payload={loja_id:state.loja.id,nome:String(f.elements.nome.value).trim(),categoria:String(f.elements.categoria.value).trim(),preco:asNumber(f.elements.preco.value),estoque:stock,estoque_minimo:Math.max(0,Math.trunc(asNumber(f.elements.estoque_minimo.value,5))),ordem:Math.trunc(asNumber(f.elements.ordem.value)),status:stock>0?f.elements.status.value:"Indisponível",destaque:f.elements.destaque.checked,novidade:f.elements.novidade.checked,ativo:f.elements.ativo.checked,descricao:String(f.elements.descricao.value||"").trim()||null,imagem:uploaded?.url||String(f.elements.imagem.value||"").trim()||null,imagem_path:uploaded?.path||String(f.elements.imagem_path.value||"").trim()||null,atualizado_em:new Date().toISOString()};
      if(!payload.nome||!payload.categoria||payload.preco<0)throw new Error("Preencha nome, categoria e preço corretamente.");
      let saved;
      if(id){const r=await db.from("produtos").update(payload).eq("id",Number(id)).select().single();if(r.error)throw r.error;saved=r.data;}else{const r=await db.from("produtos").insert(payload).select().single();if(r.error)throw r.error;saved=r.data;}
      const cost=Math.max(0,asNumber(f.elements.custo_unitario.value));const cr=await db.from("produto_financeiro").upsert({loja_id:state.loja.id,produto_id:saved.id,custo_unitario:cost,atualizado_em:new Date().toISOString()});if(cr.error)throw cr.error;
      if(uploaded&&oldPath&&oldPath!==uploaded.path)await removeImage(oldPath); await logAdmin(id?"Produto atualizado":"Produto criado","produto",saved.id,{nome:saved.nome}); closeModal("modalProduto"); await Promise.all([loadOne("produtos",()=>db.from("produtos").select("*").eq("loja_id",state.loja.id).order("ordem")),loadOne("custos",()=>db.from("produto_financeiro").select("*").eq("loja_id",state.loja.id))]);renderAll();toast(id?"Produto atualizado.":"Produto criado.");
    }catch(e){if(uploaded?.path)await removeImage(uploaded.path);toast(e.message,"error");}finally{setButton(b,false);if($("#produtoImagemArquivo"))$("#produtoImagemArquivo").value="";}
  }
  async function toggleProduct(id){const p=state.produtos.find(x=>Number(x.id)===Number(id));if(!p)return;const active=p.ativo===false; if(!active&&!confirm(`Desativar ${p.nome}?`))return;const {error}=await db.from("produtos").update({ativo:active,status:active&&asNumber(p.estoque)>0?"Disponível":"Indisponível",atualizado_em:new Date().toISOString()}).eq("id",p.id);if(error)return toast(error.message,"error");await logAdmin(active?"Produto reativado":"Produto desativado","produto",p.id,{nome:p.nome});await loadOne("produtos",()=>db.from("produtos").select("*").eq("loja_id",state.loja.id).order("ordem"));renderAll();toast(active?"Produto reativado.":"Produto desativado.");}

  function filteredOrders(){
    const q=String($("#pesquisaPedido")?.value||"").trim().toLowerCase(), st=$("#filtroStatusPedido")?.value||"", pay=$("#filtroPagamentoPedido")?.value||"", type=$("#filtroTipoEntregaPedido")?.value||"", period=$("#filtroPeriodoPedido")?.value||"";
    return state.pedidos.filter(o=>{const text=`${o.id} ${o.cliente_nome||""} ${o.telefone||""}`.toLowerCase();let periodOk=true;if(period&&o.criado_em){const d=new Date(o.criado_em),start=new Date();start.setHours(0,0,0,0);if(period==="hoje")periodOk=d>=start;if(period==="7"){start.setDate(start.getDate()-6);periodOk=d>=start;}if(period==="30"){start.setDate(start.getDate()-29);periodOk=d>=start;}}return(!q||text.includes(q))&&(!st||o.status===st)&&(!pay||o.forma_pagamento===pay)&&(!type||o.tipo_entrega===type)&&periodOk;});
  }
  function renderOrders(){
    const body=$("#tabelaPedidos");if(!body)return;const list=filteredOrders();
    body.innerHTML=list.length?list.map(o=>{const n=o.numero_loja||o.id,p=o.prioridade||"normal",flag=p==="normal"?"":`<span class="priority-flag ${slug(p)}">${html(p)}</span>`;return `<tr><td><strong>#${n}</strong><small>ID ${o.id} · ${orderItems(o)} item(ns)</small>${flag}</td><td><div class="client-cell"><span class="client-avatar">${initials(o.cliente_nome)}</span><div><strong>${html(o.cliente_nome||"Cliente")}</strong><small>${html(o.telefone||"-")}</small></div></div></td><td><strong>${html(o.tipo_entrega||"Entrega")}</strong>${o.bairro_nome?`<small>${html(o.bairro_nome)}</small>`:""}</td><td><strong>${money(o.total)}</strong></td><td><strong>${html(paymentText(o))}</strong><small>${html(o.pagamento_status||"-")}</small></td><td>${dateTime(o.criado_em)}</td><td><span class="status ${slug(o.status)}">${html(o.status||"-")}</span></td><td><div class="table-actions"><button class="action-btn" data-order-details="${o.id}"><i class="fa-solid fa-eye"></i></button><button class="action-btn" data-print-order="${o.id}"><i class="fa-solid fa-print"></i></button><select class="priority-select" data-order-priority="${o.id}">${["normal","alta","urgente"].map(x=>`<option value="${x}" ${x===p?"selected":""}>${x}</option>`).join("")}</select><select class="status-select" data-order-status="${o.id}" ${o.status==="Cancelado"?"disabled":""}>${["Recebido","Em preparo","Pronto","Saiu para entrega","Concluído","Cancelado"].map(s=>`<option ${s===o.status?"selected":""}>${s}</option>`).join("")}</select></div></td></tr>`;}).join(""):`<tr><td colspan="8">${empty("fa-receipt","Nenhum pedido","Não há pedidos neste filtro.")}</td></tr>`;
  }

  async function updateOrderPriority(id,priority,control=null){
    const o=state.pedidos.find(x=>Number(x.id)===Number(id));if(!o)return;const old=o.prioridade||"normal";
    const {error}=await db.rpc("go_burger_definir_prioridade_pedido_v1",{p_loja_id:state.loja.id,p_pedido_id:Number(id),p_prioridade:priority});
    if(error){if(control)control.value=old;return toast(error.message,"error");}
    o.prioridade=priority;renderOrders();renderOperation();toast(`Prioridade do pedido #${o.numero_loja||o.id}: ${priority}.`,"info");
  }

  async function updateOrderStatus(id,status,control=null){const o=state.pedidos.find(x=>Number(x.id)===Number(id));if(!o)return;const old=o.status;if(status==="Cancelado"&&old!=="Cancelado"&&!confirm(`Cancelar o pedido #${id}? O estoque será devolvido pelo banco.`)){if(control)control.value=old;return;}const {error}=await db.rpc("go_burger_atualizar_pedido_operacao_v10",{p_loja_id:state.loja.id,p_pedido_id:Number(id),p_status:status,p_pagamento_status:null});if(error){if(control)control.value=old;return toast(error.message,"error");}await Promise.all([loadOne("pedidos",async()=>{const r=await db.from("pedidos").select(ORDER_SELECT).eq("loja_id",state.loja.id).order("criado_em",{ascending:false});if(!r.error)r.data=(r.data||[]).map(normalizeOrder);return r;}),loadOne("produtos",()=>db.from("produtos").select("*").eq("loja_id",state.loja.id).order("ordem")),loadOne("estoqueMov",()=>db.from("estoque_movimentos").select("*").eq("loja_id",state.loja.id).order("criado_em",{ascending:false}).limit(100))]);renderAll();toast(`Pedido #${id}: ${status}.`);}
  async function updatePayment(id,status){const {error}=await db.rpc("go_burger_atualizar_pedido_operacao_v10",{p_loja_id:state.loja.id,p_pedido_id:Number(id),p_status:null,p_pagamento_status:status});if(error)return toast(error.message,"error");await loadOne("pedidos",async()=>{const r=await db.from("pedidos").select(ORDER_SELECT).eq("loja_id",state.loja.id).order("criado_em",{ascending:false});if(!r.error)r.data=(r.data||[]).map(normalizeOrder);return r;});renderAll();openOrder(id);toast("Pagamento atualizado.");}

  function orderSummary(o){const items=o.pedido_itens||[];return items.length?items.slice(0,3).map(i=>`${i.quantidade}x ${i.nome}`).join(" · ")+(items.length>3?` · +${items.length-3}`:""):"Itens não carregados";}
  function nextStatus(status){return ({"Recebido":"Em preparo","Em preparo":"Pronto","Pronto":"Saiu para entrega","Saiu para entrega":"Concluído"})[status]||null;}
  function renderOperation(){
    const wrap=$("#operationBoard");
    if(!wrap)return;

    const cols=[
      ["Recebido","Recebidos","fa-bell"],
      ["Em preparo","Em preparo","fa-fire-burner"],
      ["Pronto","Prontos","fa-circle-check"],
      ["Saiu para entrega","Em entrega","fa-motorcycle"]
    ];

    wrap.innerHTML=cols.map(([status,title,icon])=>{
      const list=state.pedidos.filter(o=>o.status===status);

      return `<section class="operation-column">
        <div class="operation-column-head">
          <div><span class="icon"><i class="fa-solid ${icon}"></i></span><strong>${title}</strong></div>
          <b>${list.length}</b>
        </div>

        <div class="operation-list">
          ${list.length?list.map(o=>{
            const startValue=
              status==="Em preparo"
                ?(o.em_preparo_em||o.criado_em)
                :status==="Pronto"
                  ?(o.pronto_em||o.em_preparo_em||o.criado_em)
                  :status==="Saiu para entrega"
                    ?(o.saiu_entrega_em||o.pronto_em||o.criado_em)
                    :o.criado_em;

            const mins=Math.max(
              0,
              Math.round((Date.now()-new Date(startValue).getTime())/60000)
            );

            const late=
              status==="Em preparo" &&
              mins>asNumber(state.config.tempo_estimado_max,50);

            const timerLabel=
              status==="Em preparo"
                ?`${mins} min preparo`
                :status==="Pronto"
                  ?`${mins} min pronto`
                  :status==="Saiu para entrega"
                    ?`${mins} min rota`
                    :`${mins} min espera`;

            return `<article class="operation-card ${late?"late":""}">
              <div class="operation-card-head">
                <strong>#${o.numero_loja||o.id}</strong>
                <time>${timerLabel}</time>
              </div>
              <div class="client">${html(o.cliente_nome||"Cliente")}</div>
              <div class="summary">${html(orderSummary(o))}</div>
              ${o.observacao?`<div class="order-note"><i class="fa-solid fa-note-sticky"></i>${html(o.observacao)}</div>`:""}
              <div class="total">${money(o.total)}</div>
              <div class="operation-card-actions">
                <button class="btn primary" data-next-order="${o.id}">
                  ${nextStatus(o.status)?`Avançar: ${nextStatus(o.status)}`:"Concluído"}
                </button>
                <button class="action-btn" data-order-details="${o.id}">
                  <i class="fa-solid fa-eye"></i>
                </button>
              </div>
            </article>`;
          }).join(""):empty("fa-circle-check","Fila limpa","Nenhum pedido nesta etapa.")}
        </div>
      </section>`;
    }).join("");
  }

  function orderItemDetails(item){
    const legacy=item.personalizacao_json||{};const extras=[];
    const opcoes=Array.isArray(item.pedido_item_opcoes)&&item.pedido_item_opcoes.length?item.pedido_item_opcoes:(Array.isArray(legacy.opcoes)?legacy.opcoes:[]);
    const removidos=Array.isArray(item.pedido_item_removidos)&&item.pedido_item_removidos.length?item.pedido_item_removidos:(Array.isArray(legacy.removidos)?legacy.removidos:[]);
    opcoes.forEach(x=>extras.push(`${x.nome||x.opcao_nome||"Opção"}${asNumber(x.preco_adicional)>0?` (+${money(x.preco_adicional)})`:""}`));
    if(removidos.length)extras.push(`Sem: ${removidos.map(x=>typeof x==="string"?x:(x.nome||x.ingrediente_nome||"Ingrediente")).join(", ")}`);
    if(item.observacao)extras.push(`Obs.: ${item.observacao}`);return extras.join(" · ");
  }
  function openOrder(id){
    const o=state.pedidos.find(x=>Number(x.id)===Number(id));if(!o)return;$("#modalPedidoTitulo").textContent=`Pedido #${o.numero_loja||o.id}`;
    $("#modalPedidoConteudo").innerHTML=`<div class="order-detail-grid"><div class="detail-box"><span>Cliente</span><strong>${html(o.cliente_nome||"Cliente")}</strong><small>${html(o.telefone||"-")}</small></div><div class="detail-box"><span>Entrega</span><strong>${html(o.tipo_entrega||"Entrega")}</strong><small>${html(o.endereco||"-")}</small></div><div class="detail-box"><span>Pagamento</span><strong>${html(paymentText(o))}</strong><small>${html(o.pagamento_status||"-")}</small></div><div class="detail-box"><span>Horário</span><strong>${dateTime(o.criado_em)}</strong><small>${o.agendado_para?`Agendado: ${dateTime(o.agendado_para)}`:"Imediato"}</small></div></div>${o.observacao?`<div class="notice warning"><i class="fa-solid fa-note-sticky"></i><div><strong>Observação do pedido</strong><p>${html(o.observacao)}</p></div></div>`:""}<div class="order-detail-items">${(o.pedido_itens||[]).map(i=>`<div class="order-detail-item"><div><strong>${i.quantidade}x ${html(i.nome)}</strong>${orderItemDetails(i)?`<small>${html(orderItemDetails(i))}</small>`:""}</div><strong>${money(i.subtotal)}</strong></div>`).join("")||empty("fa-burger","Sem itens","Os itens não foram retornados pelo banco.")}</div><div class="order-totals"><div><span>Subtotal</span><strong>${money(o.subtotal)}</strong></div><div><span>Desconto</span><strong>- ${money(o.desconto)}</strong></div><div><span>Entrega</span><strong>${money(o.taxa_entrega)}</strong></div><div class="grand"><span>Total</span><strong>${money(o.total)}</strong></div></div><div class="order-controls"><select id="modalOrderStatus">${["Recebido","Em preparo","Pronto","Saiu para entrega","Concluído","Cancelado"].map(s=>`<option ${s===o.status?"selected":""}>${s}</option>`).join("")}</select><select id="modalPaymentStatus">${["Pendente","Na entrega","Pago","Cancelado","Estornado"].map(s=>`<option ${s===o.pagamento_status?"selected":""}>${s}</option>`).join("")}</select><button class="btn secondary" data-print-order="${o.id}"><i class="fa-solid fa-print"></i> Imprimir</button><button class="btn primary" data-save-order="${o.id}"><i class="fa-solid fa-floppy-disk"></i> Salvar</button></div>`;openModal("modalPedido");
  }

  let printerSerialPort = null;

  function printerMode(){ return localStorage.getItem("go_burger_printer_mode") || "browser"; }
  function printerBaud(){ return Math.max(1200, Number(localStorage.getItem("go_burger_printer_baud") || 9600)); }
  function printerChars(){ return (localStorage.getItem("go_burger_printer_width") || "80") === "58" ? 32 : 48; }
  function printerAscii(value){ return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7E\n]/g, ""); }
  function printerLine(left="",right=""){
    const width=printerChars(),a=printerAscii(left),b=printerAscii(right),space=Math.max(1,width-a.length-b.length);
    return a.length+b.length+1>width ? `${a}\n${b.slice(0,width).padStart(width," ")}` : `${a}${" ".repeat(space)}${b}`;
  }
  function printerWrap(text=""){
    const width=printerChars(),words=printerAscii(text).split(/\s+/).filter(Boolean),lines=[];let line="";
    for(const word of words){if(!line)line=word;else if((line+" "+word).length<=width)line+=" "+word;else{lines.push(line.slice(0,width));line=word}}
    if(line)lines.push(line.slice(0,width));return lines.join("\n");
  }
  function escposReceipt(order){
    const enc=new TextEncoder(),width=printerChars(),sep="-".repeat(width),number=order.numero_loja||order.id;
    const lines=[];
    lines.push(printerAscii(state.config.nome||state.loja?.nome||"Go-burger"));
    lines.push(`PEDIDO #${number}`);lines.push(printerAscii(dateTime(order.criado_em)));lines.push(sep);
    lines.push(printerWrap(order.cliente_nome||"Cliente"));lines.push(printerWrap(order.telefone||"Sem telefone"));
    lines.push(printerWrap(order.tipo_entrega||"Entrega"));lines.push(printerWrap(order.endereco||"Retirada na loja"));
    if(order.bairro_nome)lines.push(printerWrap(order.bairro_nome));if(order.agendado_para)lines.push(`AGENDADO: ${printerAscii(dateTime(order.agendado_para))}`);lines.push(sep);
    for(const item of order.pedido_itens||[]){lines.push(printerLine(`${item.quantidade}x ${item.nome||item.nome_produto||"Produto"}`,money(item.subtotal)));const details=orderItemDetails(item);if(details)lines.push(printerWrap(details));}
    if(order.observacao){lines.push(sep);lines.push("OBSERVACAO:");lines.push(printerWrap(order.observacao));}
    lines.push(sep);lines.push(printerLine("Subtotal",money(order.subtotal)));if(asNumber(order.desconto)>0)lines.push(printerLine("Desconto",`- ${money(order.desconto)}`));lines.push(printerLine("Entrega",money(order.taxa_entrega)));lines.push(printerLine("TOTAL",money(order.total)));lines.push(sep);
    lines.push(printerWrap(`Pagamento: ${paymentText(order)}`));lines.push(printerWrap(`Status: ${order.status||"-"}`));if(order.troco_para)lines.push(printerWrap(`Troco para: ${money(order.troco_para)}`));lines.push("", "Go-burger", "", "");
    const init=Uint8Array.from([0x1b,0x40]),center=Uint8Array.from([0x1b,0x61,0x01]),left=Uint8Array.from([0x1b,0x61,0x00]),boldOn=Uint8Array.from([0x1b,0x45,0x01]),boldOff=Uint8Array.from([0x1b,0x45,0x00]),cut=Uint8Array.from([0x1d,0x56,0x00]);
    const chunks=[init,center,boldOn,enc.encode(lines.slice(0,2).join("\n")+"\n"),boldOff,left,enc.encode(lines.slice(2).join("\n")+"\n"),cut];
    const total=chunks.reduce((n,x)=>n+x.length,0),out=new Uint8Array(total);let at=0;for(const c of chunks){out.set(c,at);at+=c.length}return out;
  }
  async function getSerialPrinter(interactive=false){
    if(!("serial" in navigator))throw new Error("Web Serial não é suportado neste navegador. Use Chrome/Edge ou o modo Navegador.");
    if(printerSerialPort?.writable)return printerSerialPort;
    const ports=await navigator.serial.getPorts();printerSerialPort=ports[0]||null;
    if(!printerSerialPort&&interactive)printerSerialPort=await navigator.serial.requestPort();
    if(!printerSerialPort)throw new Error("Nenhuma impressora Serial autorizada. Clique em Conectar impressora.");
    if(!printerSerialPort.writable)await printerSerialPort.open({baudRate:printerBaud(),bufferSize:8192});
    return printerSerialPort;
  }
  async function connectSerialPrinter(){
    try{printerSerialPort=await getSerialPrinter(true);toast("Impressora Serial conectada.");}
    catch(error){if(error?.name!=="NotFoundError")toast(error.message||"Não foi possível conectar a impressora.","error")}
  }
  async function printEscPos(order){
    const port=await getSerialPrinter(false),writer=port.writable.getWriter();
    try{await writer.write(escposReceipt(order));}finally{writer.releaseLock()}
  }

  async function printOrder(id,printType="manual"){
    let o=state.pedidos.find(x=>Number(x.id)===Number(id));

    if(!o){
      const {data,error}=await db
        .from("pedidos")
        .select(ORDER_SELECT)
        .eq("loja_id",state.loja.id)
        .eq("id",Number(id))
        .maybeSingle();

      if(error)return toast(error.message,"error");
      o=data||null;
      if(o)state.pedidos.unshift(o);
    }

    if(!o)return toast("Pedido não encontrado para impressão.","error");

    if(printerMode()==="serial"){
      try{
        await printEscPos(o);
        await db.rpc("go_burger_registrar_impressao_v1",{p_loja_id:state.loja.id,p_pedido_id:Number(id),p_tipo:printType==="automatico"?"automatico":(asNumber(o.impresso_total)>0?"reimpressao":"manual"),p_dispositivo:`Web Serial ESC/POS · ${navigator.userAgent.slice(0,90)}`});
        o.impresso_total=asNumber(o.impresso_total)+1;o.impresso_em=new Date().toISOString();toast("Pedido enviado diretamente para a impressora.");return;
      }catch(error){
        if(printType==="automatico"){console.warn("Impressão Serial automática",error.message);return;}
        toast(`${error.message} Abrindo impressão pelo navegador.`,"info");
      }
    }

    const number=o.numero_loja||o.id;

    const itemRows=(o.pedido_itens||[]).map(item=>`
      <div class="item">
        <div class="item-main">
          <strong>${item.quantidade}x ${html(item.nome||item.nome_produto||"Produto")}</strong>
          <b>${money(item.subtotal)}</b>
        </div>
        ${orderItemDetails(item)?`<small>${html(orderItemDetails(item))}</small>`:""}
      </div>
    `).join("");

    const printMarkup=`
      <!doctype html>
      <html lang="pt-BR">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <title>Pedido #${number}</title>
        <style>
          @page {
            size: ${localStorage.getItem("go_burger_printer_width")||"80"}mm auto;
            margin: 0;
          }

          * {
            box-sizing: border-box;
          }

          html,
          body {
            width: ${localStorage.getItem("go_burger_printer_width")||"80"}mm;
            max-width: ${localStorage.getItem("go_burger_printer_width")||"80"}mm;
            margin: 0;
            padding: 0;
            background: #fff;
            color: #000;
            font-family: Arial, Helvetica, sans-serif;
          }

          body {
            padding: 4mm;
            font-size: 11px;
            line-height: 1.35;
          }

          h1 {
            margin: 0;
            font-size: 17px;
            text-align: center;
          }

          .subtitle {
            margin-top: 3px;
            text-align: center;
            font-size: 9px;
          }

          .divider {
            margin: 3mm 0;
            border-top: 1px dashed #000;
          }

          .box {
            padding: 2.5mm 0;
          }

          .box strong,
          .box span,
          .box small {
            display: block;
          }

          .box small {
            margin-top: 1mm;
          }

          .item {
            padding: 2.4mm 0;
            border-bottom: 1px dashed #bbb;
          }

          .item-main,
          .summary-row {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 3mm;
          }

          .item-main strong {
            flex: 1;
          }

          .item small {
            display: block;
            margin-top: 1mm;
            color: #333;
          }

          .summary {
            margin-top: 3mm;
          }

          .summary-row {
            padding: .8mm 0;
          }

          .summary-row.total {
            margin-top: 1.5mm;
            padding-top: 2mm;
            border-top: 2px solid #000;
            font-size: 16px;
            font-weight: 800;
          }

          .attention {
            margin-top: 3mm;
            padding: 2mm;
            border: 1px solid #000;
            font-weight: 700;
          }

          .footer {
            margin-top: 4mm;
            text-align: center;
            font-size: 9px;
          }

          @media print {
            body {
              width: ${localStorage.getItem("go_burger_printer_width")||"80"}mm;
              max-width: ${localStorage.getItem("go_burger_printer_width")||"80"}mm;
            }
          }
        </style>
      </head>
      <body>
        <h1>${html(state.config.nome||state.loja?.nome||"Go-burger")}</h1>
        <div class="subtitle">Pedido #${html(number)} · ${html(dateTime(o.criado_em))}</div>

        <div class="divider"></div>

        <div class="box">
          <strong>${html(o.cliente_nome||"Cliente")}</strong>
          <span>${html(o.telefone||"Sem telefone")}</span>
          <span>${html(o.tipo_entrega||"Entrega")}</span>
          <span>${html(o.endereco||"Retirada na loja")}</span>
          ${o.bairro_nome?`<span>${html(o.bairro_nome)}</span>`:""}
          ${o.agendado_para?`<small>Agendado: ${html(dateTime(o.agendado_para))}</small>`:""}
        </div>

        <div class="divider"></div>

        ${itemRows}

        ${o.observacao?`<div class="attention">OBS.: ${html(o.observacao)}</div>`:""}

        <div class="summary">
          <div class="summary-row"><span>Subtotal</span><strong>${money(o.subtotal)}</strong></div>
          ${asNumber(o.desconto)>0?`<div class="summary-row"><span>Desconto</span><strong>- ${money(o.desconto)}</strong></div>`:""}
          <div class="summary-row"><span>Entrega</span><strong>${money(o.taxa_entrega)}</strong></div>
          <div class="summary-row total"><span>TOTAL</span><strong>${money(o.total)}</strong></div>
        </div>

        <div class="divider"></div>

        <div class="box">
          <strong>Pagamento: ${html(paymentText(o))}</strong>
          <span>Status do pagamento: ${html(o.pagamento_status||"—")}</span>
          ${o.troco_para?`<span>Troco para: ${money(o.troco_para)}</span>`:""}
          <span>Status do pedido: ${html(o.status||"—")}</span>
          ${o.prioridade&&o.prioridade!=="normal"?`<strong>PRIORIDADE: ${html(String(o.prioridade).toUpperCase())}</strong>`:""}
        </div>

        <div class="footer">Go-burger · impressão ${html(printType)}</div>

      </body>
      </html>
    `;

    const printBlob=new Blob([printMarkup],{type:"text/html;charset=utf-8"});
    const printUrl=URL.createObjectURL(printBlob);
    const w=open(printUrl,"_blank","width=430,height=760");
    if(!w){URL.revokeObjectURL(printUrl);return toast("O navegador bloqueou a janela de impressão.","error");}
    const releasePrintUrl=()=>setTimeout(()=>URL.revokeObjectURL(printUrl),5000);
    try{
      w.addEventListener("load",()=>{setTimeout(()=>{try{w.print()}catch(error){console.warn("impressão navegador",error)}releasePrintUrl()},120)},{once:true});
    }catch(error){console.warn("janela de impressão",error);releasePrintUrl()}

    try{
      await db.rpc("go_burger_registrar_impressao_v1",{
        p_loja_id:state.loja.id,
        p_pedido_id:Number(id),
        p_tipo:printType==="automatico"
          ?"automatico"
          :(asNumber(o.impresso_total)>0?"reimpressao":"manual"),
        p_dispositivo:navigator.userAgent.slice(0,120)
      });

      o.impresso_total=asNumber(o.impresso_total)+1;
      o.impresso_em=new Date().toISOString();
    }catch(error){
      console.warn("registro de impressão",error.message);
    }
  }

  function renderStock(){
    const grid=$("#estoqueGrid");if(!grid)return;const q=String($("#pesquisaEstoque")?.value||"").toLowerCase(),filter=$("#filtroEstoque")?.value||"";const active=state.produtos.filter(p=>p.ativo!==false),crit=active.filter(p=>asNumber(p.estoque)<=asNumber(p.estoque_minimo,5)),zero=active.filter(p=>asNumber(p.estoque)===0);
    $("#estoqueTotalSkus").textContent=active.length;$("#estoqueCriticos").textContent=crit.length;$("#estoqueZerados").textContent=zero.length;
    const list=state.produtos.filter(p=>{const n=asNumber(p.estoque),min=asNumber(p.estoque_minimo,5);return(!q||`${p.nome} ${p.categoria}`.toLowerCase().includes(q))&&(!filter||(filter==="critico"&&n<=min)||(filter==="zerado"&&n===0)||(filter==="ok"&&n>min));});
    grid.innerHTML=list.length?list.map(p=>`<article class="stock-card"><div class="stock-card-top"><img src="${html(p.imagem||"../assets/placeholder-burger.svg")}" data-fallback-src="../assets/placeholder-burger.svg"><div><strong>${html(p.nome)}</strong><small>Mínimo ${asNumber(p.estoque_minimo,5)}</small></div><span class="stock-number ${asNumber(p.estoque)<=asNumber(p.estoque_minimo,5)?"critical":""}">${asNumber(p.estoque)}</span></div><div class="stock-card-actions"><button data-stock-delta="-1" data-product-id="${p.id}">−1</button><button data-stock-delta="1" data-product-id="${p.id}">+1</button><button data-stock-delta="5" data-product-id="${p.id}">+5</button><button data-stock-product="${p.id}"><i class="fa-solid fa-pen"></i></button></div></article>`).join(""):empty("fa-box-open","Nada por aqui","Nenhum produto corresponde ao filtro.");
    const body=$("#tabelaEstoqueMovimentos");if(body)body.innerHTML=state.estoqueMov.slice(0,40).map(m=>{const delta=asNumber(m.delta??m.quantidade_delta),before=asNumber(m.quantidade_anterior??m.saldo_anterior),after=asNumber(m.quantidade_nova??m.saldo_novo),kind=delta<0?"Saída":"Entrada";return `<tr><td>${dateTime(m.criado_em)}</td><td>${html(productName(m.produto_id))}</td><td><span class="status ${delta>0?"disponivel":"indisponivel"}">${html(kind)} ${delta>0?"+":""}${delta}</span></td><td>${before}</td><td>${after}</td><td>${html(m.motivo||"-")}</td></tr>`;}).join("")||`<tr><td colspan="6">${empty("fa-clock-rotate-left","Sem histórico","Movimentações futuras aparecerão aqui.")}</td></tr>`;
  }
  function openStock(id){const p=state.produtos.find(x=>Number(x.id)===Number(id));if(!p)return;const f=$("#formEstoque");f.dataset.id=p.id;f.elements.estoque.value=asNumber(p.estoque);f.elements.estoque_minimo.value=asNumber(p.estoque_minimo,5);f.elements.motivo.value="Ajuste manual";$("#modalEstoqueTitulo").textContent=`Estoque · ${p.nome}`;openModal("modalEstoque");}
  async function saveStock(event){event.preventDefault();const f=event.currentTarget,b=f.querySelector('[type="submit"]'),id=Number(f.dataset.id),qty=Math.max(0,Math.trunc(asNumber(f.elements.estoque.value))),min=Math.max(0,Math.trunc(asNumber(f.elements.estoque_minimo.value,5))),reason=String(f.elements.motivo.value||"Ajuste manual").trim();setButton(b,true,"Ajustando...");try{const u=await db.from("produtos").update({estoque:qty,estoque_minimo:min,status:qty>0?"Disponível":"Indisponível",atualizado_em:new Date().toISOString()}).eq("id",id);if(u.error)throw u.error;await logAdmin("Estoque ajustado","produto",id,{novo_estoque:qty,motivo:reason});closeModal("modalEstoque");await Promise.all([loadOne("produtos",()=>db.from("produtos").select("*").eq("loja_id",state.loja.id).order("ordem")),loadOne("estoqueMov",()=>db.from("estoque_movimentos").select("*").eq("loja_id",state.loja.id).order("criado_em",{ascending:false}).limit(100))]);renderAll();toast("Estoque atualizado.");}catch(e){toast(e.message,"error");}finally{setButton(b,false);}}
  async function quickStock(id,delta){const p=state.produtos.find(x=>Number(x.id)===Number(id));if(!p)return;const next=Math.max(0,Math.trunc(asNumber(p.estoque)+Number(delta)));const r=await db.from("produtos").update({estoque:next,status:next>0?"Disponível":"Indisponível",atualizado_em:new Date().toISOString()}).eq("id",Number(id));if(r.error)return toast(r.error.message,"error");await logAdmin("Ajuste rápido de estoque","produto",id,{delta:Number(delta),novo_estoque:next});await Promise.all([loadOne("produtos",()=>db.from("produtos").select("*").eq("loja_id",state.loja.id).order("ordem")),loadOne("estoqueMov",()=>db.from("estoque_movimentos").select("*").eq("loja_id",state.loja.id).order("criado_em",{ascending:false}).limit(100))]);renderAll();}

  function renderGroups(){
    const wrap=$("#listaGruposAdicionais");if(wrap)wrap.innerHTML=state.grupos.length?state.grupos.map(g=>{const ops=state.opcoes.filter(o=>Number(o.grupo_id)===Number(g.id));return `<article class="entity-card"><div class="entity-card-head"><div><span class="eyebrow">${g.obrigatorio?"OBRIGATÓRIO":"OPCIONAL"}</span><h3>${html(g.nome)}</h3><p>${html(g.descricao||"")} · ${g.minimo}–${g.maximo} escolha(s)</p></div><div class="table-actions"><button class="action-btn" data-edit-group="${g.id}"><i class="fa-solid fa-pen"></i></button><button class="action-btn danger" data-delete-group="${g.id}"><i class="fa-solid fa-trash"></i></button></div></div><div class="chip-list">${ops.map(o=>`<span>${html(o.nome)} ${asNumber(o.preco_adicional)>0?`+ ${money(o.preco_adicional)}`:"grátis"}</span>`).join("")||"<small>Sem opções.</small>"}</div></article>`;}).join(""):empty("fa-list-check","Nenhum grupo","Crie grupos como 'Adicionais' ou 'Escolha a carne'.");
    const pwrap=$("#listaProdutosPersonalizacao"),q=String($("#pesquisaPersonalizacaoProduto")?.value||"").toLowerCase();if(pwrap){const list=state.produtos.filter(p=>!q||`${p.nome} ${p.categoria}`.toLowerCase().includes(q));pwrap.innerHTML=list.map(p=>{const linked=state.produtoGrupos.filter(x=>Number(x.produto_id)===Number(p.id)).length,ings=state.ingredientes.filter(x=>Number(x.produto_id)===Number(p.id)).length;return `<article class="compact-entity"><div><strong>${html(p.nome)}</strong><small>${linked} grupo(s) · ${ings} ingrediente(s)</small></div><button class="btn secondary" data-custom-product="${p.id}">Configurar</button></article>`;}).join("")||empty("fa-burger","Nenhum produto","Cadastre produtos primeiro.");}
  }
  function optionEditorRow(item={}){return `<div class="option-editor-row" data-option-id="${item.id||""}"><input data-option-name value="${html(item.nome||"")}" placeholder="Nome da opção"><input data-option-price type="number" min="0" step="0.01" value="${asNumber(item.preco_adicional)}" placeholder="Preço"><button type="button" class="action-btn danger" data-remove-option><i class="fa-solid fa-xmark"></i></button></div>`;}
  function newGroup(){const f=$("#formGrupo");f.reset();delete f.dataset.id;f.elements.minimo.value=0;f.elements.maximo.value=1;f.elements.ordem.value=0;$("#grupoOpcoesEditor").innerHTML=optionEditorRow();$("#modalGrupoTitulo").textContent="Novo grupo";openModal("modalGrupo");}
  function editGroup(id){const g=state.grupos.find(x=>Number(x.id)===Number(id));if(!g)return;const f=$("#formGrupo");f.dataset.id=g.id;["nome","descricao","minimo","maximo","ordem"].forEach(k=>f.elements[k].value=g[k]??"");f.elements.obrigatorio.checked=!!g.obrigatorio;const ops=state.opcoes.filter(o=>Number(o.grupo_id)===Number(g.id));$("#grupoOpcoesEditor").innerHTML=(ops.length?ops:[{}]).map(optionEditorRow).join("");$("#modalGrupoTitulo").textContent="Editar grupo";openModal("modalGrupo");}
  async function saveGroup(event){
    event.preventDefault();
    const f=event.currentTarget,b=f.querySelector('[type="submit"]'),id=f.dataset.id;
    setButton(b,true,"Salvando...");
    try{
      const payload={
        nome:String(f.elements.nome.value||"").trim(),
        descricao:String(f.elements.descricao.value||"").trim()||null,
        obrigatorio:f.elements.obrigatorio.checked,
        minimo:Math.max(0,Math.trunc(asNumber(f.elements.minimo.value))),
        maximo:Math.max(1,Math.trunc(asNumber(f.elements.maximo.value,1))),
        ordem:Math.trunc(asNumber(f.elements.ordem.value))
      };
      if(!payload.nome||payload.minimo>payload.maximo)throw new Error("Revise nome, mínimo e máximo.");
      if(payload.obrigatorio&&payload.minimo<1)throw new Error("Um grupo obrigatório precisa exigir pelo menos 1 opção.");

      const opcoes=$$("#grupoOpcoesEditor .option-editor-row")
        .map((row,index)=>({
          id:row.dataset.optionId?Number(row.dataset.optionId):null,
          nome:String(row.querySelector("[data-option-name]")?.value||"").trim(),
          preco_adicional:Math.max(0,asNumber(row.querySelector("[data-option-price]")?.value)),
          ordem:index
        }))
        .filter(x=>x.nome);

      if(payload.minimo>opcoes.length)throw new Error(`O mínimo exigido (${payload.minimo}) é maior que a quantidade de opções cadastradas (${opcoes.length}).`);

      const r=await db.rpc("salvar_grupo_adicional_admin_v10",{p_loja_id:state.loja.id,
        p_grupo_id:id?Number(id):null,
        p_nome:payload.nome,
        p_descricao:payload.descricao,
        p_obrigatorio:payload.obrigatorio,
        p_minimo:payload.minimo,
        p_maximo:payload.maximo,
        p_ordem:payload.ordem,
        p_opcoes:opcoes
      });
      if(r.error)throw r.error;

      const gid=Number(r.data);
      await logAdmin(id?"Grupo atualizado":"Grupo criado","grupo_adicional",gid,{nome:payload.nome,opcoes:opcoes.length});
      closeModal("modalGrupo");

      await Promise.all([
        loadOne("grupos",()=>db.from("grupos_adicionais").select("*").eq("loja_id",state.loja.id).order("ordem")),
        loadOne("opcoes",()=>db.from("grupo_adicional_opcoes").select("*").eq("loja_id",state.loja.id).order("ordem")),
        loadOne("produtoGrupos",()=>db.from("produto_grupos").select("*").eq("loja_id",state.loja.id))
      ]);

      renderAll();
      toast("Grupo salvo de forma segura.");
    }catch(e){
      toast(e.message,"error");
    }finally{
      setButton(b,false);
    }
  }
  async function deleteGroup(id){const g=state.grupos.find(x=>Number(x.id)===Number(id));if(!g||!confirm(`Excluir o grupo ${g.nome}?`))return;const {error}=await db.from("grupos_adicionais").delete().eq("id",Number(id));if(error)return toast(error.message,"error");await logAdmin("Grupo excluído","grupo_adicional",id,{nome:g.nome});await Promise.all([loadOne("grupos",()=>db.from("grupos_adicionais").select("*").eq("loja_id",state.loja.id).order("ordem")),loadOne("opcoes",()=>db.from("grupo_adicional_opcoes").select("*").eq("loja_id",state.loja.id).order("ordem")),loadOne("produtoGrupos",()=>db.from("produto_grupos").select("*").eq("loja_id",state.loja.id))]);renderAll();toast("Grupo excluído.");}

  function ingredientRow(item={}){return `<div class="ingredient-editor-row" data-ingredient-id="${item.id||""}"><input data-ingredient-name value="${html(item.nome||"")}" placeholder="Ex.: cebola"><label class="switch-inline"><input type="checkbox" data-ingredient-removable ${item.removivel!==false?"checked":""}><span>Removível</span></label><button type="button" class="action-btn danger" data-remove-ingredient><i class="fa-solid fa-xmark"></i></button></div>`;}
  function openCustomization(id){const p=state.produtos.find(x=>Number(x.id)===Number(id));if(!p)return;state.activeProductCustomization=p.id;$("#modalPersonalizarProdutoTitulo").textContent=`Personalização · ${p.nome}`;const linked=new Set(state.produtoGrupos.filter(x=>Number(x.produto_id)===Number(p.id)).map(x=>Number(x.grupo_id)));$("#produtoGruposEditor").innerHTML=state.grupos.map(g=>`<label class="select-card"><input type="checkbox" data-group-link value="${g.id}" ${linked.has(Number(g.id))?"checked":""}><span><strong>${html(g.nome)}</strong><small>${g.obrigatorio?"Obrigatório":"Opcional"} · ${g.minimo}–${g.maximo}</small></span></label>`).join("")||empty("fa-list-check","Sem grupos","Crie um grupo primeiro.");const ing=state.ingredientes.filter(x=>Number(x.produto_id)===Number(p.id));$("#produtoIngredientesEditor").innerHTML=(ing.length?ing:[{}]).map(ingredientRow).join("");openModal("modalPersonalizarProduto");}
  async function saveCustomization(){
    const pid=Number(state.activeProductCustomization);
    if(!pid)return;

    const b=$("#btnSalvarPersonalizacaoProduto");
    setButton(b,true,"Salvando...");

    try{
      const groupIds=$$("[data-group-link]:checked").map(x=>Number(x.value));

      const ingredients=$$("#produtoIngredientesEditor .ingredient-editor-row")
        .map((row,i)=>({
          id:row.dataset.ingredientId?Number(row.dataset.ingredientId):null,
          nome:String(row.querySelector("[data-ingredient-name]")?.value||"").trim(),
          removivel:!!row.querySelector("[data-ingredient-removable]")?.checked,
          ordem:i
        }))
        .filter(x=>x.nome);

      const r=await db.rpc("salvar_personalizacao_produto_admin_v10",{p_loja_id:state.loja.id,
        p_produto_id:pid,
        p_grupo_ids:groupIds,
        p_ingredientes:ingredients
      });

      if(r.error)throw r.error;

      await logAdmin("Personalização atualizada","produto",pid,{
        grupos:groupIds.length,
        ingredientes:ingredients.length
      });

      closeModal("modalPersonalizarProduto");

      await Promise.all([
        loadOne("produtoGrupos",()=>db.from("produto_grupos").select("*").eq("loja_id",state.loja.id)),
        loadOne("ingredientes",()=>db.from("produto_ingredientes").select("*").eq("loja_id",state.loja.id).order("ordem")),
        loadOne("grupos",()=>db.from("grupos_adicionais").select("*").eq("loja_id",state.loja.id).order("ordem")),
        loadOne("opcoes",()=>db.from("grupo_adicional_opcoes").select("*").eq("loja_id",state.loja.id).order("ordem"))
      ]);

      renderGroups();
      renderProducts();
      toast("Personalização salva de forma atômica.");
    }catch(e){
      toast(e.message,"error");
    }finally{
      setButton(b,false);
    }
  }

  function renderMarketing(){const banners=$("#listaBanners"),ups=$("#listaUpsells");if(banners)banners.innerHTML=state.banners.length?state.banners.map(b=>`<article class="banner-card"><img src="${html(b.imagem_url||"../assets/placeholder-burger.svg")}" data-fallback-src="../assets/placeholder-burger.svg"><div><span class="status ${b.ativo?"ativo":"inativo"}">${b.ativo?"Ativo":"Inativo"}</span><h3>${html(b.titulo)}</h3><p>${html(b.subtitulo||"")}</p><div class="table-actions"><button class="action-btn" data-edit-banner="${b.id}"><i class="fa-solid fa-pen"></i></button><button class="action-btn" data-toggle-banner="${b.id}"><i class="fa-solid fa-power-off"></i></button><button class="action-btn danger" data-delete-banner="${b.id}"><i class="fa-solid fa-trash"></i></button></div></div></article>`).join(""):empty("fa-images","Sem banners","Crie banners controlados pelo painel.");if(ups)ups.innerHTML=state.upsells.length?state.upsells.map(u=>`<article class="compact-entity"><div><strong>${html(u.nome)}</strong><small>Oferta: ${html(productName(u.produto_ofertado_id))}${u.preco_promocional!=null?` por ${money(u.preco_promocional)}`:""}</small></div><div class="table-actions"><button class="action-btn" data-edit-upsell="${u.id}"><i class="fa-solid fa-pen"></i></button><button class="action-btn danger" data-delete-upsell="${u.id}"><i class="fa-solid fa-trash"></i></button></div></article>`).join(""):empty("fa-wand-magic-sparkles","Sem ofertas","Crie um upsell para elevar o ticket médio.");}
  function newBanner(){const f=$("#formBanner");f.reset();delete f.dataset.id;f.elements.ordem.value=0;f.elements.ativo.checked=true;$("#bannerImagemPreview").src="../assets/placeholder-burger.svg";$("#modalBannerTitulo").textContent="Novo banner";openModal("modalBanner");}
  function editBanner(id){const x=state.banners.find(b=>Number(b.id)===Number(id));if(!x)return;const f=$("#formBanner");f.dataset.id=x.id;["titulo","subtitulo","texto_botao","link_tipo","ordem","imagem_url","imagem_path"].forEach(k=>{if(f.elements[k])f.elements[k].value=x[k]??"";});f.elements.produto_id.value=x.link_tipo==="produto"?(x.link_valor||""):"";f.elements.categoria.value=x.link_tipo==="categoria"?(x.link_valor||""):"";f.elements.valido_de.value=x.valido_de?new Date(x.valido_de).toISOString().slice(0,16):"";f.elements.valido_ate.value=x.valido_ate?new Date(x.valido_ate).toISOString().slice(0,16):"";f.elements.ativo.checked=x.ativo!==false;$("#bannerImagemPreview").src=x.imagem_url||"../assets/placeholder-burger.svg";$("#modalBannerTitulo").textContent="Editar banner";openModal("modalBanner");}
  async function saveBanner(event){event.preventDefault();const f=event.currentTarget,b=f.querySelector('[type="submit"]'),id=f.dataset.id;setButton(b,true,"Salvando...");let up=null,old=id?state.banners.find(x=>Number(x.id)===Number(id))?.imagem_path:null;try{const file=$("#bannerImagemArquivo")?.files?.[0];if(file)up=await uploadImage(file,"banners");const linkTipo=f.elements.link_tipo.value,linkValor=linkTipo==="produto"?(f.elements.produto_id.value||null):linkTipo==="categoria"?(String(f.elements.categoria.value||"").trim()||null):null;const payload={loja_id:state.loja.id,titulo:String(f.elements.titulo.value||"").trim(),subtitulo:String(f.elements.subtitulo.value||"").trim()||null,imagem_url:up?.url||f.elements.imagem_url.value||null,imagem_path:up?.path||f.elements.imagem_path.value||null,texto_botao:String(f.elements.texto_botao.value||"").trim()||null,link_tipo:linkTipo,link_valor:linkValor,valido_de:f.elements.valido_de.value?new Date(f.elements.valido_de.value).toISOString():null,valido_ate:f.elements.valido_ate.value?new Date(f.elements.valido_ate.value).toISOString():null,ativo:f.elements.ativo.checked,ordem:Math.trunc(asNumber(f.elements.ordem.value)),atualizado_em:new Date().toISOString()};if(!payload.titulo)throw new Error("Informe o título do banner.");if(linkTipo==="produto"&&!linkValor)throw new Error("Selecione o produto do banner.");if(linkTipo==="categoria"&&!linkValor)throw new Error("Informe a categoria do banner.");if(payload.valido_de&&payload.valido_ate&&new Date(payload.valido_ate)<=new Date(payload.valido_de))throw new Error("A validade final do banner deve ser posterior à validade inicial.");const r=id?await db.from("banners").update(payload).eq("id",Number(id)):await db.from("banners").insert(payload);if(r.error)throw r.error;if(up&&old&&old!==up.path)await removeImage(old);await logAdmin(id?"Banner atualizado":"Banner criado","banner",id||null,{titulo:payload.titulo});closeModal("modalBanner");await loadOne("banners",()=>db.from("banners").select("*").eq("loja_id",state.loja.id).order("ordem"));renderMarketing();toast("Banner salvo.");}catch(e){if(up?.path)await removeImage(up.path);toast(e.message,"error");}finally{setButton(b,false);}}
  async function toggleBanner(id){const x=state.banners.find(b=>Number(b.id)===Number(id));if(!x)return;const {error}=await db.from("banners").update({ativo:!x.ativo}).eq("id",Number(id));if(error)return toast(error.message,"error");await loadOne("banners",()=>db.from("banners").select("*").eq("loja_id",state.loja.id).order("ordem"));renderMarketing();}
  async function deleteBanner(id){const x=state.banners.find(b=>Number(b.id)===Number(id));if(!x||!confirm(`Excluir banner “${x.titulo}”?`))return;const {error}=await db.from("banners").delete().eq("id",Number(id));if(error)return toast(error.message,"error");if(x.imagem_path)await removeImage(x.imagem_path);await logAdmin("Banner excluído","banner",id,{titulo:x.titulo});await loadOne("banners",()=>db.from("banners").select("*").eq("loja_id",state.loja.id).order("ordem"));renderMarketing();toast("Banner excluído.");}

  function newUpsell(){const f=$("#formUpsell");f.reset();delete f.dataset.id;f.elements.ordem.value=0;f.elements.ativo.checked=true;$("#modalUpsellTitulo").textContent="Nova oferta";openModal("modalUpsell");}
  function editUpsell(id){const x=state.upsells.find(u=>Number(u.id)===Number(id));if(!x)return;const f=$("#formUpsell");f.dataset.id=x.id;["nome","produto_gatilho_id","categoria_gatilho","produto_ofertado_id","preco_promocional","ordem"].forEach(k=>f.elements[k].value=x[k]??"");f.elements.ativo.checked=x.ativo!==false;$("#modalUpsellTitulo").textContent="Editar oferta";openModal("modalUpsell");}
  async function saveUpsell(event){event.preventDefault();const f=event.currentTarget,b=f.querySelector('[type="submit"]'),id=f.dataset.id;setButton(b,true,"Salvando...");try{const payload={loja_id:state.loja.id,nome:String(f.elements.nome.value||"").trim(),produto_gatilho_id:f.elements.produto_gatilho_id.value?Number(f.elements.produto_gatilho_id.value):null,categoria_gatilho:String(f.elements.categoria_gatilho.value||"").trim()||null,produto_ofertado_id:Number(f.elements.produto_ofertado_id.value),preco_promocional:f.elements.preco_promocional.value===""?null:Math.max(0,asNumber(f.elements.preco_promocional.value)),ativo:f.elements.ativo.checked,ordem:Math.trunc(asNumber(f.elements.ordem.value)),atualizado_em:new Date().toISOString()};if(!payload.nome||!payload.produto_ofertado_id||(!payload.produto_gatilho_id&&!payload.categoria_gatilho))throw new Error("Informe nome, gatilho e produto ofertado.");const r=id?await db.from("ofertas_upsell").update(payload).eq("id",Number(id)):await db.from("ofertas_upsell").insert(payload);if(r.error)throw r.error;await logAdmin(id?"Upsell atualizado":"Upsell criado","upsell",id||null,{nome:payload.nome});closeModal("modalUpsell");await loadOne("upsells",()=>db.from("ofertas_upsell").select("*").eq("loja_id",state.loja.id).order("ordem"));renderMarketing();toast("Oferta salva.");}catch(e){toast(e.message,"error");}finally{setButton(b,false);}}
  async function deleteUpsell(id){const x=state.upsells.find(u=>Number(u.id)===Number(id));if(!x||!confirm(`Excluir a oferta ${x.nome}?`))return;const {error}=await db.from("ofertas_upsell").delete().eq("id",Number(id));if(error)return toast(error.message,"error");await loadOne("upsells",()=>db.from("ofertas_upsell").select("*").eq("loja_id",state.loja.id).order("ordem"));renderMarketing();toast("Oferta excluída.");}

  function couponRules(c){const rules=[];if(asNumber(c.pedido_minimo)>0)rules.push(`Mín. ${money(c.pedido_minimo)}`);if(c.primeira_compra)rules.push("1ª compra");if(c.aplica_produto_id)rules.push(`Produto: ${productName(c.aplica_produto_id)}`);else if(c.aplica_categoria)rules.push(`Categoria: ${c.aplica_categoria}`);if(asNumber(c.limite_por_cliente,1)>0)rules.push(`${asNumber(c.limite_por_cliente,1)}x por cliente`);return rules.join(" · ")||"Sem restrições extras";}
  function renderCoupons(){const body=$("#tabelaCupons");if(!body)return;body.innerHTML=state.cupons.length?state.cupons.map(c=>{const benefit=c.tipo==="percentual"?`${asNumber(c.desconto)}%`:c.tipo==="fixo"?money(c.valor_desconto):"Frete grátis";const valid=c.valido_ate?dateOnly(c.valido_ate):"Sem expiração";return `<tr><td><strong>${html(c.codigo)}</strong><small>${html(c.tipo)}</small></td><td><strong>${html(benefit)}</strong></td><td><small>${html(couponRules(c))}</small></td><td>${asNumber(c.usos)}${c.limite_total?` / ${asNumber(c.limite_total)}`:""}</td><td>${valid}</td><td><span class="status ${c.ativo?"ativo":"inativo"}">${c.ativo?"Ativo":"Inativo"}</span></td><td><div class="table-actions"><button class="action-btn" data-edit-coupon="${c.id}"><i class="fa-solid fa-pen"></i></button><button class="action-btn" data-toggle-coupon="${c.id}"><i class="fa-solid fa-power-off"></i></button><button class="action-btn danger" data-delete-coupon="${c.id}"><i class="fa-solid fa-trash"></i></button></div></td></tr>`;}).join(""):`<tr><td colspan="7">${empty("fa-ticket","Sem cupons","Crie sua primeira promoção.")}</td></tr>`;}
  function syncCouponFields(){const type=$("#cupomTipo")?.value;$("#cupomPercentualField")?.classList.toggle("hidden",type!=="percentual");$("#cupomFixoField")?.classList.toggle("hidden",type!=="fixo");}
  function newCoupon(){const f=$("#formCupom");f.reset();delete f.dataset.id;f.elements.tipo.value="percentual";f.elements.desconto.value=10;f.elements.valor_desconto.value=0;f.elements.pedido_minimo.value=0;f.elements.limite_por_cliente.value=1;f.elements.ativo.checked=true;$("#modalCupomTitulo").textContent="Novo cupom PRO";syncCouponFields();openModal("modalCupom");}
  function editCoupon(id){const c=state.cupons.find(x=>Number(x.id)===Number(id));if(!c)return;const f=$("#formCupom");f.dataset.id=c.id;["codigo","tipo","desconto","valor_desconto","pedido_minimo","limite_total","limite_por_cliente"].forEach(k=>f.elements[k].value=c[k]??"");f.elements.categoria.value=c.aplica_categoria??"";f.elements.produto_id.value=c.aplica_produto_id??"";f.elements.valido_de.value=c.valido_de?new Date(c.valido_de).toISOString().slice(0,16):"";f.elements.valido_ate.value=c.valido_ate?new Date(c.valido_ate).toISOString().slice(0,16):"";f.elements.primeira_compra.checked=!!c.primeira_compra;f.elements.ativo.checked=c.ativo!==false;$("#modalCupomTitulo").textContent="Editar cupom";syncCouponFields();openModal("modalCupom");}
  async function saveCoupon(event){event.preventDefault();const f=event.currentTarget,b=f.querySelector('[type="submit"]'),id=f.dataset.id;setButton(b,true,"Salvando...");try{const type=f.elements.tipo.value,payload={loja_id:state.loja.id,codigo:String(f.elements.codigo.value||"").trim().toUpperCase(),tipo:type,desconto:type==="percentual"?Math.min(100,Math.max(0,asNumber(f.elements.desconto.value))):0,valor_desconto:type==="fixo"?Math.max(0,asNumber(f.elements.valor_desconto.value)):0,frete_gratis:type==="frete_gratis",pedido_minimo:Math.max(0,asNumber(f.elements.pedido_minimo.value)),limite_total:f.elements.limite_total.value?Math.max(1,Math.trunc(asNumber(f.elements.limite_total.value))):null,limite_por_cliente:Math.max(1,Math.trunc(asNumber(f.elements.limite_por_cliente.value,1))),valido_de:f.elements.valido_de.value?new Date(f.elements.valido_de.value).toISOString():null,valido_ate:f.elements.valido_ate.value?new Date(f.elements.valido_ate.value).toISOString():null,primeira_compra:f.elements.primeira_compra.checked,aplica_categoria:String(f.elements.categoria.value||"").trim()||null,aplica_produto_id:f.elements.produto_id.value?Number(f.elements.produto_id.value):null,ativo:f.elements.ativo.checked,atualizado_em:new Date().toISOString()};if(!payload.codigo)throw new Error("Informe o código do cupom.");const r=id?await db.from("cupons").update(payload).eq("id",Number(id)):await db.from("cupons").insert(payload);if(r.error)throw r.error;await logAdmin(id?"Cupom atualizado":"Cupom criado","cupom",id||null,{codigo:payload.codigo,tipo});closeModal("modalCupom");await loadOne("cupons",()=>db.from("cupons").select("*").eq("loja_id",state.loja.id).order("criado_em",{ascending:false}));renderCoupons();toast("Cupom salvo.");}catch(e){toast(e.message,"error");}finally{setButton(b,false);}}
  async function toggleCoupon(id){const c=state.cupons.find(x=>Number(x.id)===Number(id));if(!c)return;const{error}=await db.from("cupons").update({ativo:!c.ativo,atualizado_em:new Date().toISOString()}).eq("id",Number(id));if(error)return toast(error.message,"error");await loadOne("cupons",()=>db.from("cupons").select("*").eq("loja_id",state.loja.id).order("criado_em",{ascending:false}));renderCoupons();}
  async function deleteCoupon(id){const c=state.cupons.find(x=>Number(x.id)===Number(id));if(!c||!confirm(`Excluir cupom ${c.codigo}?`))return;const{error}=await db.from("cupons").delete().eq("id",Number(id));if(error)return toast(error.message,"error");await logAdmin("Cupom excluído","cupom",id,{codigo:c.codigo});await loadOne("cupons",()=>db.from("cupons").select("*").eq("loja_id",state.loja.id).order("criado_em",{ascending:false}));renderCoupons();toast("Cupom excluído.");}

  function clientMetrics(id, orders=state.pedidos){const list=orders.filter(o=>o.user_id===id),valid=list.filter(o=>o.status!=="Cancelado"),spent=valid.reduce((s,o)=>s+asNumber(o.total),0),last=list[0]?.criado_em||null;return {orders:list.length,spent,ticket:valid.length?spent/valid.length:0,last};}
  function clientPointsFromState(id){return state.fidelidade.filter(x=>x.user_id===id).reduce((sum,x)=>sum+asNumber(x.pontos),0);}
  function segmentClient(c){const m=clientMetrics(c.id);const inactive=!m.last||(Date.now()-new Date(m.last).getTime())>90*86400000;if(inactive)return "Inativo";if(m.spent>=500||m.orders>=8)return "VIP";if(m.orders>=2)return "Recorrente";return "Novo";}
  function renderClients(){const body=$("#tabelaClientes");if(!body)return;const q=String($("#pesquisaCliente")?.value||"").trim().toLowerCase(),seg=$("#filtroSegmentoCliente")?.value||"";const list=state.clientes.filter(c=>String(c.tipo||"cliente").toLowerCase()==="cliente").filter(c=>{const segment=segmentClient(c);return(!q||`${c.nome||""} ${c.email||""} ${c.telefone||""}`.toLowerCase().includes(q))&&(!seg||slug(segment)===seg);});$("#contadorClientes").textContent=`${list.length} cliente(s)`;body.innerHTML=list.length?list.map(c=>{const m=clientMetrics(c.id),segment=segmentClient(c),points=clientPointsFromState(c.id);return `<tr><td><div class="client-cell"><span class="client-avatar">${initials(c.nome)}</span><div><strong>${html(c.nome||"Cliente")}</strong><small>${html(c.email||"-")} · ${html(c.telefone||"-")}</small></div></div></td><td><span class="segment ${slug(segment)}">${html(segment)}</span></td><td>${m.orders}</td><td><strong>${money(m.spent)}</strong></td><td>${money(m.ticket)}</td><td><strong>${points}</strong></td><td>${dateTime(m.last)}</td><td><button class="action-btn" data-client-details="${c.id}" title="Ver cliente"><i class="fa-solid fa-eye"></i></button></td></tr>`;}).join(""):`<tr><td colspan="8">${empty("fa-users","Nenhum cliente","Ajuste a busca ou aguarde novos cadastros.")}</td></tr>`;}
  async function clientPoints(id){const r=await db.from("fidelidade_movimentos").select("pontos").eq("user_id",id);if(r.error)throw r.error;return (r.data||[]).reduce((sum,x)=>sum+asNumber(x.pontos),0);}
  async function openClient(id){const c=state.clientes.find(x=>x.id===id);if(!c)return;const m=clientMetrics(c.id);let points=0;try{points=await clientPoints(c.id);}catch(e){console.warn("saldo fidelidade",e.message);}const orders=state.pedidos.filter(o=>o.user_id===id).slice(0,8);$("#modalClienteTitulo").textContent=c.nome||"Cliente";$("#modalClienteConteudo").innerHTML=`<div class="client-detail-hero"><span class="big-avatar">${initials(c.nome)}</span><div><h3>${html(c.nome||"Cliente")}</h3><p>${html(c.email||"-")} · ${html(c.telefone||"-")}</p><span class="segment ${slug(segmentClient(c))}">${segmentClient(c)}</span></div></div><div class="mini-kpis"><div><small>Pedidos</small><strong>${m.orders}</strong></div><div><small>Total gasto</small><strong>${money(m.spent)}</strong></div><div><small>Ticket médio</small><strong>${money(m.ticket)}</strong></div><div><small>Pontos</small><strong>${points}</strong></div></div><div class="client-orders"><h4>Pedidos recentes</h4>${orders.map(o=>`<button data-order-details="${o.id}"><span>#${o.id} · ${dateTime(o.criado_em)}</span><strong>${money(o.total)}</strong></button>`).join("")||"<p>Sem pedidos.</p>"}</div><div class="points-adjust"><input id="clientPointsAdjust" type="number" placeholder="Ex.: 50 ou -20"><input id="clientPointsReason" placeholder="Motivo do ajuste"><button class="btn primary" data-adjust-points="${c.id}">Ajustar pontos</button></div>`;openModal("modalCliente");}
  async function adjustPoints(id){const pts=Math.trunc(asNumber($("#clientPointsAdjust")?.value)),desc=String($("#clientPointsReason")?.value||"Ajuste administrativo").trim();if(!pts)return toast("Informe uma quantidade diferente de zero.","error");try{const r=await db.rpc("ajustar_pontos_admin_v10",{p_loja_id:state.loja.id,p_user_id:id,p_pontos:pts,p_descricao:desc});if(r.error)throw r.error;await loadOne("fidelidade",()=>db.from("fidelidade_movimentos").select("*").eq("loja_id",state.loja.id).order("criado_em",{ascending:false}));renderLoyalty();await openClient(id);toast(`Saldo atualizado: ${asNumber(r.data)} pontos.`);}catch(e){toast(e.message||"Não foi possível ajustar os pontos.","error");}}

  function renderLoyalty(){const active=!!state.config.fidelidade_ativa,total=state.fidelidade.reduce((s,x)=>s+Math.max(0,asNumber(x.pontos)),0),users=new Set(state.fidelidade.filter(x=>asNumber(x.pontos)!==0).map(x=>x.user_id)).size,available=state.resgates.filter(x=>x.status==="disponivel").length;$("#fidelidadeStatus").textContent=active?"Ativa":"Desativada";$("#fidelidadeRegra").textContent=`${asNumber(state.config.pontos_por_real,1)} ponto(s) por R$ 1`;$("#fidelidadePontosEmitidos").textContent=total;$("#fidelidadeClientesAtivos").textContent=users;$("#fidelidadeRecompensasAtivas").textContent=state.recompensas.filter(x=>x.ativo).length;if($("#fidelidadeResgatesAtivos"))$("#fidelidadeResgatesAtivos").textContent=available;const rw=$("#listaRecompensas");if(rw)rw.innerHTML=state.recompensas.length?state.recompensas.map(r=>`<article class="reward-card"><div><span class="points-badge">${r.pontos_necessarios} pts</span><h3>${html(r.nome)}</h3><p>${html(r.descricao||r.tipo)}</p></div><div class="table-actions"><button class="action-btn" data-edit-reward="${r.id}"><i class="fa-solid fa-pen"></i></button><button class="action-btn danger" data-delete-reward="${r.id}"><i class="fa-solid fa-trash"></i></button></div></article>`).join(""):empty("fa-star","Sem recompensas","Cadastre recompensas para o programa de fidelidade.");const mv=$("#listaMovimentosFidelidade");if(mv)mv.innerHTML=state.fidelidade.slice(0,40).map(x=>`<div class="movement-row"><span class="movement-icon ${asNumber(x.pontos)>=0?"positive":"negative"}"><i class="fa-solid ${asNumber(x.pontos)>=0?"fa-plus":"fa-minus"}"></i></span><div><strong>${html(profileName(x.user_id))}</strong><small>${html(x.descricao||x.tipo)} · ${dateTime(x.criado_em)}</small></div><b>${asNumber(x.pontos)>0?"+":""}${x.pontos}</b></div>`).join("")||empty("fa-clock","Sem movimentos","Os pontos creditados e usados aparecerão aqui.");const rs=$("#listaResgatesFidelidade");if(rs)rs.innerHTML=state.resgates.slice(0,40).map(r=>`<div class="movement-row"><span class="movement-icon ${r.status==="disponivel"?"positive":r.status==="usado"?"":"negative"}"><i class="fa-solid ${r.status==="disponivel"?"fa-ticket":r.status==="usado"?"fa-circle-check":"fa-ban"}"></i></span><div><strong>${html(profileName(r.user_id))} · ${html(r.recompensa_nome)}</strong><small>${html(r.codigo)} · ${r.pontos_gastos} pts · ${dateTime(r.criado_em)}</small></div><span class="status ${r.status==="disponivel"?"ativo":r.status==="usado"?"concluido":"inativo"}">${html(r.status)}</span></div>`).join("")||empty("fa-ticket","Sem resgates","Os benefícios trocados por pontos aparecerão aqui.");}
  function newReward(){const f=$("#formRecompensa");f.reset();delete f.dataset.id;f.elements.valor.value=0;f.elements.ativo.checked=true;$("#modalRecompensaTitulo").textContent="Nova recompensa";openModal("modalRecompensa");}
  function editReward(id){const r=state.recompensas.find(x=>Number(x.id)===Number(id));if(!r)return;const f=$("#formRecompensa");f.dataset.id=r.id;["nome","descricao","pontos_necessarios","tipo","valor","produto_id"].forEach(k=>f.elements[k].value=r[k]??"");f.elements.ativo.checked=r.ativo!==false;$("#modalRecompensaTitulo").textContent="Editar recompensa";openModal("modalRecompensa");}
  async function saveReward(event){event.preventDefault();const f=event.currentTarget,b=f.querySelector('[type="submit"]'),id=f.dataset.id;setButton(b,true,"Salvando...");try{const payload={loja_id:state.loja.id,nome:String(f.elements.nome.value||"").trim(),descricao:String(f.elements.descricao.value||"").trim()||null,pontos_necessarios:Math.max(1,Math.trunc(asNumber(f.elements.pontos_necessarios.value))),tipo:f.elements.tipo.value,valor:Math.max(0,asNumber(f.elements.valor.value)),produto_id:f.elements.produto_id.value?Number(f.elements.produto_id.value):null,ativo:f.elements.ativo.checked};if(!payload.nome)throw new Error("Informe o nome da recompensa.");if(["desconto_fixo","desconto_percentual"].includes(payload.tipo)&&payload.valor<=0)throw new Error("Informe um valor de benefício maior que zero.");if(payload.tipo==="desconto_percentual"&&payload.valor>100)throw new Error("O desconto percentual não pode ultrapassar 100%.");if(payload.tipo==="produto"&&!payload.produto_id)throw new Error("Selecione o produto da recompensa.");const r=id?await db.from("fidelidade_recompensas").update(payload).eq("id",Number(id)):await db.from("fidelidade_recompensas").insert(payload);if(r.error)throw r.error;await logAdmin(id?"Recompensa atualizada":"Recompensa criada","recompensa",id||null,{nome:payload.nome});closeModal("modalRecompensa");await loadOne("recompensas",()=>db.from("fidelidade_recompensas").select("*").eq("loja_id",state.loja.id).order("pontos_necessarios"));renderLoyalty();toast("Recompensa salva.");}catch(e){toast(e.message,"error");}finally{setButton(b,false);}}
  async function deleteReward(id){const r=state.recompensas.find(x=>Number(x.id)===Number(id));if(!r||!confirm(`Excluir ${r.nome}?`))return;const{error}=await db.from("fidelidade_recompensas").delete().eq("id",Number(id));if(error)return toast(error.message,"error");await loadOne("recompensas",()=>db.from("fidelidade_recompensas").select("*").eq("loja_id",state.loja.id).order("pontos_necessarios"));renderLoyalty();toast("Recompensa excluída.");}

  function renderReviews(){const list=state.avaliacoes,avg=list.length?list.reduce((s,x)=>s+asNumber(x.nota),0)/list.length:0;$("#mediaAvaliacoes").textContent=list.length?avg.toFixed(1):"-";$("#totalAvaliacoes").textContent=list.length;const wrap=$("#listaAvaliacoes");if(wrap)wrap.innerHTML=list.length?list.map(a=>`<article class="review-card"><div class="review-top"><div><strong>${html(profileName(a.user_id))}</strong><small>Pedido #${a.pedido_id} · ${dateTime(a.criado_em)}</small></div><span class="stars">${"★".repeat(a.nota)}${"☆".repeat(5-a.nota)}</span></div><p>${html(a.comentario||"Sem comentário.")}</p><div class="review-actions"><span class="status ${a.status==="publicada"?"ativo":"inativo"}">${a.status}</span><button class="btn secondary" data-toggle-review="${a.id}">${a.status==="publicada"?"Ocultar":"Publicar"}</button></div></article>`).join(""):empty("fa-star","Sem avaliações","As avaliações dos clientes da Go-burger aparecerão aqui.");}
  async function toggleReview(id){const a=state.avaliacoes.find(x=>Number(x.id)===Number(id));if(!a)return;const status=a.status==="publicada"?"oculta":"publicada";const{error}=await db.from("avaliacoes").update({status,atualizado_em:new Date().toISOString()}).eq("id",Number(id));if(error)return toast(error.message,"error");await logAdmin("Avaliação moderada","avaliacao",id,{status});await loadOne("avaliacoes",()=>db.from("avaliacoes").select("*").eq("loja_id",state.loja.id).order("criado_em",{ascending:false}));renderReviews();}

  function renderDelivery(){const wrap=$("#listaBairros");if(wrap)wrap.innerHTML=state.bairros.length?state.bairros.map(b=>`<article class="compact-entity"><div><strong>${html(b.nome)}</strong><small>Taxa ${money(b.taxa)} · mínimo ${money(b.pedido_minimo)} · +${b.tempo_extra_min} min</small></div><div class="table-actions"><span class="status ${b.ativo?"ativo":"inativo"}">${b.ativo?"Ativo":"Inativo"}</span><button class="action-btn" data-edit-neighborhood="${b.id}"><i class="fa-solid fa-pen"></i></button><button class="action-btn danger" data-delete-neighborhood="${b.id}"><i class="fa-solid fa-trash"></i></button></div></article>`).join(""):empty("fa-map-location-dot","Sem bairros","Cadastre regiões e taxas de entrega.");renderHours();}
  const dayNames=["Domingo","Segunda-feira","Terça-feira","Quarta-feira","Quinta-feira","Sexta-feira","Sábado"];
  function renderHours(){const f=$("#formHorarios");if(!f)return;f.innerHTML=dayNames.map((name,day)=>{const h=state.horarios.find(x=>Number(x.dia_semana)===day)||{ativo:false,abre_1:"18:00",fecha_1:"23:30",abre_2:null,fecha_2:null};const t=v=>v?String(v).slice(0,5):"";return `<div class="hours-row" data-day="${day}"><label class="switch-inline"><input type="checkbox" data-hour-active ${h.ativo?"checked":""}><span>${name}</span></label><input type="time" data-open1 value="${t(h.abre_1)}"><input type="time" data-close1 value="${t(h.fecha_1)}"><input type="time" data-open2 value="${t(h.abre_2)}"><input type="time" data-close2 value="${t(h.fecha_2)}"></div>`;}).join("");}
  function newNeighborhood(){const f=$("#formBairro");f.reset();delete f.dataset.id;f.elements.taxa.value=0;f.elements.pedido_minimo.value=0;f.elements.tempo_extra_min.value=0;f.elements.ordem.value=0;f.elements.ativo.checked=true;$("#modalBairroTitulo").textContent="Novo bairro";openModal("modalBairro");}
  function editNeighborhood(id){const x=state.bairros.find(b=>Number(b.id)===Number(id));if(!x)return;const f=$("#formBairro");f.dataset.id=x.id;["nome","taxa","pedido_minimo","tempo_extra_min","ordem"].forEach(k=>f.elements[k].value=x[k]??"");f.elements.ativo.checked=x.ativo!==false;$("#modalBairroTitulo").textContent="Editar bairro";openModal("modalBairro");}
  async function saveNeighborhood(event){event.preventDefault();const f=event.currentTarget,b=f.querySelector('[type="submit"]'),id=f.dataset.id;setButton(b,true,"Salvando...");try{const payload={loja_id:state.loja.id,nome:String(f.elements.nome.value||"").trim(),taxa:Math.max(0,asNumber(f.elements.taxa.value)),pedido_minimo:Math.max(0,asNumber(f.elements.pedido_minimo.value)),tempo_extra_min:Math.max(0,Math.trunc(asNumber(f.elements.tempo_extra_min.value))),ordem:Math.trunc(asNumber(f.elements.ordem.value)),ativo:f.elements.ativo.checked};if(!payload.nome)throw new Error("Informe o nome do bairro.");const r=id?await db.from("bairros_entrega").update(payload).eq("id",Number(id)):await db.from("bairros_entrega").insert(payload);if(r.error)throw r.error;closeModal("modalBairro");await loadOne("bairros",()=>db.from("bairros_entrega").select("*").eq("loja_id",state.loja.id).order("ordem"));renderDelivery();toast("Bairro salvo.");}catch(e){toast(e.message,"error");}finally{setButton(b,false);}}
  async function deleteNeighborhood(id){const x=state.bairros.find(b=>Number(b.id)===Number(id));if(!x||!confirm(`Excluir ${x.nome}?`))return;const{error}=await db.from("bairros_entrega").delete().eq("id",Number(id));if(error)return toast(error.message,"error");await loadOne("bairros",()=>db.from("bairros_entrega").select("*").eq("loja_id",state.loja.id).order("ordem"));renderDelivery();}
  async function saveHours(){const b=$("#btnSalvarHorarios");setButton(b,true,"Salvando...");try{const rows=$$("#formHorarios .hours-row").map(row=>({loja_id:state.loja.id,dia_semana:Number(row.dataset.day),ativo:row.querySelector("[data-hour-active]").checked,abre_1:row.querySelector("[data-open1]").value||null,fecha_1:row.querySelector("[data-close1]").value||null,abre_2:row.querySelector("[data-open2]").value||null,fecha_2:row.querySelector("[data-close2]").value||null,atualizado_em:new Date().toISOString()}));const{error}=await db.from("horarios_funcionamento").upsert(rows,{onConflict:"loja_id,dia_semana"});if(error)throw error;await logAdmin("Horários atualizados","configuracao","horarios",{});await loadOne("horarios",()=>db.from("horarios_funcionamento").select("*").eq("loja_id",state.loja.id).order("dia_semana"));renderHours();toast("Horários salvos.");}catch(e){toast(e.message,"error");}finally{setButton(b,false);}}

  function applyBrandColor(value){document.documentElement.style.setProperty("--primary",value||"#ff6500");}
  function fillConfig(){
    const c=state.config||{},f=$("#formConfiguracoes");if(!f)return;
    const map={
      nome:"nome",telefoneLoja:"telefone",instagram:"instagram",enderecoLoja:"endereco_loja",
      taxaEntrega:"taxa_entrega",pedidoMinimo:"pedido_minimo",tempoMin:"tempo_estimado_min",
      tempoMax:"tempo_estimado_max",lojaModo:"loja_modo",corPrimaria:"cor_primaria",
      mensagemFechada:"mensagem_loja_fechada",antecedencia:"agendamento_antecedencia_min",
      agendamentoMaxDias:"agendamento_max_dias",pontosPorReal:"pontos_por_real",
      pixChave:"pix_chave",pixNome:"pix_nome",timezone:"timezone",
      raioEntregaKm:"raio_entrega_km",taxaBaseDistancia:"taxa_base_distancia",taxaPorKm:"taxa_por_km"
    };
    Object.entries(map).forEach(([n,k])=>{if(f.elements[n])f.elements[n].value=c[k]??"";});
    if(f.elements.latitude)f.elements.latitude.value=state.loja?.latitude??"";
    if(f.elements.longitude)f.elements.longitude.value=state.loja?.longitude??"";
    f.elements.aceitaEntrega.checked=c.aceita_entrega!==false;
    f.elements.aceitaRetirada.checked=c.aceita_retirada!==false;
    f.elements.aceitaAgendamento.checked=!!c.agendamento_ativo;
    f.elements.fidelidadeAtiva.checked=!!c.fidelidade_ativa;
    if(f.elements.usaTaxaDistancia)f.elements.usaTaxaDistancia.checked=!!c.usa_taxa_distancia;
    $("#sidebarNomeLoja").textContent=c.nome||state.loja?.nome||"Hamburgueria";
    $("#logoPreview").src=c.logo_url||"../assets/placeholder-burger.svg";
    applyBrandColor(c.cor_primaria);
    renderStoreLifecycle();
  }
  async function saveConfig(event){event.preventDefault();const f=event.currentTarget,b=f.querySelector('[type="submit"]');setButton(b,true,"Salvando...");let up=null,old=storagePathFromPublicUrl(state.config.logo_url);try{const file=$("#configLogoArquivo")?.files?.[0];if(file)up=await uploadImage(file,"marca");const payload={id:state.config.id||undefined,loja_id:state.loja.id,nome:String(f.elements.nome.value||"").trim(),telefone:String(f.elements.telefoneLoja.value||"").trim()||null,instagram:String(f.elements.instagram.value||"").trim()||null,endereco_loja:String(f.elements.enderecoLoja.value||"").trim()||null,taxa_entrega:Math.max(0,asNumber(f.elements.taxaEntrega.value)),pedido_minimo:Math.max(0,asNumber(f.elements.pedidoMinimo.value)),tempo_estimado_min:Math.max(0,Math.trunc(asNumber(f.elements.tempoMin.value,30))),tempo_estimado_max:Math.max(0,Math.trunc(asNumber(f.elements.tempoMax.value,50))),loja_modo:f.elements.lojaModo.value,cor_primaria:f.elements.corPrimaria.value||"#ff6500",mensagem_loja_fechada:String(f.elements.mensagemFechada.value||"").trim()||null,aceita_entrega:f.elements.aceitaEntrega.checked,aceita_retirada:f.elements.aceitaRetirada.checked,agendamento_ativo:f.elements.aceitaAgendamento.checked,agendamento_antecedencia_min:Math.max(0,Math.trunc(asNumber(f.elements.antecedencia.value,30))),agendamento_max_dias:Math.max(1,Math.trunc(asNumber(f.elements.agendamentoMaxDias.value,7))),fidelidade_ativa:f.elements.fidelidadeAtiva.checked,pontos_por_real:Math.max(0,asNumber(f.elements.pontosPorReal.value,1)),pix_chave:String(f.elements.pixChave.value||"").trim()||null,pix_nome:String(f.elements.pixNome.value||"").trim()||null,timezone:String(f.elements.timezone.value||"America/Sao_Paulo").trim()||"America/Sao_Paulo",
      usa_taxa_distancia:!!f.elements.usaTaxaDistancia?.checked,
      taxa_base_distancia:Math.max(0,asNumber(f.elements.taxaBaseDistancia?.value)),
      taxa_por_km:Math.max(0,asNumber(f.elements.taxaPorKm?.value)),
      raio_entrega_km:Math.max(.5,asNumber(f.elements.raioEntregaKm?.value,10)),logo_url:up?.url||state.config.logo_url||null,atualizado_em:new Date().toISOString()};if(!payload.nome)throw new Error("Informe o nome da loja.");if(payload.tempo_estimado_max<payload.tempo_estimado_min)throw new Error("O tempo máximo deve ser maior ou igual ao mínimo.");const{error}=await db.from("configuracoes").upsert(payload,{onConflict:"loja_id"});if(error)throw error;
      const latitude=f.elements.latitude?.value!==""?Number(f.elements.latitude.value):null;
      const longitude=f.elements.longitude?.value!==""?Number(f.elements.longitude.value):null;
      if((latitude===null)!==(longitude===null))throw new Error("Informe latitude e longitude juntas.");
      if(latitude!==null&&(!Number.isFinite(latitude)||latitude<-90||latitude>90))throw new Error("Latitude inválida.");
      if(longitude!==null&&(!Number.isFinite(longitude)||longitude<-180||longitude>180))throw new Error("Longitude inválida.");
      const storeUpdate=await db.from("lojas").update({latitude,longitude,atualizado_em:new Date().toISOString()}).eq("id",state.loja.id);
      if(storeUpdate.error)throw storeUpdate.error;
      state.loja={...state.loja,latitude,longitude};
      if(up&&old&&old!==up.path)await removeImage(old);await logAdmin("Configurações atualizadas","configuracao",String(state.loja.id),{nome:payload.nome,loja_id:state.loja.id});await loadConfig();fillConfig();renderDashboard();toast("Configurações salvas.");}catch(e){if(up?.path)await removeImage(up.path);toast(e.message,"error");}finally{setButton(b,false);if($("#configLogoArquivo"))$("#configLogoArquivo").value="";}}
  function renderStoreLifecycle(){
    const box=$("#storeLifecyclePanel"), summary=$("#storeLifecycleSummary"), badge=$("#storeLifecycleBadge"), closeBtn=$("#btnEncerrarHamburgueria"), reopenBtn=$("#btnReabrirHamburgueria");
    if(!box||!state.loja)return;
    const control=state.platformControl||{}, status=String(state.loja.status||"rascunho").toLowerCase(), role=String(state.loja.papel||"").toLowerCase();
    const owner=role==="dono", archived=status==="arquivada", blocked=status==="bloqueada"||!!control.bloqueada_em;
    if(badge){badge.textContent=archived?"Arquivada":blocked?"Bloqueada":status.replaceAll("_"," ");badge.className=`lifecycle-state ${archived?"archived":blocked?"blocked":"active"}`;}
    if(summary){
      if(archived){const origin=control.encerrada_origem==="super_admin"?"pela Go-burger":"pelo dono";summary.innerHTML=`<strong>Operação encerrada ${origin}.</strong>${control.motivo_encerramento?`<span>Motivo: ${html(control.motivo_encerramento)}</span>`:""}<span>A loja está fora do marketplace e não recebe novos pedidos.</span>`;}
      else if(blocked){summary.innerHTML='<strong>Esta hamburgueria está bloqueada pela plataforma.</strong><span>O encerramento voluntário fica indisponível até a regularização.</span>';}
      else if(owner){summary.innerHTML='<strong>Você é o dono desta unidade.</strong><span>Use o encerramento somente se quiser retirar a hamburgueria da Go-burger e parar de receber novos pedidos.</span>';}
      else{summary.innerHTML='<strong>Apenas o dono pode encerrar esta unidade.</strong><span>Administradores, gerentes e equipe continuam podendo operar a loja, mas não podem encerrá-la.</span>';}
    }
    if(closeBtn){closeBtn.classList.toggle("hidden",archived);closeBtn.disabled=!owner||blocked;}
    if(reopenBtn){const canReopen=owner&&archived&&control.encerrada_origem==="parceiro"&&!control.bloqueada_em;reopenBtn.classList.toggle("hidden",!archived);reopenBtn.disabled=!canReopen;reopenBtn.title=canReopen?"Reabrir esta hamburgueria":control.encerrada_origem==="super_admin"?"Somente o Super Admin pode restaurar uma loja arquivada pela plataforma":"Reabertura indisponível";}
  }

  async function closeStoreLifecycle(){
    if(!state.loja)return;
    if(String(state.loja.papel||"").toLowerCase()!=="dono")return toast("Somente o dono pode encerrar a hamburgueria.","error");
    if(String(state.loja.status||"").toLowerCase()==="arquivada")return toast("Esta hamburgueria já está arquivada.","info");
    const slugConfirm=String(state.loja.slug||"");
    const openOrders=state.pedidos.filter(o=>!["concluído","concluido","cancelado"].includes(String(o.status||"").toLowerCase())).length;
    const reason=prompt("Por que você deseja encerrar esta hamburgueria? (opcional)") ?? null;
    if(reason===null)return;
    const typed=prompt(`Para confirmar, digite exatamente:
${slugConfirm}

O histórico será preservado e a hamburgueria deixará de receber novos pedidos.`);
    if(typed===null)return;
    if(String(typed).trim().toLowerCase()!==slugConfirm.toLowerCase())return toast("Confirmação incorreta. O encerramento foi cancelado.","error");
    const warning=openOrders?`

ATENÇÃO: existem ${openOrders} pedido(s) ainda não concluído(s). Eles continuarão acessíveis para finalização, mas nenhum pedido novo será aceito.`:"";
    if(!confirm(`Encerrar ${state.loja.nome}?

A loja sairá do marketplace imediatamente. Produtos, pedidos, pagamentos, avaliações e histórico NÃO serão apagados.${warning}`))return;
    const btn=$("#btnEncerrarHamburgueria");setButton(btn,true,"Encerrando...");
    try{
      const {data,error}=await db.rpc("go_burger_encerrar_hamburgueria_v42",{p_loja_id:Number(state.loja.id),p_confirmacao:typed.trim(),p_motivo:String(reason||"").trim()||null,p_cancelar_renovacao:false});
      if(error)throw error;
      await loadAdminStores();await loadAll(true);renderStoreLifecycle();
      const suffix=Number(data?.pedidos_abertos||0)>0?` Há ${data.pedidos_abertos} pedido(s) existente(s) para finalizar.`:"";
      toast(`Hamburgueria encerrada com segurança.${suffix}`,"info");
    }catch(e){toast(e.message||"Não foi possível encerrar a hamburgueria.","error");}
    finally{setButton(btn,false);}
  }

  async function reopenStoreLifecycle(){
    if(!state.loja)return;
    if(!confirm(`Reabrir ${state.loja.nome}?

A loja voltará em modo pausado/fechado para você revisar tudo antes de aceitar novos pedidos.`))return;
    const btn=$("#btnReabrirHamburgueria");setButton(btn,true,"Reabrindo...");
    try{
      const {data,error}=await db.rpc("go_burger_reabrir_hamburgueria_v42",{p_loja_id:Number(state.loja.id)});if(error)throw error;
      await loadAdminStores();await loadAll(true);renderStoreLifecycle();toast(data?.mensagem||"Hamburgueria reaberta.","info");
    }catch(e){toast(e.message||"Não foi possível reabrir a hamburgueria.","error");}
    finally{setButton(btn,false);}
  }

  async function toggleStoreQuick(){if(String(state.loja?.status||"").toLowerCase()==="arquivada")return toast("A hamburgueria está arquivada. Reabra a unidade antes de alterar o modo de operação.","error");const current=state.config.loja_modo||"automatico",next=current==="aberta"?"fechada":"aberta";const{error}=await db.from("configuracoes").update({loja_modo:next,atualizado_em:new Date().toISOString()}).eq("loja_id",state.loja.id);if(error)return toast(error.message,"error");await logAdmin("Modo da loja alterado","configuracao",String(state.loja.id),{de:current,para:next});await loadConfig();fillConfig();renderDashboard();toast(next==="aberta"?"Loja forçada como aberta.":"Loja fechada manualmente.","info");}

  function stats(orders=state.pedidos){const valid=orders.filter(o=>o.status!=="Cancelado"),revenue=valid.reduce((s,o)=>s+asNumber(o.total),0),items=valid.reduce((s,o)=>s+orderItems(o),0),cost=valid.reduce((s,o)=>s+(o.pedido_itens||[]).reduce((a,i)=>a+productCost(i.produto_id)*asNumber(i.quantidade),0),0);return {valid,revenue,orders:valid.length,ticket:valid.length?revenue/valid.length:0,items,cancelled:orders.filter(o=>o.status==="Cancelado").length,profit:revenue-cost};}
  function dateWindow(period){const now=new Date(),start=new Date(now);start.setHours(0,0,0,0);if(period==="hoje")return [start,now];if(period==="ontem"){const end=new Date(start);start.setDate(start.getDate()-1);return[start,end];}if(period==="7"){start.setDate(start.getDate()-6);return[start,now];}if(period==="30"){start.setDate(start.getDate()-29);return[start,now];}if(period==="mes"){start.setDate(1);return[start,now];}if(period==="mes-anterior"){const end=new Date(start.getFullYear(),start.getMonth(),1);const s=new Date(start.getFullYear(),start.getMonth()-1,1);return[s,end];}return [new Date(0),now];}
  function ordersByPeriod(period){const [s,e]=dateWindow(period);return state.pedidos.filter(o=>{const d=new Date(o.criado_em);return d>=s&&d<=e;});}
  function renderDashboard(){const todayOrders=state.pedidos.filter(o=>today(o.criado_em)),s=stats(todayOrders),all=stats(),inProgress=state.pedidos.filter(o=>["Recebido","Em preparo","Pronto","Saiu para entrega"].includes(o.status)).length,critical=state.produtos.filter(p=>p.ativo!==false&&asNumber(p.estoque)<=asNumber(p.estoque_minimo,5)).length,newClients=state.clientes.filter(c=>c.tipo==="cliente"&&c.criado_em&&(Date.now()-new Date(c.criado_em).getTime())<=30*86400000).length;$("#kpiPedidosHoje").textContent=todayOrders.length;$("#kpiFaturamentoHoje").textContent=money(s.revenue);$("#kpiAndamento").textContent=inProgress;$("#kpiTicket").textContent=money(all.ticket);$("#kpiEstoque").textContent=critical;$("#kpiNovosClientes").textContent=newClients;$("#kpiPedidosComparacao").textContent="Pedidos registrados hoje";$("#kpiFaturamentoComparacao").textContent="Pedidos não cancelados";$("#heroResumo").textContent=inProgress?`${inProgress} pedido(s) em andamento · ${critical} alerta(s) de estoque.`:`Operação tranquila agora · ${critical} alerta(s) de estoque.`;const mode=state.config.loja_modo||"automatico";$("#dashboardLojaStatus").textContent=mode==="aberta"?"Aberta manualmente":mode==="fechada"?"Fechada manualmente":"Horário automático";$("#dashboardTempoEntrega").textContent=`${asNumber(state.config.tempo_estimado_min,30)}–${asNumber(state.config.tempo_estimado_max,50)} min`;$("#btnToggleLojaRapido").innerHTML=mode==="aberta"?'<i class="fa-solid fa-lock"></i> Fechar loja':'<i class="fa-solid fa-door-open"></i> Abrir loja';renderDashboardStatus();renderRecentOrders();renderAlerts();updateBadges();}
  function renderDashboardStatus(){const wrap=$("#resumoStatusDashboard");if(!wrap)return;const sts=["Recebido","Em preparo","Pronto","Saiu para entrega","Concluído","Cancelado"],total=Math.max(1,state.pedidos.length);wrap.innerHTML=sts.map(s=>{const n=state.pedidos.filter(o=>o.status===s).length;return `<div class="status-progress"><div><span>${s}</span><strong>${n}</strong></div><div class="progress"><span style="width:${Math.round(n/total*100)}%"></span></div></div>`;}).join("");}
  function renderRecentOrders(){const wrap=$("#pedidosRecentes");if(!wrap)return;wrap.innerHTML=state.pedidos.slice(0,6).map(o=>`<button class="recent-order" data-order-details="${o.id}"><span class="number">#${o.id}</span><span><strong>${html(o.cliente_nome||"Cliente")}</strong><small>${html(o.status)} · ${dateTime(o.criado_em)}</small></span><b>${money(o.total)}</b></button>`).join("")||empty("fa-receipt","Sem pedidos","Os novos pedidos aparecerão aqui.");}
  function renderAlerts(){const wrap=$("#dashboardAlertas");if(!wrap)return;const alerts=[];state.produtos.filter(p=>p.ativo!==false&&asNumber(p.estoque)<=asNumber(p.estoque_minimo,5)).slice(0,5).forEach(p=>alerts.push(["fa-box-open",`${p.nome}: estoque ${p.estoque}`,"estoque"]));const unread=state.notificacoes.filter(n=>!n.lida).length;if(unread)alerts.push(["fa-bell",`${unread} notificação(ões) não lida(s)`,"notificacoes"]);const hiddenReviews=state.avaliacoes.filter(a=>a.status==="oculta").length;if(hiddenReviews)alerts.push(["fa-star",`${hiddenReviews} avaliação(ões) oculta(s)`,"avaliacoes"]);wrap.innerHTML=alerts.length?alerts.map(a=>`<button class="alert-row" data-page="${a[2]}"><i class="fa-solid ${a[0]}"></i><span>${html(a[1])}</span><i class="fa-solid fa-chevron-right"></i></button>`).join(""):empty("fa-circle-check","Tudo em ordem","Nenhum alerta crítico agora.");}
  function updateBadges(){const active=state.pedidos.filter(o=>["Recebido","Em preparo","Pronto","Saiu para entrega"].includes(o.status)).length,received=state.pedidos.filter(o=>o.status==="Recebido").length,critical=state.produtos.filter(p=>p.ativo!==false&&asNumber(p.estoque)<=asNumber(p.estoque_minimo,5)).length,reviews=state.avaliacoes.length,unread=state.notificacoes.filter(n=>!n.lida).length;[["#badgeOperacao",active],["#badgePedidos",received],["#badgeAvaliacoes",reviews],["#badgeNotificacoesMenu",unread],["#badgeNotificacoes",unread]].forEach(([s,n])=>{const el=$(s);if(el){el.textContent=n>99?"99+":n;el.classList.toggle("zero",!n);}});$("#dotEstoque")?.classList.toggle("hidden",!critical);}
  function renderChart(){const canvas=$("#graficoVendas");if(!canvas||!window.Chart)return;const period=$("#periodoGrafico")?.value||"7",days=period==="30"?30:period==="mes"?new Date().getDate():7,labels=[],values=[];for(let i=days-1;i>=0;i--){const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-i);const e=new Date(d);e.setDate(e.getDate()+1);labels.push(d.toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit"}));values.push(state.pedidos.filter(o=>o.status!=="Cancelado"&&new Date(o.criado_em)>=d&&new Date(o.criado_em)<e).reduce((s,o)=>s+asNumber(o.total),0));}state.chart?.destroy();const muted=getComputedStyle(document.body).getPropertyValue("--muted").trim()||"#867870";state.chart=new Chart(canvas,{type:"line",data:{labels,datasets:[{data:values,borderColor:"#ff6500",backgroundColor:"rgba(255,101,0,.10)",fill:true,tension:.35,borderWidth:3,pointRadius:3}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>money(c.raw)}}},scales:{x:{grid:{display:false},ticks:{color:muted}},y:{beginAtZero:true,ticks:{color:muted,callback:v=>money(v)}}}}});}

  function reportOrders(){return ordersByPeriod($("#periodoRelatorios")?.value||"30");}
  function renderReports(){const orders=reportOrders(),s=stats(orders);$("#relFaturamento").textContent=money(s.revenue);$("#relPedidos").textContent=s.orders;$("#relTicket").textContent=money(s.ticket);$("#relItens").textContent=s.items;$("#relCancelamentos").textContent=s.cancelled;$("#relLucro").textContent=money(s.profit);
    const prepSamples=orders.filter(o=>o.pronto_em&&(o.em_preparo_em||o.criado_em)).map(o=>(new Date(o.pronto_em)-new Date(o.em_preparo_em||o.criado_em))/60000).filter(v=>Number.isFinite(v)&&v>=0&&v<720);
    if($("#relTempoPreparo"))$("#relTempoPreparo").textContent=prepSamples.length?`${Math.round(prepSamples.reduce((a,b)=>a+b,0)/prepSamples.length)} min`:"—";const products={};s.valid.forEach(o=>(o.pedido_itens||[]).forEach(i=>{products[i.nome]=(products[i.nome]||0)+asNumber(i.quantidade);}));const rp=$("#rankingProdutos");if(rp)rp.innerHTML=Object.entries(products).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([n,q],i)=>`<div class="ranking-item"><span>${i+1}</span><div><strong>${html(n)}</strong><small>Unidades vendidas</small></div><b>${q}</b></div>`).join("")||empty("fa-ranking-star","Sem dados","Não há vendas suficientes no período.");const rc=$("#rankingClientes");if(rc){const rows=state.clientes.filter(c=>String(c.tipo||"").toLowerCase()==="cliente").map(c=>({c,m:clientMetrics(c.id,orders)})).filter(x=>x.m.orders).sort((a,b)=>b.m.spent-a.m.spent).slice(0,8);rc.innerHTML=rows.map((x,i)=>`<div class="ranking-item"><span>${i+1}</span><div><strong>${html(x.c.nome||"Cliente")}</strong><small>${x.m.orders} pedido(s)</small></div><b>${money(x.m.spent)}</b></div>`).join("")||empty("fa-users","Sem clientes","Sem compras no período.");}const pg=$("#resumoPagamentos");if(pg)pg.innerHTML=["PIX","Cartão","Dinheiro"].map(p=>{const l=s.valid.filter(o=>o.forma_pagamento===p);return `<div class="summary-row"><span>${p}</span><strong>${l.length} · ${money(l.reduce((a,o)=>a+asNumber(o.total),0))}</strong></div>`;}).join("");const hp=$("#horariosPico");if(hp){const hours=Array(24).fill(0);orders.forEach(o=>{if(o.criado_em)hours[new Date(o.criado_em).getHours()]++;});hp.innerHTML=hours.map((q,h)=>[h,q]).filter(x=>x[1]).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([h,q],i)=>`<div class="ranking-item"><span>${i+1}</span><div><strong>${String(h).padStart(2,"0")}:00</strong><small>Pedidos no período</small></div><b>${q}</b></div>`).join("")||empty("fa-clock","Sem horários","Ainda não há dados suficientes.");}}

  function renderNotifications(){const wrap=$("#listaNotificacoes");if(!wrap)return;wrap.innerHTML=state.notificacoes.length?state.notificacoes.map(n=>`<article class="notification-row ${n.lida?"read":"unread"}"><span class="notification-icon"><i class="fa-solid ${n.tipo==="pedido"?"fa-receipt":n.tipo==="estoque"?"fa-box-open":n.tipo==="avaliacao"?"fa-star":"fa-bell"}"></i></span><div><strong>${html(n.titulo)}</strong><p>${html(n.mensagem||"")}</p><small>${dateTime(n.criado_em)}</small></div><div class="table-actions">${n.pedido_id?`<button class="action-btn" data-order-details="${n.pedido_id}"><i class="fa-solid fa-eye"></i></button>`:""}${!n.lida?`<button class="action-btn" data-read-notification="${n.id}"><i class="fa-solid fa-check"></i></button>`:""}</div></article>`).join(""):empty("fa-bell-slash","Sem notificações","Nenhum evento novo.");updateBadges();}
  async function readNotification(id){const{error}=await db.rpc("go_burger_marcar_notificacao_lida_v10",{p_notificacao_id:Number(id),p_lida:true});if(error)return toast(error.message,"error");await loadOne("notificacoes",()=>db.from("notificacoes").select("*").eq("loja_id",state.loja.id).in("audiencia",["admin","todos"]).order("criado_em",{ascending:false}).limit(100));renderNotifications();}
  async function readAllNotifications(){const ids=state.notificacoes.filter(n=>!n.lida).map(n=>n.id);if(!ids.length)return toast("Não há notificações pendentes.","info");const{error}=await db.rpc("go_burger_marcar_notificacoes_lidas_v10",{p_loja_id:state.loja.id});if(error)return toast(error.message,"error");await loadOne("notificacoes",()=>db.from("notificacoes").select("*").eq("loja_id",state.loja.id).in("audiencia",["admin","todos"]).order("criado_em",{ascending:false}).limit(100));renderNotifications();toast("Notificações marcadas como lidas.");}
  function renderLogs(){
    const wrap=$("#listaAdminLogs");
    if(wrap){
      wrap.innerHTML=state.logs.slice(0,40).map(l=>`<div class="log-row"><span><i class="fa-solid fa-clock-rotate-left"></i></span><div><strong>${html(l.acao)}</strong><small>${html(l.entidade||"sistema")}${l.entidade_id?` #${html(l.entidade_id)}`:""} · ${dateTime(l.criado_em)}</small></div></div>`).join("")||empty("fa-clock-rotate-left","Sem logs","As novas ações administrativas serão registradas aqui.");
    }
    const clearBtn=$("#btnLimparAdminLogs");
    if(clearBtn)clearBtn.disabled=!state.logs.length;
  }

  function ensureLogDeleteConfirmation(){
    let modal=$("#confirmarExclusaoLogs");
    if(modal)return modal;

    modal=document.createElement("div");
    modal.className="log-confirm-overlay";
    modal.id="confirmarExclusaoLogs";
    modal.hidden=true;
    modal.setAttribute("aria-hidden","true");
    modal.innerHTML=`
      <div class="log-confirm-card" role="dialog" aria-modal="true" aria-labelledby="logConfirmTitle" aria-describedby="logConfirmText">
        <button class="log-confirm-close" id="btnFecharConfirmacaoLogs" type="button" aria-label="Fechar confirmação">
          <i class="fa-solid fa-xmark"></i>
        </button>

        <div class="log-confirm-icon" aria-hidden="true">
          <i class="fa-solid fa-trash-can"></i>
        </div>

        <span class="log-confirm-eyebrow">AÇÃO IRREVERSÍVEL</span>
        <h3 id="logConfirmTitle">Excluir atividades administrativas?</h3>

        <p id="logConfirmText" class="log-confirm-text">
          Você está prestes a apagar <strong id="logConfirmCount">0</strong> atividade(s) do histórico administrativo.
        </p>

        <div class="log-confirm-warning">
          <i class="fa-solid fa-triangle-exclamation"></i>
          <div>
            <strong>Esta ação não pode ser desfeita.</strong>
            <span>Somente o histórico de atividades será apagado. Pedidos, produtos, clientes, estoque, cupons e configurações permanecerão intactos.</span>
          </div>
        </div>

        <div class="log-confirm-actions">
          <button class="btn secondary" id="btnCancelarExclusaoLogs" type="button">
            <i class="fa-solid fa-xmark"></i>
            Não
          </button>

          <button class="btn danger log-confirm-delete" id="btnConfirmarExclusaoLogs" type="button">
            <i class="fa-solid fa-check"></i>
            Sim, excluir
          </button>
        </div>
      </div>`;

    document.body.appendChild(modal);
    return modal;
  }

  function openLogDeleteConfirmation(){
    const total=state.logs.length;
    if(!total){
      toast("Não há atividades administrativas para limpar.","info");
      return;
    }

    const modal=ensureLogDeleteConfirmation();
    const count=$("#logConfirmCount");
    if(count)count.textContent=String(total);

    modal.hidden=false;
    modal.style.display="grid";
    modal.setAttribute("aria-hidden","false");
    document.body.classList.add("log-confirm-open");

    /* força o navegador a aplicar o estado inicial antes da animação */
    void modal.offsetWidth;
    requestAnimationFrame(()=>{
      modal.classList.add("active");
      setTimeout(()=>$("#btnCancelarExclusaoLogs")?.focus(),40);
    });
  }

  function closeLogDeleteConfirmation(){
    const modal=$("#confirmarExclusaoLogs");
    if(!modal)return;

    modal.classList.remove("active");
    modal.setAttribute("aria-hidden","true");
    document.body.classList.remove("log-confirm-open");

    setTimeout(()=>{
      if(!modal.classList.contains("active")){
        modal.hidden=true;
        modal.style.display="none";
      }
    },230);
  }

  async function clearAdminLogs(){
    const button=$("#btnConfirmarExclusaoLogs");
    setButton(button,true,"Excluindo...");

    try{
      const {data,error}=await db.rpc("limpar_admin_logs_v10",{p_loja_id:state.loja.id});
      if(error)throw error;

      state.logs=[];
      closeLogDeleteConfirmation();
      renderLogs();
      renderDiagnostic();
      toast(`${asNumber(data)} atividade(s) administrativa(s) removida(s).`);
    }catch(e){
      console.error("clearAdminLogs",e);
      toast(e.message||"Não foi possível limpar as atividades administrativas.","error");
    }finally{
      setButton(button,false);
      const clearBtn=$("#btnLimparAdminLogs");
      if(clearBtn)clearBtn.disabled=!state.logs.length;
    }
  }

  function renderDiagnostic(){const grid=$("#diagnosticGrid");if(!grid)return;const entries={sdk:{ok:!!window.supabase,detail:"Supabase JS carregado"},auth:{ok:!!state.user,detail:state.user?.email||"Sem sessão"},admin:{ok:!!state.loja&&["dono","admin","gerente"].includes(String(state.loja.papel||"")),detail:`Loja: ${state.loja?.nome||"-"} · papel: ${state.loja?.papel||"-"}`},...state.health,realtime:{ok:$("#realtimeDot")?.classList.contains("online")||false,detail:$("#statusRealtime")?.textContent||"-"}};grid.innerHTML=Object.entries(entries).map(([k,v])=>`<article class="diagnostic-card ${v.ok===false?"error":v.ok==null?"warning":""}"><span><i class="fa-solid ${v.ok===false?"fa-triangle-exclamation":v.ok==null?"fa-clock":"fa-circle-check"}"></i></span><div><strong>${html(k)} · ${v.ok===false?"ERRO":v.ok==null?"AGUARDANDO":"OK"}</strong><p>${html(v.detail||"")}</p></div></article>`).join("");if($("#sessionInfo"))$("#sessionInfo").innerHTML=`<div><span>Usuário</span><strong>${html(state.user?.email||"-")}</strong></div><div><span>ID</span><strong>${html(state.user?.id||"-")}</strong></div><div><span>Perfil</span><strong>${html(state.profile?.tipo||"-")}</strong></div><div><span>Projeto</span><strong>${html(SUPABASE_URL)}</strong></div><div><span>Bucket</span><strong>${STORAGE_BUCKET}</strong></div><div><span>Plataforma</span><strong>Go-burger · Marketplace multi-tenant</strong></div>`;}
  async function runDiagnostic(){const b=$("#btnRodarDiagnostico");setButton(b,true,"Testando...");const tests={profiles:()=>db.from("profiles").select("id",{count:"exact",head:true}),produtos:()=>db.from("produtos").select("id",{count:"exact",head:true}),produto_financeiro:()=>db.from("produto_financeiro").select("produto_id",{count:"exact",head:true}),pedidos:()=>db.from("pedidos").select("id",{count:"exact",head:true}),pedido_itens:()=>db.from("pedido_itens").select("id",{count:"exact",head:true}),personalizacao:()=>db.from("grupos_adicionais").select("id",{count:"exact",head:true}),cupons:()=>db.from("cupons").select("id",{count:"exact",head:true}),configuracoes:()=>db.from("configuracoes").select("id",{count:"exact",head:true}),bairros_entrega:()=>db.from("bairros_entrega").select("id",{count:"exact",head:true}),horarios:()=>db.from("horarios_funcionamento").select("id",{count:"exact",head:true}),banners:()=>db.from("banners").select("id",{count:"exact",head:true}),upsells:()=>db.from("ofertas_upsell").select("id",{count:"exact",head:true}),fidelidade:()=>db.from("fidelidade_movimentos").select("id",{count:"exact",head:true}),resgates:()=>db.from("fidelidade_resgates").select("id",{count:"exact",head:true}),avaliacoes:()=>db.from("avaliacoes").select("id",{count:"exact",head:true}),estoque:()=>db.from("estoque_movimentos").select("id",{count:"exact",head:true}),notificacoes:()=>db.from("notificacoes").select("id",{count:"exact",head:true}),logs:()=>db.from("admin_logs").select("id",{count:"exact",head:true}),admin_rpc:()=>db.rpc("minhas_lojas"),storage:()=>db.storage.from(STORAGE_BUCKET).list("",{limit:1})};for(const[k,fn]of Object.entries(tests)){try{const r=await fn();if(r.error)throw r.error;if(k==="admin_rpc"&&!Array.isArray(r.data))throw new Error("Contexto multi-loja indisponível.");state.health[k]={ok:true,detail:"Acesso OK"};}catch(e){state.health[k]={ok:false,detail:e.message};}}renderDiagnostic();setButton(b,false);toast("Diagnóstico concluído.","info");}

  function csvCell(v){return `"${String(v??"").replace(/"/g,'""')}"`;}
  function download(name,content,type="text/plain;charset=utf-8"){const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);}
  function exportOrders(){const rows=[["Pedido","Cliente","Telefone","Entrega","Total","Pagamento","Status pagamento","Status","Data"],...state.pedidos.map(o=>[o.id,o.cliente_nome,o.telefone,o.tipo_entrega,o.total,paymentText(o),o.pagamento_status,o.status,o.criado_em])];download(`go-burger-pedidos-${new Date().toISOString().slice(0,10)}.csv`,`\uFEFF${rows.map(r=>r.map(csvCell).join(";")).join("\n")}`,"text/csv;charset=utf-8");toast("Pedidos exportados.");}
  function exportProducts(){const rows=[["ID","Nome","Categoria","Preço","Custo","Estoque","Mínimo","Status","Destaque","Novidade"],...state.produtos.map(p=>[p.id,p.nome,p.categoria,p.preco,productCost(p.id),p.estoque,p.estoque_minimo,productStatus(p),p.destaque,p.novidade])];download(`go-burger-produtos-${new Date().toISOString().slice(0,10)}.csv`,`\uFEFF${rows.map(r=>r.map(csvCell).join(";")).join("\n")}`,"text/csv;charset=utf-8");toast("Produtos exportados.");}
  function exportBackup(){const data={version:"go-burger-marketplace-v10",exported_at:new Date().toISOString(),config:state.config,produtos:state.produtos,custos:state.custos,pedidos:state.pedidos,clientes:state.clientes,cupons:state.cupons,grupos:state.grupos,opcoes:state.opcoes,produtoGrupos:state.produtoGrupos,ingredientes:state.ingredientes,bairros:state.bairros,horarios:state.horarios,banners:state.banners,upsells:state.upsells,recompensas:state.recompensas,fidelidade:state.fidelidade,resgates:state.resgates,avaliacoes:state.avaliacoes,estoqueMovimentos:state.estoqueMov,notificacoes:state.notificacoes,logs:state.logs};download(`go-burger-loja-backup-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(data,null,2),"application/json;charset=utf-8");toast("Backup JSON exportado.");}
  function exportReport(){const orders=reportOrders(),s=stats(orders),rows=[["Indicador","Valor"],["Faturamento",s.revenue],["Pedidos",s.orders],["Ticket médio",s.ticket],["Itens",s.items],["Cancelamentos",s.cancelled],["Lucro estimado",s.profit]];download(`go-burger-relatorio-${new Date().toISOString().slice(0,10)}.csv`,`\uFEFF${rows.map(r=>r.map(csvCell).join(";")).join("\n")}`,"text/csv;charset=utf-8");}

  function roleLabel(role){return ({dono:"Dono",admin:"Admin",gerente:"Gerente",cozinha:"Cozinha",atendente:"Atendente",entregador:"Entregador"})[role]||role||"Membro";}
  function renderTeam(){
    const wrap=$("#teamList"); if(!wrap)return;
    $("#teamCount") && ($("#teamCount").textContent=state.equipe.filter(x=>x.ativo).length);
    wrap.innerHTML=state.equipe.length?state.equipe.map(m=>`<article class="team-member ${m.ativo?"":"inactive"}"><span class="team-avatar">${initials(m.nome||m.email||"M")}</span><div class="team-main"><strong>${html(m.nome||"Usuário Go-burger")}</strong><small>${html(m.email||"Sem e-mail")}${m.telefone?` · ${html(m.telefone)}`:""}</small><span class="team-role ${html(m.papel)}">${html(roleLabel(m.papel))}${m.principal?" · principal":""}</span></div><div class="team-actions">${m.principal?'<span class="owner-lock"><i class="fa-solid fa-lock"></i> Principal</span>':`<button class="btn ${m.ativo?"danger":"secondary"} small" type="button" data-team-status="${m.user_id}" data-team-active="${m.ativo?"0":"1"}">${m.ativo?"Desativar":"Reativar"}</button>`}</div></article>`).join(""):empty("fa-users","Equipe ainda não cadastrada","Adicione pessoas usando o e-mail da conta Go-burger.");
  }
  async function addTeamMember(event){event.preventDefault();const f=event.currentTarget,b=f.querySelector('[type="submit"]');const email=String(f.elements.email.value||"").trim().toLowerCase(),papel=f.elements.papel.value;if(!email.includes("@"))return toast("Informe um e-mail válido.","error");setButton(b,true,"Adicionando...");try{const r=await db.rpc("go_burger_equipe_salvar_v10",{p_loja_id:state.loja.id,p_email:email,p_papel:papel});if(r.error)throw r.error;await loadOne("equipe",()=>db.rpc("go_burger_equipe_listar_v10",{p_loja_id:state.loja.id}));renderTeam();f.reset();toast("Membro adicionado à equipe.");}catch(e){toast(e.message,"error");}finally{setButton(b,false);}}
  async function setTeamStatus(userId,active){try{const r=await db.rpc("go_burger_equipe_status_v10",{p_loja_id:state.loja.id,p_user_id:userId,p_ativo:active});if(r.error)throw r.error;await loadOne("equipe",()=>db.rpc("go_burger_equipe_listar_v10",{p_loja_id:state.loja.id}));renderTeam();toast(active?"Membro reativado.":"Membro desativado.");}catch(e){toast(e.message,"error");}}



  // image fallback: CSP-safe, without inline event handlers.
  document.addEventListener("error",event=>{
    const img=event.target;
    if(!(img instanceof HTMLImageElement))return;
    const fallback=img.dataset.fallbackSrc;
    if(!fallback||img.dataset.fallbackApplied==="1")return;
    img.dataset.fallbackApplied="1";
    img.src=fallback;
  },true);

  function renderPrinterSettings(){
    const width=localStorage.getItem("go_burger_printer_width")||"80";
    if($("#printerPaperWidth"))$("#printerPaperWidth").value=width;
    if($("#printerMode"))$("#printerMode").value=printerMode();
    if($("#printerBaud"))$("#printerBaud").value=String(printerBaud());
    if($("#printerAutoPrint"))$("#printerAutoPrint").checked=autoPrintEnabled();
  }
  function savePrinterSettings(){
    const width=$("#printerPaperWidth")?.value||"80";
    localStorage.setItem("go_burger_printer_width",width);
    localStorage.setItem("go_burger_printer_mode",$("#printerMode")?.value||"browser");
    localStorage.setItem("go_burger_printer_baud",$("#printerBaud")?.value||"9600");
    const desired=!!$("#printerAutoPrint")?.checked;
    localStorage.setItem("go_burger_auto_print",desired?"1":"0");
    updateAutoPrintButton();
    toast("Preferências da impressora salvas.","info");
  }
  async function printPrinterTest(){
    const width=localStorage.getItem("go_burger_printer_width")||"80";
    if(printerMode()==="serial"){
      try{const port=await getSerialPrinter(false),writer=port.writable.getWriter();try{const enc=new TextEncoder();await writer.write(Uint8Array.from([0x1b,0x40]));await writer.write(enc.encode(`Go-burger\nTESTE ESC/POS ${width}mm\n${new Date().toLocaleString("pt-BR")}\n\n\n`));await writer.write(Uint8Array.from([0x1d,0x56,0x00]));}finally{writer.releaseLock()}toast("Teste enviado à impressora Serial.");return}catch(error){toast(error.message||"Falha no teste Serial.","error");return}
    }
    const testMarkup=`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>Teste Go-burger</title><style>@page{size:${width}mm auto;margin:0}body{width:${width}mm;max-width:${width}mm;margin:0;padding:4mm;font-family:Arial,sans-serif;font-size:11px}h1{text-align:center;font-size:18px}.line{border-top:1px dashed #000;margin:4mm 0}</style></head><body><h1>🍔 Go-burger</h1><div class="line"></div><strong>TESTE DE IMPRESSÃO</strong><p>Se este texto saiu centralizado e sem cortes, a largura de ${width} mm está correta.</p><p>${new Date().toLocaleString("pt-BR")}</p><div class="line"></div><p style="text-align:center">Impressora pronta ✓</p></body></html>`;
    const testBlob=new Blob([testMarkup],{type:"text/html;charset=utf-8"});
    const testUrl=URL.createObjectURL(testBlob);
    const w=open(testUrl,"_blank","width=430,height=700");
    if(!w){URL.revokeObjectURL(testUrl);return toast("O navegador bloqueou a janela de impressão.","error");}
    try{w.addEventListener("load",()=>setTimeout(()=>{try{w.print()}finally{setTimeout(()=>URL.revokeObjectURL(testUrl),5000)}},150),{once:true})}catch(error){console.warn("teste de impressão",error);setTimeout(()=>URL.revokeObjectURL(testUrl),5000)}
  }

  function renderFinancePro(){
    const sub=state.subscription||{},control=state.platformControl||{},seller=state.sellerAccount||{};
    if($("#financePlanName"))$("#financePlanName").textContent=sub.plano_nome||control.plano_nome||"Plano configurado";
    if($("#financeMonthlyValue"))$("#financeMonthlyValue").textContent=money(sub.valor_mensal||0);
    if($("#financeSubscriptionStatus"))$("#financeSubscriptionStatus").textContent=String(sub.status||control.status_financeiro||"—").replaceAll("_"," ");
    if($("#financeNextBilling"))$("#financeNextBilling").textContent=dateOnly(sub.proxima_cobranca);
    if($("#financeCommission"))$("#financeCommission").textContent=`${asNumber(sub.comissao_percentual??control.comissao_percentual,0).toLocaleString("pt-BR")}%`;
    const sellerConnected=seller.oauth_status==="conectado";
    if($("#financeGatewayStatus"))$("#financeGatewayStatus").textContent=sellerConnected?"Conectado":"Não conectado";
    const connectBadge=$("#paymentConnectBadge");
    if(connectBadge){connectBadge.textContent=sellerConnected?"Conectado":"Não conectado";connectBadge.classList.toggle("connected",sellerConnected);}
    $("#btnConnectMercadoPago")?.classList.toggle("hidden",sellerConnected);
    $("#btnDisconnectMercadoPago")?.classList.toggle("hidden",!sellerConnected);
    const reconciliation=state.reconciliation||{};
    if($("#financeReconciliationStatus"))$("#financeReconciliationStatus").textContent=Number(reconciliation.divergencias||0)>0?`${reconciliation.divergencias} divergência(s)`:"OK";
    if($("#financeCommissionTotal"))$("#financeCommissionTotal").textContent=money(reconciliation.comissao_aprovada||0);
    const summary=$("#subscriptionSummary");if(summary)summary.innerHTML=[["Ciclo",sub.ciclo||"mensal"],["Renovação automática",sub.renovacao_automatica===false?"Não":"Sim"],["Trial até",dateOnly(sub.trial_ate)],["Cancelamento solicitado",dateTime(sub.cancelamento_solicitado_em)]].map(([k,v])=>`<div><span>${html(k)}</span><strong>${html(v||"—")}</strong></div>`).join("");
    const sellerSummary=$("#sellerAccountSummary");if(sellerSummary)sellerSummary.innerHTML=[["Provedor",seller.provedor||"Mercado Pago"],["Status",seller.oauth_status||"não conectado"],["Conta",seller.provider_account_id||"—"],["Conectado em",dateTime(seller.conectado_em)]].map(([k,v])=>`<div><span>${html(k)}</span><strong>${html(v||"—")}</strong></div>`).join("");
    const invoices=$("#financeInvoicesBody");if(invoices)invoices.innerHTML=state.faturas.length?state.faturas.map(f=>`<tr><td><strong>${html(f.referencia)}</strong></td><td>${dateOnly(f.competencia)}</td><td>${dateOnly(f.vencimento)}</td><td><strong>${money(f.total)}</strong></td><td><span class="status ${slug(f.status)}">${html(f.status)}</span></td></tr>`).join(""):`<tr><td colspan="5">${empty("fa-file-invoice","Sem faturas","As faturas aparecerão aqui.")}</td></tr>`;
    const tx=$("#financeTransactionsBody");if(tx)tx.innerHTML=state.transacoes.length?state.transacoes.map(t=>`<tr><td><strong>#${html(state.pedidos.find(o=>Number(o.id)===Number(t.pedido_id))?.numero_loja||t.pedido_id)}</strong></td><td>${money(t.valor_bruto)}</td><td>${money(t.comissao_plataforma)}</td><td>${money(t.valor_liquido_loja)}</td><td><span class="status ${slug(t.status)}">${html(t.status)}</span>${t.status==="aprovada"?`<button class="action-btn" type="button" data-request-refund="${t.pedido_id}" title="Solicitar reembolso"><i class="fa-solid fa-rotate-left"></i></button>`:""}</td><td>${dateTime(t.criado_em)}</td></tr>`).join(""):`<tr><td colspan="6">${empty("fa-credit-card","Sem transações online","Pagamentos online aparecerão aqui.")}</td></tr>`;
    $("#btnCancelSubscription")?.classList.toggle("hidden",["cancelada","isenta"].includes(String(sub.status||"")));
    const recurringConnected=Boolean(sub.external_id&&sub.gateway==="mercado_pago");
    $("#btnEnableRecurringBilling")?.classList.toggle("hidden",recurringConnected||Number(sub.valor_mensal||0)<=0||["cancelada","isenta"].includes(String(sub.status||"")));
    $("#btnSyncRecurringBilling")?.classList.toggle("hidden",!recurringConnected);

    const usageGrid=$("#planUsageGrid");
    if(usageGrid){
      const usage=state.planUsage||{};
      const cards=[["Produtos",usage.produtos],["Equipe",usage.usuarios],["Banners",usage.banners]];
      usageGrid.innerHTML=cards.map(([label,item])=>{
        const used=asNumber(item?.usados,0),limit=item?.limite;
        const unlimited=limit==null||Number(limit)<0;
        const percent=unlimited?12:Math.min(100,Math.round(used/Math.max(1,Number(limit))*100));
        return `<article class="plan-usage-card"><small>${html(label)}</small><strong>${used} / ${unlimited?"∞":Number(limit)}</strong><div class="plan-usage-bar"><span style="width:${percent}%"></span></div></article>`;
      }).join("");
    }

    const plansGrid=$("#availablePlansGrid");
    if(plansGrid){
      plansGrid.innerHTML=(state.plans||[]).map(plan=>{
        const current=Number(plan.id)===Number(sub.plano_id||control.plano_id);
        const price=Number(plan.preco_mensal||0);
        return `<article class="admin-plan-card ${current?"current":""}">
          <span class="eyebrow">${current?"PLANO ATUAL":"GO-BURGER"}</span>
          <h4>${html(plan.nome)}</h4>
          <p>${html(plan.descricao||"Plano da Go-burger.")}</p>
          <div class="admin-plan-price"><strong>${money(price)}</strong><small>/mês</small></div>
          <div class="admin-plan-actions">
            ${current?`<button class="btn secondary small" type="button" disabled>Atual</button>`:`<button class="btn primary small" type="button" data-change-plan="${plan.id}">Escolher</button>`}
            ${!current&&Number(plan.trial_dias||0)>0?`<button class="btn secondary small" type="button" data-start-trial="${plan.id}">Testar ${plan.trial_dias} dias</button>`:""}
          </div>
        </article>`;
      }).join("");
    }
  }

  function planLimit(value){
    return value==null||Number(value)<0?"Ilimitado":Number(value).toLocaleString("pt-BR");
  }

  function planFeatureLabels(resources={}){
    const labels={
      pedidos:"Pedidos",dashboard:"Dashboard",marketplace:"Marketplace",metricas_basicas:"Métricas básicas",
      metricas:"Métricas",metricas_avancadas:"Métricas avançadas",cupons:"Cupons",marketing:"Marketing",
      fidelidade:"Fidelidade",equipe:"Equipe",logistica:"Logística",relatorios:"Relatórios",
      destaque:"Destaque",prioridade_suporte:"Suporte prioritário",suporte_prioritario:"Suporte prioritário"
    };
    const out=[];
    Object.entries(resources||{}).forEach(([key,value])=>{
      if(value===true&&labels[key]&&!out.includes(labels[key]))out.push(labels[key]);
    });
    return out.slice(0,8);
  }

  function planDirectionLabel(direction){
    return direction==="upgrade"?"Upgrade":direction==="downgrade"?"Downgrade":direction==="atual"?"Plano atual":"Troca de plano";
  }

  function planBlockersText(preview={}){
    const blockers=Array.isArray(preview.blockers)?preview.blockers:[];
    if(!blockers.length)return "";
    const labels={produtos:"produtos ativos",usuarios:"membros ativos da equipe",banners:"banners ativos"};
    return blockers.map(b=>`${Number(b.usados||0)} ${labels[b.tipo]||b.tipo} para limite ${Number(b.limite||0)}`).join(" · ");
  }

  function persistPlanCatalogP681(portal={}){try{const meta=portal.catalog_cache||{},plans=Array.isArray(portal.plans)?portal.plans:[];if(!plans.length||!meta.etag)return;localStorage.setItem("go-burger-plan-catalog-p681",JSON.stringify({etag:meta.etag,revision:meta.revision,ttl:Number(meta.ttl_seconds||300),savedAt:Date.now(),plans}));}catch{}}
  function readPlanCatalogP681(){try{const raw=JSON.parse(localStorage.getItem("go-burger-plan-catalog-p681")||"null");if(!raw||!Array.isArray(raw.plans)||!raw.plans.length)return null;const ttl=Math.max(60,Number(raw.ttl||300))*1000;if(Date.now()-Number(raw.savedAt||0)>ttl)return null;return raw;}catch{return null;}}

  function renderPlansPortal(){
    const portal=state.planPortal||{},plans=Array.isArray(portal.plans)?portal.plans:[],features=Array.isArray(portal.features)?portal.features:[],current=portal.current_plan||{},sub=portal.subscription||{},pending=portal.pending_intent||{},usage=portal.usage||{},finance=portal.finance||{},terms=portal.terms||{},latestAcceptance=portal.latest_acceptance||{},recovery=portal.recovery||{},entitlements=portal.entitlements||{},plans10=portal.plans_1_0||{},cacheMeta=portal.catalog_cache||{},pilot=portal.pilot||{};
    persistPlanCatalogP681(portal);
    const termsPanel=$("#plansTermsPanel"),termsText=$("#plansTermsText"),termsVersion=$("#plansTermsVersion"),latestText=$("#plansLatestAcceptance");
    if(termsPanel){const ready=Boolean(terms.codigo);termsPanel.classList.toggle("is-missing",!ready);if(termsText)termsText.textContent=ready?`${terms.titulo||"Condições do plano"}. Ambiente ${terms.ambiente||"sandbox"}; nenhuma cobrança real nesta release.`:"Nenhuma versão de condições aplicável foi encontrada.";if(termsVersion)termsVersion.textContent=terms.codigo||"INDISPONÍVEL";if(latestText)latestText.textContent=latestAcceptance?.aceito_em?`Último aceite registrado: ${dateTime(latestAcceptance.aceito_em)} · ${latestAcceptance.codigo||""}`:"O aceite é registrado ao selecionar ou testar um plano.";}
    const recoveryPanel=$("#plansRecoveryPanel");if(recoveryPanel){const candidates=Array.isArray(recovery.candidates)?recovery.candidates:[],cases=Array.isArray(recovery.open_cases)?recovery.open_cases:[];const count=candidates.length+cases.length;recoveryPanel.classList.toggle("ok",count===0);recoveryPanel.innerHTML=`<i class="fa-solid ${count?"fa-triangle-exclamation":"fa-shield-heart"}"></i><div><strong>${count?"Recuperação de pagamento · sandbox":"Recuperação de pagamento · sem pendências"}</strong><p>${count?`${candidates.length} fatura(s) de sandbox candidata(s) e ${cases.length} caso(s) aberto(s). Nenhuma retentativa financeira real é executada.`:"Nenhuma pendência de sandbox identificada. Produção continua bloqueada."}</p></div>`;}
    if(!plans.length&&$("#plansCatalogGrid")){
      $("#plansCatalogGrid").innerHTML=empty("fa-gem","Planos indisponíveis","Não foi possível carregar o catálogo agora.");
      return;
    }
    if(!["mensal","anual"].includes(state.planCycle))state.planCycle=String(sub.ciclo||"mensal");
    $("#plansCurrentName")&&( $("#plansCurrentName").textContent=current.nome||"Grátis" );
    $("#plansSubscriptionStatus")&&( $("#plansSubscriptionStatus").textContent=String(sub.status||"isenta").replaceAll("_"," ") );
    $("#plansCurrentCycle")&&( $("#plansCurrentCycle").textContent=String(sub.ciclo||"mensal").replace(/^./,c=>c.toUpperCase()) );
    $("#plansPendingStatus")&&( $("#plansPendingStatus").textContent=pending?.plano_nome?`${pending.plano_nome} · ${pending.ciclo}`:"Nenhuma" );
    const stateBadge=$("#plansFinanceState");
    if(stateBadge){stateBadge.classList.toggle("live",finance.live===true);stateBadge.innerHTML=finance.live?'<i class="fa-solid fa-circle-check"></i> Financeiro ativo':'<i class="fa-solid fa-lock"></i> Cobrança real bloqueada';}
    $$("[data-plan-cycle]").forEach(b=>b.classList.toggle("active",b.dataset.planCycle===state.planCycle));

    const currentPanel=$("#plansCurrentPanel");
    if(currentPanel){
      const currentFeatures=planFeatureLabels(entitlements.recursos||current.recursos||{}).slice(0,5);
      currentPanel.innerHTML=`<article class="gb-current-plan-card">
        <div class="gb-current-plan-main"><span class="eyebrow">SEU PLANO AGORA</span><h3>${html(current.nome||"Grátis")}</h3><p>${html(current.descricao||"Plano atual da hamburgueria.")}</p><div class="gb-current-plan-tags">${currentFeatures.map(x=>`<span><i class="fa-solid fa-check"></i>${html(x)}</span>`).join("")}</div></div>
        <div class="gb-current-plan-side"><small>Status</small><strong>${html(String(sub.status||"isenta").replaceAll("_"," "))}</strong><small>Ciclo</small><strong>${html(String(sub.ciclo||"mensal"))}</strong>${pending?.id?`<span class="gb-current-pending"><i class="fa-regular fa-clock"></i> ${html(pending.plano_nome)} aguardando ativação</span>`:""}</div>
      </article>`;
    }

    const trial=portal.trial||{};
    const trialBox=$("#plansTrialBanner");
    if(trialBox){
      if(trial?.plano_id){const expired=trial.expirado===true||String(trial.status)==="concluido";trialBox.classList.toggle("expired",expired);trialBox.classList.remove("hidden");trialBox.innerHTML=`<div><span class="eyebrow">${expired?'TRIAL FINALIZADO':'TRIAL EM ANDAMENTO'}</span><strong>${html(trial.plano_nome||'Plano')}</strong><p>${expired?'Escolha um plano para continuar.':`Disponível até ${dateOnly(trial.termina_em)} · sem cobrança.`}</p></div>${expired?'<button class="btn secondary small" type="button" data-trial-free><i class="fa-solid fa-arrow-rotate-left"></i> Voltar ao Grátis</button>':''}`;}else{trialBox.classList.add("hidden");trialBox.innerHTML="";}
    }
    const rec=portal.recommendation||{},recBox=$("#plansRecommendation");
    if(recBox)recBox.innerHTML=rec?.id?`<article><span class="eyebrow">RECOMENDAÇÃO PELO USO</span><strong>${html(rec.nome)}</strong><small>${html(rec.motivo||'')} Custo planejado: ${money(rec.custo_estimado||0)}/mês.</small></article>`:"";
    const simBox=$("#plansSimulationResults"),simulation=Array.isArray(portal.simulation)?portal.simulation:[];
    if(simBox)simBox.innerHTML=simulation.map((x,i)=>`<div class="gb-plan-sim-row"><span>${i===0?'<i class="fa-solid fa-star"></i> ':''}<strong>${html(x.nome)}</strong></span><strong>${money(x.custo_estimado||0)}</strong><small>${money(x.mensalidade||0)} fixo + ${money(x.comissao_estimada||0)} comissão planejada</small></div>`).join("");
    const revenueInput=$("#plansRevenueEstimate");if(revenueInput&&document.activeElement!==revenueInput)revenueInput.value=state.planRevenueEstimate||"";
    const histBox=$("#plansHistory"),history=Array.isArray(portal.history)?portal.history:[];
    if(histBox)histBox.innerHTML=history.length?history.map(h=>`<div class="gb-plan-history-item"><span><i class="fa-solid fa-clock-rotate-left"></i></span><div><strong>${html(String(h.evento||'evento').replaceAll('_',' '))}</strong><p>${h.para_plano_id?`Plano #${h.para_plano_id}`:'Movimentação da assinatura'}</p></div><time>${dateTime(h.criado_em)}</time></div>`).join(""):empty("fa-clock-rotate-left","Sem histórico","As mudanças de plano aparecerão aqui.");

    const pendingBox=$("#plansPendingBanner");
    if(pendingBox){
      if(pending?.id){
        const mode=pending.modo==="trial"?`Teste de ${Number(pending.trial_dias_snapshot||0)} dias`:`Assinatura ${pending.ciclo}`;
        const schedule=pending.tipo_troca==="downgrade"&&pending.aplicar_em?` · Downgrade agendado para ${dateOnly(pending.aplicar_em)}`:"";
        pendingBox.classList.remove("hidden");
        pendingBox.innerHTML=`<div><span class="eyebrow">SELEÇÃO REGISTRADA</span><strong>${html(pending.plano_nome||"Plano")}</strong><p>${html(mode)} · ${money(pending.preco_snapshot||0)}. Nenhuma cobrança foi criada.${html(schedule)}</p></div><button class="btn secondary small" type="button" data-plan-cancel-pending><i class="fa-solid fa-xmark"></i> Cancelar seleção</button>`;
      }else{pendingBox.classList.add("hidden");pendingBox.innerHTML="";}
    }

    const usageGrid=$("#plansUsageGrid");
    if(usageGrid){
      const effectiveLimits=entitlements.limites||{};usageGrid.innerHTML=[["Produtos",{...(usage.produtos||{}),limite:effectiveLimits.produtos??usage.produtos?.limite},"fa-burger"],["Equipe",{...(usage.usuarios||{}),limite:effectiveLimits.usuarios??usage.usuarios?.limite},"fa-users"],["Banners",{...(usage.banners||{}),limite:effectiveLimits.banners??usage.banners?.limite},"fa-images"]].map(([label,item,icon])=>{
        const used=asNumber(item?.usados,0),limit=item?.limite,unlimited=limit==null||Number(limit)<0,percent=unlimited?0:Math.min(100,Math.round(used/Math.max(1,Number(limit))*100));
        const tone=!unlimited&&percent>=100?"danger":!unlimited&&percent>=95?"critical":!unlimited&&percent>=85?"warn":!unlimited&&percent>=70?"watch":"ok";
        return `<article class="plan-usage-card gb-usage-${tone}"><div class="gb-usage-head"><span><i class="fa-solid ${icon}"></i>${html(label)}</span><b>${unlimited?"Ilimitado":`${percent}%`}</b></div><strong>${used} / ${unlimited?"∞":Number(limit)}</strong><div class="plan-usage-bar"><span style="width:${unlimited?8:percent}%"></span></div><small>${unlimited?"Sem limite neste plano":percent>=100?"Limite atingido":percent>=95?"Ação recomendada":percent>=85?"Perto do limite":percent>=70?"Acompanhe o uso":"Uso saudável"}</small></article>`;
      }).join("");
    }

    const grid=$("#plansCatalogGrid");
    if(grid){
      grid.innerHTML=plans.map(plan=>{
        const currentPlan=plan.atual===true,pendingPlan=plan.pendente===true,annual=state.planCycle==="anual",preview=plan.preview||{};
        const rawPrice=annual?asNumber(plan.preco_anual,0):asNumber(plan.preco_mensal,0);
        const priceLabel=annual?`${money(rawPrice)} / ano`:`${money(rawPrice)} / mês`;
        const monthlyEquivalent=annual&&rawPrice>0?money(rawPrice/12):null;
        const featureLabels=planFeatureLabels(plan.recursos||{});
        const isFree=rawPrice===0,blocked=preview.allowed===false,dir=preview.direction||"lateral";
        const actionLabel=dir==="upgrade"?"Fazer upgrade":dir==="downgrade"?"Fazer downgrade":"Selecionar plano";
        const cta=currentPlan?'<button class="btn secondary" type="button" disabled><i class="fa-solid fa-circle-check"></i> Plano atual</button>':pendingPlan?'<button class="btn secondary" type="button" disabled><i class="fa-solid fa-clock"></i> Selecionado</button>':blocked?'<button class="btn secondary" type="button" disabled><i class="fa-solid fa-triangle-exclamation"></i> Ajuste o uso antes</button>':`<button class="btn primary" type="button" data-plan-subscribe="${plan.id}"><i class="fa-solid ${isFree?'fa-check':'fa-arrow-up-right-dots'}"></i> ${isFree?'Ativar grátis':actionLabel}</button>`;
        const trial=!currentPlan&&!pendingPlan&&!blocked&&Number(plan.trial_dias||0)>0?`<button class="btn secondary" type="button" data-plan-trial="${plan.id}"><i class="fa-regular fa-clock"></i> Testar ${plan.trial_dias} dias</button>`:"";
        const blocker=blocked?`<div class="gb-plan-blocker"><i class="fa-solid fa-shield-halved"></i><span>Downgrade bloqueado: ${html(planBlockersText(preview))}</span></div>`:"";
        return `<article class="gb-plan-card ${currentPlan?'current':''} ${pendingPlan?'pending':''} ${plan.destaque?'featured':''} ${blocked?'blocked':''}">
          <div class="gb-plan-card-top"><div><span class="eyebrow">${currentPlan?'PLANO ATUAL':pendingPlan?'SELECIONADO':planDirectionLabel(dir).toUpperCase()}</span><h3>${html(plan.nome)}</h3></div>${plan.badge_texto?`<span class="gb-plan-badge ${html(plan.badge_tipo||'recomendado')}">${html(plan.badge_texto)}</span>`:(plan.recomendado_manual||plan.destaque)?'<span class="gb-plan-badge recomendado">RECOMENDADO</span>':''}</div>
          <p class="gb-plan-desc">${html(plan.descricao||'Plano Go-burger.')}</p>
          <div class="gb-plan-price"><strong>${priceLabel}</strong>${monthlyEquivalent?`<small>equivale a ${monthlyEquivalent}/mês</small>`:''}${annual&&asNumber(plan.economia_anual,0)>0?`<span>Economize ${money(plan.economia_anual)}${asNumber(plan.desconto_anual_percentual,0)>0?` · ${asNumber(plan.desconto_anual_percentual,0).toLocaleString('pt-BR')}%`:''}</span>`:''}</div>
          <div class="gb-plan-limits"><span><i class="fa-solid fa-burger"></i> ${planLimit(plan.limite_produtos)} produtos</span><span><i class="fa-solid fa-users"></i> ${planLimit(plan.limite_usuarios)} usuários</span><span><i class="fa-solid fa-images"></i> ${planLimit(plan.limite_banners)} banners</span></div>
          <div class="gb-plan-features">${featureLabels.length?featureLabels.slice(0,8).map(x=>`<span><i class="fa-solid fa-check"></i>${html(x)}</span>`).join(''):'<span><i class="fa-solid fa-check"></i>Recursos essenciais</span>'}</div>
          <div class="gb-plan-commission"><small>Comissão planejada após ativação financeira</small><strong>${asNumber(plan.comissao_rascunho,0).toLocaleString('pt-BR')}%</strong><em>Agora: 0% efetiva</em></div>
          ${blocker}<div class="gb-plan-actions">${cta}${trial}</div>
        </article>`;
      }).join("");
    }

    const compare=$("#plansCompareBody");
    if(compare)compare.innerHTML=plans.map(plan=>`<tr><td><strong>${html(plan.nome)}</strong></td><td>${planLimit(plan.limite_produtos)}</td><td>${planLimit(plan.limite_usuarios)}</td><td>${planLimit(plan.limite_banners)}</td><td>${Number(plan.trial_dias||0)>0?`${Number(plan.trial_dias)} dias`:"—"}</td><td>${asNumber(plan.comissao_rascunho,0).toLocaleString('pt-BR')}% <small class="gb-zero-now">(0% agora)</small></td></tr>`).join("");

    const matrix=$("#plansFeatureMatrix");
    if(matrix&&features.length){
      const visibleFeatures=features.filter(f=>f.ativo!==false).filter((f,i,a)=>a.findIndex(x=>x.nome===f.nome)===i);
      matrix.innerHTML=`<thead><tr><th>Recurso</th>${plans.map(p=>`<th>${html(p.nome)}</th>`).join("")}</tr></thead><tbody>${visibleFeatures.map(f=>`<tr><td><strong>${html(f.nome)}</strong><small>${html(f.descricao||"")}</small></td>${plans.map(p=>{const enabled=f.core===true||(p.recursos||{})[f.chave]===true;return `<td class="${enabled?'yes':'no'}"><i class="fa-solid ${enabled?'fa-check':'fa-minus'}"></i><span class="sr-only">${enabled?'Incluído':'Não incluído'}</span></td>`}).join("")}</tr>`).join("")}</tbody>`;
    }
    renderPlanFinalP700();
    renderPlanCommercialP660();
  }

  function renderPlanFinalP700(){
    const p=state.planPortal||{},final=p.plans_1_0||{},ent=p.entitlements||{},addons=p.addons||{},cache=p.catalog_cache||{},pilot=p.pilot||{};
    const status=$("#plansP700Status");if(status)status.innerHTML=`<div class="gb-plan-v1-status"><span class="gb-plan-v1-badge"><i class="fa-solid fa-gem"></i> PLANOS 1.0 · ${html(final.release||"P700")}</span><strong>${final.pilot_ready?"Pronto para piloto sem cobrança":"Preparação em andamento"}</strong><small>Billing de produção: <b>${final.production_billing?"ON":"OFF"}</b> · Kill switch: <b>${final.kill_switch_engaged?"ENGAJADO":"—"}</b></small></div>`;
    const e=$("#plansEntitlementsP700");if(e){const lim=ent.limites||{},extra=ent.addons||{},beta=Object.keys(ent.beta||{});e.innerHTML=`<div class="gb-entitlement-row"><span>Produtos</span><b>${lim.produtos==null?"∞":Number(lim.produtos)}</b></div><div class="gb-entitlement-row"><span>Equipe</span><b>${lim.usuarios==null?"∞":Number(lim.usuarios)}</b></div><div class="gb-entitlement-row"><span>Banners</span><b>${lim.banners==null?"∞":Number(lim.banners)}</b></div><small>Extras ativos: +${Number(extra.extra_produtos||0)} produtos · +${Number(extra.extra_usuarios||0)} usuários · +${Number(extra.extra_banners||0)} banners${beta.length?` · Beta: ${html(beta.join(", "))}`:""}</small>`;}
    const a=$("#plansAddonsP700");if(a){const list=Array.isArray(addons.loja)?addons.loja:[];a.innerHTML=list.length?list.map(x=>`<span><i class="fa-solid fa-puzzle-piece"></i>${html(x.nome)} · ${html(x.status)}</span>`).join(""):`<span><i class="fa-regular fa-circle"></i>Nenhum add-on ativo. Catálogo pago continua bloqueado.</span>`;}
    const c=$("#plansCacheP700");if(c)c.textContent=cache.etag?`Catálogo rev. ${cache.revision||"—"} · cache ${Number(cache.ttl_seconds||300)}s · ${String(cache.etag).slice(0,10)}…`:"Cache seguro aguardando catálogo.";
    const pi=$("#plansPilotP700");if(pi)pi.textContent=pilot?.status?`Piloto: ${pilot.status}`:"Piloto: não incluído";
  }

  async function runPlanSandboxE2EP700(){const btn=$("#plansSandboxE2E"),planId=Number($("#plansSandboxPlan")?.value||0);if(!planId)return toast("Escolha um plano de teste.","error");setButton(btn,true,"Executando...");try{const key=`p694-${Date.now()}-${crypto.randomUUID?.()||Math.random().toString(36).slice(2)}`;const {data,error}=await db.rpc("go_burger_planos_sandbox_e2e_v694",{p_loja_id:Number(state.loja.id),p_plano_id:planId,p_ciclo:state.planCycle||"mensal",p_client_request_key:key,p_codigo:String($("#plansSandboxCoupon")?.value||"").trim()||null});if(error)throw error;const out=$("#plansSandboxResult");if(out)out.innerHTML=`<strong>P694 E2E sandbox concluído</strong><span>${(data.steps||[]).map(x=>`${html(x.step)}: ${html(x.status)}`).join(" · ")} · cobrança real: NÃO.</span>`;await reloadPlanPortal();}catch(err){toast(err.message||"Falha no E2E sandbox.","error");}finally{setButton(btn,false);}}

  async function reloadPlanPortal(){
    const section=$('[data-section="planos"]'),grid=$("#plansCatalogGrid"),err=$("#plansPortalError");
    section?.setAttribute("aria-busy","true");if(err)err.innerHTML="";
    if(grid&&!grid.children.length)grid.innerHTML=`<div class="gb-plan-loading" aria-label="Carregando planos">${'<span class="gb-plan-skeleton"></span>'.repeat(4)}</div>`;
    try{await loadOne("planPortal",()=>db.rpc("go_burger_planos_portal_v700",{p_loja_id:state.loja.id,p_faturamento_mensal:state.planRevenueEstimate||0}),{});renderPlansPortal();}
    catch(error){console.error("Planos P700",error);const cached=readPlanCatalogP681();if(cached){state.planPortal={...(state.planPortal||{}),plans:cached.plans,catalog_cache:{etag:cached.etag,revision:cached.revision,ttl_seconds:cached.ttl},cached_only:true};renderPlansPortal();if(err)err.innerHTML=`<div class="gb-plan-error-state cached"><strong>Catálogo em cache seguro.</strong><p>O catálogo recente foi recuperado localmente; dados dinâmicos da assinatura podem estar indisponíveis até reconectar.</p><button class="btn secondary" type="button" data-plan-retry>Reconectar</button></div>`;}else if(err)err.innerHTML=`<div class="gb-plan-error-state"><strong>Não foi possível carregar os planos.</strong><p>${html(error.message||"Tente novamente.")}</p><button class="btn secondary" type="button" data-plan-retry>Recarregar</button></div>`;}
    finally{section?.setAttribute("aria-busy","false");}
  }

  async function selectPlanV613(planId,mode="assinatura",button=null){
    const plan=(state.planPortal?.plans||[]).find(p=>Number(p.id)===Number(planId));if(!plan)return toast("Plano não encontrado.","error");
    const preview=plan.preview||{};if(preview.allowed===false){toast(`Não é possível mudar para ${plan.nome}: ${planBlockersText(preview)}. Ajuste o uso antes do downgrade.`,"error");return;}
    const terms=state.planPortal?.terms||{},accept=$("#plansTermsAccept");
    if(!terms.codigo){toast("As condições aplicáveis do plano não estão disponíveis. Tente novamente.","error");return;}
    if(!accept?.checked){toast("Marque o aceite das condições do plano antes de continuar.","error");accept?.focus();return;}
    const cycle=state.planCycle||"mensal",price=cycle==="anual"?asNumber(plan.preco_anual,0):asNumber(plan.preco_mensal,0),direction=preview.direction||"lateral";
    const action=mode==="trial"?`iniciar o teste de ${plan.trial_dias} dias do plano ${plan.nome}`:price===0?`ativar o plano ${plan.nome}`:direction==="upgrade"?`fazer upgrade para ${plan.nome} no ciclo ${cycle}`:direction==="downgrade"?`fazer downgrade para ${plan.nome} no ciclo ${cycle}`:`selecionar o plano ${plan.nome} no ciclo ${cycle}`;
    const note=price>0?" Nenhuma cobrança será feita nesta versão.":"";const downgradeNote=direction==="downgrade"?" Seus dados não serão apagados; a troca só é permitida quando o uso cabe nos novos limites.":"";
    if(!confirm(`Deseja ${action}?${note}${downgradeNote} O aceite ${terms.codigo} será registrado.`))return;
    setButton(button,true,mode==="trial"?"Ativando trial...":"Selecionando...");
    try{const {data,error}=await db.rpc("go_burger_plano_selecionar_v673",{p_loja_id:Number(state.loja.id),p_plano_id:Number(planId),p_ciclo:cycle,p_modo:mode,p_termos_codigo:terms.codigo,p_aceite:true});if(error)throw error;await reloadPlanPortal();if(data?.status==="ativado_gratis")toast(`Plano ${plan.nome} ativado sem cobrança.`);else if(data?.status==="trial")toast(`Trial do plano ${plan.nome} ativado sem cobrança.`);else toast(data?.message||`Plano ${plan.nome} selecionado.`,"info");}
    catch(error){toast(error.message||"Não foi possível selecionar o plano.","error");}
    finally{setButton(button,false);}
  }

  async function cancelPendingPlanV613(button=null){
    if(!state.planPortal?.pending_intent?.id)return;
    if(!confirm("Cancelar a seleção de plano que está aguardando ativação financeira?"))return;
    setButton(button,true,"Cancelando...");
    try{const {error}=await db.rpc("go_burger_plano_intencao_cancelar_v613",{p_loja_id:Number(state.loja.id)});if(error)throw error;await reloadPlanPortal();toast("Seleção de plano cancelada.","info");}
    catch(error){toast(error.message||"Não foi possível cancelar a seleção.","error");}
    finally{setButton(button,false);}
  }


  function renderPlanCommercialP660(){
    const portal=state.planPortal||{},plans=Array.isArray(portal.plans)?portal.plans:[];
    const promotions=Array.isArray(portal.public_promotions)?portal.public_promotions:[];
    const offers=Array.isArray(portal.personal_offers)?portal.personal_offers:[];
    const courtesies=Array.isArray(portal.courtesies)?portal.courtesies:[];
    const billing=portal.billing||{}, fiscal=portal.fiscal||{}, invoices=Array.isArray(portal.sandbox_invoices)?portal.sandbox_invoices:[];
    const retention=portal.retention||{};
    const planOptions=plans.map(p=>`<option value="${p.id}">${html(p.nome)}</option>`).join("");
    ["plansCouponPlan","plansSandboxPlan"].forEach(id=>{const el=$("#"+id);if(el){const old=el.value;el.innerHTML=planOptions;if(old&&[...el.options].some(o=>o.value===old))el.value=old;}});
    const promoBox=$("#plansPublicPromotions");if(promoBox)promoBox.innerHTML=promotions.length?promotions.map(x=>`<article><span><i class="fa-solid fa-tags"></i></span><div><strong>${html(x.nome)}</strong><small>${html(x.descricao||'Condição promocional disponível no sandbox.')}</small></div></article>`).join(""):`<p class="gb-plan-commercial-empty">Nenhuma promoção pública ativa.</p>`;
    const offerBox=$("#plansPersonalOffers");if(offerBox)offerBox.innerHTML=offers.length?offers.map(x=>`<article><span><i class="fa-solid fa-handshake"></i></span><div><strong>${html(x.plano_nome||'Oferta personalizada')}</strong><small>${money(x.preco_ofertado)} · ${html(x.ciclo||'mensal')}${x.termina_em?` · até ${dateOnly(x.termina_em)}`:''}</small></div></article>`).join(""):`<p class="gb-plan-commercial-empty">Nenhuma oferta personalizada ativa.</p>`;
    const billingBox=$("#plansBillingStatus");if(billingBox){const sub=billing.subscription||{},pause=billing.pause,cancel=billing.cancellation;billingBox.innerHTML=`<div><small>Status preparado</small><strong>${html(String(sub.status||'sem assinatura').replaceAll('_',' '))}</strong></div><div><small>Grace configurado</small><strong>${Number(billing.billing_config?.grace_dias||0)} dias</strong></div>${pause?`<div><small>Pausa</small><strong>${html(pause.status)} · ${dateOnly(pause.inicia_em)}</strong></div>`:''}${cancel?`<div><small>Cancelamento</small><strong>${html(cancel.status)} · ${dateOnly(cancel.efetivar_em)}</strong></div>`:''}`;}
    const ret=$("#plansRetentionOptions");if(ret)ret.innerHTML=`<article><span><i class="fa-solid fa-arrow-down"></i></span><div><strong>Antes de cancelar</strong><small>${retention?.free?.nome?`Você pode voltar ao ${html(retention.free.nome)} sem cobrança.`:'Opções de retenção disponíveis.'}</small></div></article>`;
    const fiscalForm=$("#plansFiscalForm");if(fiscalForm){if(document.activeElement&&!fiscalForm.contains(document.activeElement)){fiscalForm.elements.tipo_pessoa.value=fiscal.tipo_pessoa||'juridica';fiscalForm.elements.razao_social.value=fiscal.razao_social||'';fiscalForm.elements.email_fiscal.value=fiscal.email_fiscal||'';fiscalForm.elements.inscricao_estadual.value=fiscal.inscricao_estadual||'';fiscalForm.elements.inscricao_municipal.value=fiscal.inscricao_municipal||'';fiscalForm.elements.endereco_linha.value=fiscal.endereco?.linha||'';fiscalForm.elements.documento.value='';}}
    const fiscalStatus=$("#plansFiscalStatus");if(fiscalStatus)fiscalStatus.textContent=fiscal.tem_documento?`Perfil ${fiscal.status||'preenchido'} · documento ${fiscal.documento_mascarado||'mascarado'}.`:'Dados fiscais ainda não preenchidos.';
    const body=$("#plansSandboxInvoicesBody");if(body)body.innerHTML=invoices.length?invoices.map(f=>`<tr><td><strong>${html(f.referencia)}</strong><small>${html(f.provedor||'mock')} · sandbox</small></td><td>${money(f.total)}</td><td><span class="status ${slug(f.status)}">${html(f.status)}</span></td><td>${dateOnly(f.vencimento)}</td></tr>`).join(""):`<tr><td colspan="4">${empty('fa-file-invoice','Sem faturas sandbox','Crie um checkout de teste para validar o fluxo.')}</td></tr>`;
    const courtesyNote=courtesies.length?courtesies.map(c=>`${c.plano_nome} (${c.tipo})`).join(', '):'';
    if(courtesyNote&&billingBox)billingBox.insertAdjacentHTML('beforeend',`<div><small>Cortesia ativa</small><strong>${html(courtesyNote)}</strong></div>`);
  }

  async function previewPlanCouponP660(e){
    e?.preventDefault();const planId=Number($("#plansCouponPlan")?.value||0),code=String($("#plansCouponCode")?.value||'').trim();if(!planId)return;
    const out=$("#plansCouponPreviewResult");if(out)out.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Calculando...';
    try{const {data,error}=await db.rpc('go_burger_plano_preco_preview_v643',{p_loja_id:Number(state.loja.id),p_plano_id:planId,p_ciclo:state.planCycle||'mensal',p_codigo:code||null});if(error)throw error;if(out)out.innerHTML=`<strong>${money(data.valor_final)}</strong><span>Base ${money(data.valor_base)} · desconto ${money(data.desconto)} · sandbox</span>`;}catch(err){if(out)out.textContent=err.message||'Não foi possível simular.';}
  }
  async function savePlanFiscalP660(e){
    e.preventDefault();const f=e.currentTarget,doc=String(f.elements.documento.value||'').trim();if(!doc&&state.planPortal?.fiscal?.tem_documento)return toast('Para alterar outros dados fiscais, informe novamente o CPF/CNPJ por segurança.','info');
    const btn=f.querySelector('button[type="submit"]');setButton(btn,true,'Salvando...');
    try{const {error}=await db.rpc('go_burger_plano_perfil_fiscal_salvar_v655',{p_loja_id:Number(state.loja.id),p_tipo_pessoa:f.elements.tipo_pessoa.value,p_razao_social:f.elements.razao_social.value||null,p_documento:doc,p_email_fiscal:f.elements.email_fiscal.value||null,p_endereco:{linha:f.elements.endereco_linha.value||''},p_inscricao_estadual:f.elements.inscricao_estadual.value||null,p_inscricao_municipal:f.elements.inscricao_municipal.value||null});if(error)throw error;await reloadPlanPortal();toast('Preparação fiscal salva.');}catch(err){toast(err.message||'Falha ao salvar dados fiscais.','error');}finally{setButton(btn,false);}
  }
  async function requestPlanPauseP660(){const start=prompt('Data de início da pausa (AAAA-MM-DD):',new Date().toISOString().slice(0,10));if(!start)return;const end=prompt('Data final opcional (AAAA-MM-DD):','');const reason=prompt('Motivo opcional:','')||null;try{const {error}=await db.rpc('go_burger_plano_pausa_solicitar_v647',{p_loja_id:Number(state.loja.id),p_inicia_em:start,p_termina_em:end||null,p_motivo:reason});if(error)throw error;await reloadPlanPortal();toast('Solicitação de pausa registrada.','info');}catch(err){toast(err.message||'Falha ao registrar pausa.','error');}}
  async function requestPlanCancellationP660(){const code=prompt('Motivo do cancelamento (ex.: preco, pouco_uso, encerramento):','pouco_uso');if(!code)return;const detail=prompt('Detalhes opcionais:','')||null;if(!confirm('Registrar solicitação de cancelamento? Nenhuma cobrança real será alterada nesta versão.'))return;try{const {error}=await db.rpc('go_burger_plano_cancelamento_solicitar_v648',{p_loja_id:Number(state.loja.id),p_motivo_codigo:code,p_motivo_detalhe:detail});if(error)throw error;await reloadPlanPortal();toast('Cancelamento registrado em modo de preparação.','info');}catch(err){toast(err.message||'Falha ao solicitar cancelamento.','error');}}
  async function reactivatePlanP660(){try{const {error}=await db.rpc('go_burger_plano_reativar_v646',{p_loja_id:Number(state.loja.id)});if(error)throw error;await reloadPlanPortal();toast('Reativação preparada.');}catch(err){toast(err.message||'Falha ao reativar.','error');}}
  async function createPlanSandboxCheckoutP660(e){
    e.preventDefault();const f=e.currentTarget,btn=f.querySelector('button[type="submit"]'),planId=Number($("#plansSandboxPlan")?.value||0),provider=$("#plansSandboxProvider")?.value||'mock',code=String($("#plansSandboxCoupon")?.value||'').trim();if(!planId)return;
    setButton(btn,true,'Criando teste...');try{const key=`ui-${Date.now()}-${crypto.randomUUID?.()||Math.random().toString(36).slice(2)}`;const {data,error}=await db.rpc('go_burger_plano_checkout_sandbox_criar_v656',{p_loja_id:Number(state.loja.id),p_plano_id:planId,p_ciclo:state.planCycle||'mensal',p_client_request_key:key,p_codigo:code||null,p_provedor:provider});if(error)throw error;const out=$("#plansSandboxResult");if(out)out.innerHTML=`<strong>${money(data?.checkout?.valor_final||0)}</strong><span>Checkout ${html(data?.checkout?.id||'')} · ${html(provider)} · nenhuma cobrança externa.</span>`;await reloadPlanPortal();}catch(err){toast(err.message||'Falha no checkout sandbox.','error');}finally{setButton(btn,false);}
  }
  async function reconcilePlanSandboxP660(){const btn=$("#plansReconcileSandbox");setButton(btn,true,'Conciliando...');try{const {data,error}=await db.rpc('go_burger_plano_conciliar_sandbox_v660',{p_loja_id:Number(state.loja.id)});if(error)throw error;const out=$("#plansSandboxResult");if(out)out.innerHTML=`<strong>${Number(data.divergencias||0)} divergência(s)</strong><span>${Number(data.checkout_total||0)} checkout(s) · ${Number(data.faturas_total||0)} fatura(s) · somente sandbox.</span>`;}catch(err){toast(err.message||'Falha na conciliação sandbox.','error');}finally{setButton(btn,false);}}

  function renderDrivers(){
    const userSelect=$("#driverUserSelect");
    if(userSelect){const linked=new Set(state.entregadores.map(d=>d.user_id).filter(Boolean));const members=(state.equipe||[]).filter(m=>String(m.papel||"").toLowerCase()==="entregador"&&!linked.has(m.user_id));userSelect.innerHTML=`<option value="">Sem conta vinculada</option>`+members.map(m=>`<option value="${html(m.user_id)}">${html(m.nome||m.email||"Entregador")}</option>`).join("");}
    const grid=$("#driversGrid");if(grid)grid.innerHTML=state.entregadores.length?state.entregadores.map(d=>`<article class="driver-card"><div class="driver-card-head"><span><i class="fa-solid ${String(d.veiculo||'').toLowerCase().includes('bike')?'fa-bicycle':'fa-motorcycle'}"></i></span><div><strong>${html(d.nome)}</strong><small>${html(d.telefone||"Sem celular")}</small></div></div><small>${html(d.modelo_veiculo||d.veiculo||"Veículo não informado")}${d.placa?` · ${html(d.placa)}`:""}</small><small>${d.user_id?"Conta Go-burger vinculada":"Cadastro interno"} · ${html(String(d.onboarding_status||'interno').replaceAll('_',' '))}</small><span class="driver-status-pill ${d.disponivel?'online':'offline'}"><i class="fa-solid fa-circle"></i>${d.disponivel?"Online":"Offline"}</span></article>`).join(""):empty("fa-motorcycle","Nenhum entregador","Cadastre manualmente ou envie um convite pelo onboarding Go-burger.");
    const orders=state.pedidos.filter(o=>o.tipo_entrega==="Entrega"&&!["Cancelado","Concluído"].includes(o.status));
    if($("#assignDeliveryOrder"))$("#assignDeliveryOrder").innerHTML=`<option value="">Selecione</option>`+orders.map(o=>`<option value="${o.id}">#${o.numero_loja||o.id} · ${html(o.cliente_nome||"Cliente")} · ${html(o.status)}</option>`).join("");
    if($("#assignDeliveryDriver"))$("#assignDeliveryDriver").innerHTML=`<option value="">Selecione um entregador online</option>`+state.entregadores.filter(d=>d.ativo&&d.disponivel).map(d=>`<option value="${d.id}">${html(d.nome)}</option>`).join("");
    const inviteWrap=$("#driverInvitesList");if(inviteWrap){inviteWrap.innerHTML=(state.driverInvites||[]).length?(state.driverInvites||[]).slice(0,20).map(i=>{const link=`${location.origin}${location.pathname.replace(/\/admin\/admin\.html.*$/,'/entregador/cadastro.html')}?convite=${encodeURIComponent(i.token)}`;return `<article class="driver-invite-row"><div><strong>${html(i.email||i.telefone||'Convite de entregador')}</strong><small>Enviado ${dateTime(i.criado_em)} · expira ${dateOnly(i.expira_em)}</small></div><span class="status ${slug(i.status)}">${html(i.status)}</span><div class="driver-invite-link"><input readonly value="${html(link)}"><button class="btn secondary small" type="button" data-copy-driver-invite="${html(link)}"><i class="fa-solid fa-copy"></i></button></div><a class="btn secondary small" href="${html(link)}" target="_blank" rel="noopener">Abrir</a></article>`}).join(""):empty("fa-paper-plane","Nenhum convite enviado","Use “Convidar entregador” para gerar um link seguro.")}
    const body=$("#deliveriesBody");if(body)body.innerHTML=state.pedidoEntregas.length?state.pedidoEntregas.map(del=>{const o=state.pedidos.find(x=>Number(x.id)===Number(del.pedido_id)),d=state.entregadores.find(x=>Number(x.id)===Number(del.entregador_id));return `<tr><td><strong>#${html(o?.numero_loja||del.pedido_id)}</strong></td><td>${html(d?.nome||"Aguardando")}</td><td><span class="status ${slug(del.status)}">${html(String(del.status||'').replaceAll('_',' '))}</span></td><td>${del.distancia_km!=null?`${asNumber(del.distancia_km).toFixed(1)} km`:"—"}</td><td>${del.previsao_min?`${del.previsao_min} min`:"—"}</td></tr>`;}).join(""):`<tr><td colspan="5">${empty("fa-route","Sem entregas atribuídas","As rotas aparecerão aqui.")}</td></tr>`;
  }

  async function saveDriver(event){
    event.preventDefault();const f=event.currentTarget,b=f.querySelector('[type="submit"]');setButton(b,true,"Salvando...");
    try{const payload={loja_id:state.loja.id,user_id:f.elements.user_id.value||null,nome:String(f.elements.nome.value||"").trim(),telefone:String(f.elements.telefone.value||"").trim()||null,veiculo:String(f.elements.veiculo.value||"").trim()||null,placa:String(f.elements.placa.value||"").trim().toUpperCase()||null,ativo:true,disponivel:true,atualizado_em:new Date().toISOString()};if(!payload.nome)throw new Error("Informe o nome.");const {error}=await db.from("entregadores").insert(payload);if(error)throw error;f.reset();await loadOne("entregadores",()=>db.from("entregadores").select("*").eq("loja_id",state.loja.id).order("nome"));renderDrivers();toast("Entregador cadastrado.");}catch(error){toast(error.message,"error");}finally{setButton(b,false);}
  }

  async function assignDelivery(event){
    event.preventDefault();const f=event.currentTarget,b=f.querySelector('[type="submit"]'),pedidoId=Number(f.elements.pedido_id.value),entregadorId=Number(f.elements.entregador_id.value);if(!pedidoId||!entregadorId)return toast("Selecione pedido e entregador.","error");setButton(b,true,"Atribuindo...");
    try{const {error}=await db.rpc("go_burger_atribuir_entregador_v1",{p_loja_id:state.loja.id,p_pedido_id:pedidoId,p_entregador_id:entregadorId});if(error)throw error;await loadOne("pedidoEntregas",()=>db.from("pedido_entregas").select("*").eq("loja_id",state.loja.id).order("atualizado_em",{ascending:false}).limit(100));renderDrivers();toast("Oferta de entrega enviada ao entregador.");}catch(error){toast(error.message,"error");}finally{setButton(b,false);}
  }

  async function createDriverInvite(event){
    event.preventDefault();const f=event.currentTarget,b=f.querySelector('[type="submit"]');setButton(b,true,"Gerando...");
    try{const email=String(f.elements.email.value||"").trim()||null,telefone=String(f.elements.telefone.value||"").trim()||null;if(!email&&!telefone)throw new Error("Informe e-mail ou celular.");const {data,error}=await db.rpc("go_burger_loja_criar_convite_entregador_v45",{p_loja_id:state.loja.id,p_email:email,p_telefone:telefone});if(error)throw error;await loadOne("driverInvites",()=>db.rpc("go_burger_loja_convites_entregador_v45",{p_loja_id:state.loja.id}));renderDrivers();closeModal("modalConviteEntregador");f.reset();const link=`${location.origin}${location.pathname.replace(/\/admin\/admin\.html.*$/,'/entregador/cadastro.html')}?convite=${encodeURIComponent(data.token)}`;try{await navigator.clipboard.writeText(link);toast("Convite gerado e link copiado.")}catch{toast("Convite gerado. Copie o link na lista de convites.")}}
    catch(error){toast(error.message||"Não foi possível gerar o convite.","error")}finally{setButton(b,false)}
  }


  async function requestRefund(pedidoId){if(!FINANCE_ENABLED){toast("Financeiro indisponível nesta versão de lançamento.","info");return;}
    const order=state.pedidos.find(o=>Number(o.id)===Number(pedidoId));
    const tx=state.transacoes.find(x=>Number(x.pedido_id)===Number(pedidoId)&&x.status==="aprovada");
    if(!tx)return toast("Pagamento aprovado não encontrado.","error");
    const raw=prompt(`Valor a reembolsar (máximo ${money(tx.valor_bruto)}). Deixe vazio para reembolso total:`);
    if(raw===null)return;
    const value=raw.trim()===""?null:Number(String(raw).replace(",","."));
    if(value!==null&&(!Number.isFinite(value)||value<=0))return toast("Valor inválido.","error");
    const motivo=prompt("Motivo do reembolso:")||"";
    if(!confirm(`Registrar solicitação de reembolso do pedido #${order?.numero_loja||pedidoId}?`))return;
    try{
      const {data,error}=await db.rpc("go_burger_solicitar_reembolso_v1",{
        p_loja_id:state.loja.id,p_pedido_id:Number(pedidoId),p_valor:value,p_motivo:motivo||null
      });
      if(error)throw error;
      const refundId=String(data||"");
      toast(`Reembolso registrado · ${refundId.slice(0,8)}. Processando no Mercado Pago...`,"info");

      const provider=await db.functions.invoke("go-burger-payment-refund",{body:{reembolso_id:refundId}});
      if(provider.error)throw new Error("A solicitação foi salva, mas o Mercado Pago não concluiu o reembolso agora. Você poderá tentar novamente depois.");
      if(!provider.data?.ok)throw new Error(provider.data?.error||"O reembolso foi solicitado, mas ainda não foi concluído pelo provedor.");

      await Promise.all([
        loadOne("transacoes",()=>db.from("pagamento_transacoes").select("*").eq("loja_id",state.loja.id).order("criado_em",{ascending:false}).limit(100)),
        loadOne("reconciliation",()=>db.rpc("go_burger_conciliacao_resumo_v1",{p_loja_id:state.loja.id,p_dias:30}),{})
      ]);
      renderFinancePro();
      toast(`Reembolso ${provider.data.total?"total":"parcial"} concluído no Mercado Pago.`);
    }catch(error){toast(error.message,"error");}
  }

  function exportFinancial(){
    const rows=(state.transacoes||[]).map(t=>({
      pedido:state.pedidos.find(o=>Number(o.id)===Number(t.pedido_id))?.numero_loja||t.pedido_id,
      data:t.criado_em,
      provedor:t.provedor,
      status:t.status,
      bruto:t.valor_bruto,
      comissao_go_burger:t.comissao_plataforma,
      liquido_loja:t.valor_liquido_loja,
      external_id:t.external_id||""
    }));
    csvDownload(`go-burger-financeiro-${state.loja.slug||state.loja.id}.csv`,rows);
  }

  async function changePlan(planId){if(!FINANCE_ENABLED){toast("Financeiro indisponível nesta versão de lançamento.","info");return;}
    const plan=state.plans.find(p=>Number(p.id)===Number(planId));if(!plan)return;
    if(!confirm(`Alterar a hamburgueria para o plano ${plan.nome}?`))return;
    try{
      const {error}=await db.rpc("go_burger_trocar_plano_v1",{p_loja_id:state.loja.id,p_plano_id:Number(planId),p_ciclo:"mensal"});
      if(error)throw error;
      await Promise.all([
        loadOne("subscription",()=>db.from("loja_assinaturas").select("*").eq("loja_id",state.loja.id).maybeSingle(),{}),
        loadOne("platformControl",()=>db.from("loja_controle_plataforma").select("*").eq("loja_id",state.loja.id).maybeSingle(),{})
      ]);
      await loadOne("planUsage",()=>db.rpc("go_burger_plano_uso_v1",{p_loja_id:state.loja.id}),{});renderFinancePro();toast(`Plano alterado para ${plan.nome}.`);
    }catch(error){toast(error.message,"error");}
  }

  async function startPlanTrial(planId){
    const plan=state.plans.find(p=>Number(p.id)===Number(planId));if(!plan)return;
    if(!confirm(`Iniciar teste de ${plan.trial_dias} dias do plano ${plan.nome}?`))return;
    try{
      const {error}=await db.rpc("go_burger_iniciar_trial_v1",{p_loja_id:state.loja.id,p_plano_id:Number(planId)});
      if(error)throw error;
      await Promise.all([
        loadOne("subscription",()=>db.from("loja_assinaturas").select("*").eq("loja_id",state.loja.id).maybeSingle(),{}),
        loadOne("platformControl",()=>db.from("loja_controle_plataforma").select("*").eq("loja_id",state.loja.id).maybeSingle(),{})
      ]);
      await loadOne("planUsage",()=>db.rpc("go_burger_plano_uso_v1",{p_loja_id:state.loja.id}),{});renderFinancePro();toast(`Trial do plano ${plan.nome} iniciado.`);
    }catch(error){toast(error.message,"error");}
  }

  function captureStoreLocation(){
    if(!navigator.geolocation)return toast("Geolocalização indisponível neste aparelho.","info");
    const button=$("#btnStoreLocation");setButton(button,true,"Localizando...");
    navigator.geolocation.getCurrentPosition(
      pos=>{
        $("#configLatitude").value=Number(pos.coords.latitude).toFixed(7);
        $("#configLongitude").value=Number(pos.coords.longitude).toFixed(7);
        toast("Localização da hamburgueria preenchida. Salve as configurações.");
        setButton(button,false);
      },
      ()=>{toast("Não foi possível obter a localização.","error");setButton(button,false);},
      {enableHighAccuracy:true,timeout:10000,maximumAge:60000}
    );
  }

  async function connectMercadoPago(){
    if(!state.loja?.id)return toast("Selecione uma hamburgueria.","error");
    const button=$("#btnConnectMercadoPago");
    setButton(button,true,"Conectando...");
    try{
      const {data,error}=await db.functions.invoke("go-burger-marketplace-connect",{body:{loja_id:Number(state.loja.id)}});
      if(error)throw error;
      if(!data?.authorization_url)throw new Error(data?.error||"Não foi possível iniciar a conexão com o Mercado Pago.");
      toast("Abrindo a autorização segura do Mercado Pago...","info");
      const target=window.top&&window.top!==window?window.top:window;
      target.location.href=data.authorization_url;
    }catch(error){
      const message=String(error?.message||"");
      toast(message.includes("non-2xx")?"A aplicação Mercado Pago ainda precisa das credenciais da Go-burger no backend.":message||"Não foi possível conectar o Mercado Pago.","error");
      setButton(button,false);
    }
  }

  async function disconnectMercadoPago(){
    if(!state.loja?.id)return;
    if(!confirm("Desconectar o Mercado Pago desta hamburgueria? Novos pagamentos online ficarão indisponíveis até reconectar."))return;
    const button=$("#btnDisconnectMercadoPago");
    setButton(button,true,"Desconectando...");
    try{
      const {data,error}=await db.rpc("go_burger_desconectar_marketplace_v1",{p_loja_id:Number(state.loja.id)});
      if(error)throw error;
      if(!data)throw new Error("Não foi possível desconectar esta conta.");
      await loadOne("sellerAccount",()=>db.from("marketplace_seller_accounts").select("loja_id,provedor,provider_account_id,oauth_status,conectado_em,atualizado_em").eq("loja_id",state.loja.id).maybeSingle(),{});
      renderFinancePro();
      toast("Mercado Pago desconectado.","info");
    }catch(error){toast(error.message||"Não foi possível desconectar.","error");}
    finally{setButton(button,false);}
  }

  async function handleMercadoPagoReturn(){
    const params=new URLSearchParams(location.search);
    const status=String(params.get("mp")||"");
    const subscriptionReturn=String(params.get("assinatura")||"");
    if(!status&&!subscriptionReturn)return;

    if(subscriptionReturn){
      await loadOne("subscription",()=>db.from("loja_assinaturas").select("*").eq("loja_id",state.loja.id).maybeSingle(),{});
      if(state.subscription?.external_id)await syncRecurringBilling({silent:true});
      navigate("financeiro",false);
      toast("Retorno da cobrança recorrente recebido. Status sincronizado.","info");
    }

    if(status){
      if(status==="conectado"){
        await loadOne("sellerAccount",()=>db.from("marketplace_seller_accounts").select("loja_id,provedor,provider_account_id,oauth_status,conectado_em,atualizado_em").eq("loja_id",state.loja.id).maybeSingle(),{});
        renderFinancePro();
        navigate("financeiro",false);
        toast("Mercado Pago conectado com segurança.");
      }else if(status==="cancelado"){
        toast("A conexão com o Mercado Pago foi cancelada.","info");
      }else{
        toast("Não foi possível concluir a conexão com o Mercado Pago. Verifique as credenciais da integração.","error");
      }
    }

    ["mp","motivo","loja_id","assinatura"].forEach(key=>params.delete(key));
    const next=`${location.pathname}${params.toString()?`?${params}`:""}${location.hash||""}`;
    history.replaceState(null,"",next);
  }

  async function enableRecurringBilling(){
    if(!state.loja?.id)return;
    const button=$("#btnEnableRecurringBilling");
    setButton(button,true,"Preparando...");
    try{
      const {data,error}=await db.functions.invoke("go-burger-subscription-create",{body:{loja_id:Number(state.loja.id)}});
      if(error)throw error;
      if(!data?.checkout_url)throw new Error(data?.error||"Não foi possível iniciar a assinatura automática.");
      toast("Abrindo a autorização da cobrança recorrente...","info");
      const target=window.top&&window.top!==window?window.top:window;
      target.location.href=data.checkout_url;
    }catch(error){
      const message=String(error?.message||"");
      toast(message.includes("non-2xx")?"A cobrança recorrente está pronta, mas a conta Mercado Pago da Go-burger ainda precisa da credencial da plataforma.":message||"Não foi possível ativar a cobrança automática.","error");
      setButton(button,false);
    }
  }

  async function syncRecurringBilling({silent=false}={}){
    if(!state.loja?.id||!state.subscription?.external_id)return;
    const button=$("#btnSyncRecurringBilling");
    if(!silent)setButton(button,true,"Sincronizando...");
    try{
      const {data,error}=await db.functions.invoke("go-burger-subscription-manage",{body:{loja_id:Number(state.loja.id),action:"sync"}});
      if(error)throw error;
      if(data?.ok){
        await loadOne("subscription",()=>db.from("loja_assinaturas").select("*").eq("loja_id",state.loja.id).maybeSingle(),{});
        renderFinancePro();
        if(!silent)toast(`Cobrança sincronizada · ${String(data.provider_status||data.status||"ok")}.`,`info`);
      }
    }catch(error){if(!silent)toast(error.message||"Não foi possível sincronizar a cobrança.","error");}
    finally{if(!silent)setButton(button,false);}
  }

  async function requestSubscriptionCancellation(){
    const reason=prompt("Motivo do cancelamento (opcional):")||"";
    if(!confirm("Confirmar cancelamento da assinatura? A renovação automática será interrompida."))return;
    try{
      if(state.subscription?.external_id&&state.subscription?.gateway==="mercado_pago"){
        const provider=await db.functions.invoke("go-burger-subscription-manage",{body:{loja_id:Number(state.loja.id),action:"cancel"}});
        if(provider.error)throw new Error("Não foi possível cancelar a renovação no Mercado Pago. Nenhuma alteração local foi feita.");
      }
      const {data,error}=await db.rpc("go_burger_solicitar_cancelamento_assinatura_v1",{p_loja_id:state.loja.id,p_motivo:reason||null});
      if(error)throw error;
      if(!data&&String(state.subscription?.status||"")!=="cancelada")throw new Error("A assinatura não pode ser cancelada neste status.");
      await loadOne("subscription",()=>db.from("loja_assinaturas").select("*").eq("loja_id",state.loja.id).maybeSingle(),{});
      renderFinancePro();
      toast("Assinatura cancelada e renovação automática interrompida.");
    }catch(error){toast(error.message||"Não foi possível cancelar a assinatura.","error");}
  }

  function renderAll(){updateAdminUI();updateProductSelects();renderProducts();renderOrders();renderOperation();renderStock();renderGroups();renderMarketing();renderCoupons();renderClients();renderTeam();renderLoyalty();renderReviews();renderDelivery();fillConfig();renderDashboard();renderReports();renderPlansPortal();renderFinancePro();renderPrinterSettings();renderDrivers();renderNotifications();renderLogs();renderDiagnostic();if(document.querySelector('[data-section="hamburgueria"].active'))renderStoreStudio();}

  function applyTheme(){window.GoBurgerTheme?.apply?.();}
  function toggleTheme(){window.GoBurgerTheme?.toggle?.();renderChart();}
  function toggleKitchen(){state.cozinha=!state.cozinha;document.body.classList.toggle("kitchen-mode",state.cozinha);$("#btnModoCozinha").innerHTML=state.cozinha?'<i class="fa-solid fa-arrow-left"></i> Sair do modo cozinha':'<i class="fa-solid fa-display"></i> Modo cozinha';renderOperation();}
  window.addEventListener("go-burger-theme-change",()=>{try{renderChart();}catch{}});
  function soundEnabled(){return localStorage.getItem("burger_admin_v4_sound")!=="off";}
  function updateSoundIcon(){const i=$("#btnSom i");if(i)i.className=soundEnabled()?"fa-solid fa-volume-high":"fa-solid fa-volume-xmark";}
  function toggleSound(){localStorage.setItem("burger_admin_v4_sound",soundEnabled()?"off":"on");updateSoundIcon();toast(soundEnabled()?"Som ativado.":"Som desativado.","info");}

  /* =========================================================
     ETAPA 8 — ESTÚDIO DA HAMBURGUERIA
     Interface + integração real com Supabase.
  ========================================================= */

  const studioDraft = { slugTouched:false, logoObjectUrl:null, bannerObjectUrl:null };

  function studioSlugify(value="") {
    return String(value)
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase().trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0,70);
  }

  function studioSetImage(input, stage, image, objectKey, linkedStage, linkedImage) {
    const file=input?.files?.[0]; if(!file)return;
    if(!/^image\/(jpeg|png|webp)$/i.test(file.type)){toast("Use uma imagem JPG, PNG ou WEBP.","error");input.value="";return;}
    if(file.size>5*1024*1024){toast("A imagem deve ter no máximo 5 MB.","error");input.value="";return;}
    if(studioDraft[objectKey]) URL.revokeObjectURL(studioDraft[objectKey]);
    studioDraft[objectKey]=URL.createObjectURL(file);
    if(image){image.src=studioDraft[objectKey];stage?.classList.add("has-image");}
    if(linkedImage){linkedImage.src=studioDraft[objectKey];linkedStage?.classList.add("has-image");}
    updateStoreStudioPreview();
  }

  function studioValue(id){return String($(id)?.value||"").trim();}

  async function uploadStoreAsset(file, kind) {
    if (!file) return null;
    if (!state.loja?.id) throw new Error("Nenhuma hamburgueria selecionada.");
    if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) throw new Error("Use uma imagem JPG, PNG ou WEBP.");
    if (file.size > 5*1024*1024) throw new Error("A imagem deve ter no máximo 5 MB.");
    const ext=(file.name.split(".").pop()||"jpg").toLowerCase().replace(/[^a-z0-9]/g,"") || "jpg";
    const safeKind=kind === "banner" ? "banner" : "logo";
    const path=`lojas/${state.loja.id}/identidade/${safeKind}-${Date.now()}-${crypto.randomUUID?.()||Math.random().toString(36).slice(2)}.${ext}`;
    const {error}=await db.storage.from(STORAGE_BUCKET).upload(path,file,{cacheControl:"3600",upsert:false});
    if(error)throw error;
    const {data}=db.storage.from(STORAGE_BUCKET).getPublicUrl(path);
    return {path,url:data.publicUrl};
  }

  function studioCheckbox(id, fallback=false){const el=$(id);return el?Boolean(el.checked):fallback;}

  function fillStoreStudio() {
    const l=state.loja||{}, c=state.config||{};
    const set=(id,value)=>{const el=$(id);if(el && !el.matches(":focus"))el.value=value??"";};
    set("#studioNome",l.nome||c.nome||"");
    set("#studioDescricao",l.descricao||"");
    set("#studioTelefone",l.telefone||c.telefone||c.telefone_loja||"");
    set("#studioWhatsapp",l.whatsapp||"");
    set("#studioEmail",l.email_contato||"");
    set("#studioCep",l.cep||"");
    set("#studioEndereco",l.endereco||c.endereco_loja||"");
    set("#studioCidade",l.cidade||"");
    set("#studioEstado",l.estado||"MG");
    set("#studioSlug",l.slug||studioSlugify(l.nome||c.nome||"loja-principal"));
    set("#studioStatus",l.status||"ativa");
    set("#studioPrioridade",l.destaque?"destaque":"normal");
    set("#studioSlogan",l.slogan||""); set("#studioInstagram",l.instagram||"");
    set("#studioCorPrimaria",l.cor_primaria||c.cor_primaria||"#ff6500"); set("#studioCorSecundaria",l.cor_secundaria||"#17100c"); set("#studioCorDestaque",l.cor_destaque||"#ffc928"); set("#studioTemaPublico",l.tema_publico||"claro");
    const selectedCats=new Set((state.lojaCategorias||[]).map(x=>Number(x.categoria_id)));
    const catWrap=$("#studioMarketplaceCategorias"); if(catWrap)catWrap.innerHTML=(state.marketplaceCategorias||[]).map(cat=>`<label class="market-cat-check"><input type="checkbox" value="${cat.id}" ${selectedCats.has(Number(cat.id))?"checked":""}><span><i class="fa-solid ${html(cat.icone||"fa-tag")}"></i>${html(cat.nome)}</span></label>`).join("");
    if($("#studioContatoWhatsapp")) $("#studioContatoWhatsapp").checked = l.mostrar_whatsapp !== false;
    if($("#studioMostrarTelefone")) $("#studioMostrarTelefone").checked = l.mostrar_telefone !== false;
    if($("#studioMostrarEndereco")) $("#studioMostrarEndereco").checked = l.mostrar_endereco !== false;
    if($("#studioContatoEmail")) $("#studioContatoEmail").checked = l.mostrar_email === true;

    const logo=l.logo_url||c.logo_url||"";
    if(logo && !studioDraft.logoObjectUrl){
      const a=$("#studioLogoPreview"), ai=$("#studioLogoImg"), b=$("#publicLogoPreview"), bi=$("#publicLogoImg");
      if(ai){ai.src=logo;a?.classList.add("has-image");} if(bi){bi.src=logo;b?.classList.add("has-image");}
    }
    const banner=l.banner_url||"";
    if(banner && !studioDraft.bannerObjectUrl){
      const a=$("#studioCoverStage"), ai=$("#studioBannerPreview"), b=$("#publicCoverPreview"), bi=$("#publicBannerImg");
      if(ai){ai.src=banner;a?.classList.add("has-image");} if(bi){bi.src=banner;b?.classList.add("has-image");}
    }
    studioDraft.slugTouched=Boolean(l.slug);
    updateStoreStudioPreview();
  }

  function updateStoreStudioPreview() {
    const name=studioValue("#studioNome")||"Sua Hamburgueria";
    const desc=studioValue("#studioDescricao")||"Uma descrição atraente da sua loja aparecerá aqui.";
    const city=studioValue("#studioCidade"), uf=studioValue("#studioEstado"), address=studioValue("#studioEndereco");
    const slug=studioSlugify(studioValue("#studioSlug")||name||"loja-principal");
    const status=studioValue("#studioStatus")||"ativa";
    const primary=studioValue("#studioCorPrimaria")||state.loja?.cor_primaria||"#ff6500";
    document.documentElement.style.setProperty("--studio-brand",primary);

    if($("#publicStoreName")) $("#publicStoreName").textContent=name;
    if($("#publicStoreDescription")) $("#publicStoreDescription").textContent=studioValue("#studioSlogan")||desc;
    if($("#studioUrlPreview")) $("#studioUrlPreview").textContent=`../cliente/cliente.html?loja=${slug||"loja-principal"}`;
    if($("#studioMapLabel")) $("#studioMapLabel").textContent=[address,city,uf].filter(Boolean).join(" · ")||"Sua hamburgueria aparecerá aqui";
    if($("#publicLocation")) $("#publicLocation").innerHTML=`<i class="fa-solid fa-location-dot"></i> ${html([city,uf].filter(Boolean).join(" - ")||"Localização da loja")}`;

    const statusMap={ativa:["Aberta","open","Loja ativa"],pausada:["Pausada","paused","Loja pausada"],rascunho:["Rascunho","draft","Em rascunho"],bloqueada:["Indisponível","blocked","Loja bloqueada"]};
    const s=statusMap[status]||statusMap.ativa;
    const pub=$("#publicStatus"); if(pub){pub.className=`public-status ${s[1]}`;pub.innerHTML=`<i></i> ${s[0]}`;}
    if($("#studioStatusLabel")) $("#studioStatusLabel").textContent=s[2];

    const nameCount=studioValue("#studioNome").length, descCount=studioValue("#studioDescricao").length;
    if($("#studioNomeCount")) $("#studioNomeCount").textContent=`${nameCount}/80`;
    if($("#studioDescricaoCount")) $("#studioDescricaoCount").textContent=`${descCount}/280`;

    const checks=[
      studioValue("#studioNome"), studioValue("#studioDescricao"), studioValue("#studioSlug"),
      studioValue("#studioTelefone")||studioValue("#studioWhatsapp"), studioValue("#studioEndereco"),
      studioValue("#studioCidade"), studioValue("#studioEstado"),
      $("#studioLogoPreview")?.classList.contains("has-image"), $("#studioCoverStage")?.classList.contains("has-image")
    ];
    const done=checks.filter(Boolean).length, pct=Math.round(done/checks.length*100);
    const ring=$("#studioProgressRing"); if(ring)ring.style.setProperty("--progress",pct);
    if($("#studioProgressValue")) $("#studioProgressValue").textContent=`${pct}%`;
    if($("#studioQualityLabel")) $("#studioQualityLabel").textContent=pct>=90?"Perfil com aparência premium":pct>=65?"Sua loja está ganhando forma":"Complete seu perfil";
    if($("#studioQualityText")) $("#studioQualityText").textContent=pct>=90?"Ótima apresentação visual para o marketplace.":pct>=65?"Complete logo, capa e localização para elevar a confiança.":"Adicione nome, descrição, logo e capa para melhorar a apresentação.";
    const slugOk=/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
    const slugIcon=$("#studioSlugStatus"); if(slugIcon){slugIcon.className=slugOk?"fa-solid fa-circle-check":"fa-solid fa-circle-exclamation";slugIcon.style.color=slugOk?"#38a169":"#d9852b";}
  }

  function renderApprovalStudio() {
    const c=state.platformControl||{}, status=String(c.aprovacao_status||"rascunho").toLowerCase();
    const pill=$("#studioApprovalStatus"), badgeEl=$("#studioVerificationBadge"), title=$("#studioVerificationTitle"), text=$("#studioVerificationText"), reason=$("#studioApprovalReason"), btn=$("#btnSolicitarAprovacao");
    const labels={rascunho:"Rascunho",pendente:"Aguardando análise",em_analise:"Em análise",aprovada:"Aprovada",rejeitada:"Rejeitada"};
    if(pill){pill.textContent=labels[status]||status;pill.className=`studio-coming-soon approval-pill ${status==="aprovada"?"approved":status==="rejeitada"?"rejected":status==="em_analise"?"analysis":"pending"}`;}
    badgeEl?.classList.toggle("verified",Boolean(c.verificada));
    if(c.verificada){if(title)title.textContent="Hamburgueria verificada pela Go-burger";if(text)text.textContent="Esta loja possui selo oficial de confiança da plataforma.";}
    else if(status==="aprovada"){if(title)title.textContent="Hamburgueria aprovada";if(text)text.textContent="A análise foi concluída. Agora você pode colocar a loja como Ativa.";}
    else if(status==="pendente"){if(title)title.textContent="Enviada para aprovação";if(text)text.textContent="A equipe Go-burger recebeu seu cadastro. Aguarde a análise antes de ativar a loja.";}
    else if(status==="em_analise"){if(title)title.textContent="Análise em andamento";if(text)text.textContent="A equipe Go-burger está revisando os dados da sua hamburgueria.";}
    else if(status==="rejeitada"){if(title)title.textContent="Ajustes necessários";if(text)text.textContent="Revise os dados indicados, salve as alterações e envie novamente para aprovação.";}
    else {if(title)title.textContent="Perfil aguardando envio";if(text)text.textContent="Complete os dados da hamburgueria e envie para aprovação. Após aprovada, você poderá ativar a loja.";}
    if(reason){const msg=String(c.motivo_rejeicao||"").trim();reason.textContent=msg?`Motivo: ${msg}`:"";reason.classList.toggle("hidden",!msg);}
    if(btn){const locked=["pendente","em_analise","aprovada"].includes(status);btn.disabled=locked;btn.innerHTML=status==="aprovada"?'<i class="fa-solid fa-circle-check"></i> Loja aprovada':status==="pendente"?'<i class="fa-solid fa-clock"></i> Aguardando análise':status==="em_analise"?'<i class="fa-solid fa-magnifying-glass"></i> Em análise':'<i class="fa-solid fa-paper-plane"></i> Enviar para aprovação';}
    const statusSelect=$("#studioStatus"); if(statusSelect){const active=statusSelect.querySelector('option[value="ativa"]');if(active){active.disabled=status!=="aprovada";active.textContent=status==="aprovada"?"Ativa":"Ativa — exige aprovação Go-burger";}}
  }

  function renderStoreStudio(){fillStoreStudio();updateStoreStudioPreview();renderApprovalStudio();}

  function selectStudioTab(name){
    $$("[data-studio-tab]").forEach(x=>x.classList.toggle("active",x.dataset.studioTab===name));
    $$("[data-studio-pane]").forEach(x=>x.classList.toggle("active",x.dataset.studioPane===name));
    if(innerWidth<760) document.querySelector('[data-section="hamburgueria"] .studio-editor-column')?.scrollIntoView({behavior:"smooth",block:"start"});
  }

  function resetStoreStudio(){
    studioDraft.slugTouched=false;
    if(studioDraft.logoObjectUrl){URL.revokeObjectURL(studioDraft.logoObjectUrl);studioDraft.logoObjectUrl=null;}
    if(studioDraft.bannerObjectUrl){URL.revokeObjectURL(studioDraft.bannerObjectUrl);studioDraft.bannerObjectUrl=null;}
    $("#studioLogoPreview")?.classList.remove("has-image");$("#publicLogoPreview")?.classList.remove("has-image");
    $("#studioCoverStage")?.classList.remove("has-image");$("#publicCoverPreview")?.classList.remove("has-image");
    if($("#studioLogoArquivo"))$("#studioLogoArquivo").value="";if($("#studioBannerArquivo"))$("#studioBannerArquivo").value="";
    fillStoreStudio();toast("Prévia visual restaurada.","info");
  }

  async function saveStoreStudioVisual(event){
    event?.preventDefault();
    if(!state.loja?.id)return toast("Nenhuma hamburgueria selecionada.","error");
    const name=studioValue("#studioNome"), slugValue=studioSlugify(studioValue("#studioSlug"));
    if(!name){selectStudioTab("identidade");$("#studioNome")?.focus();return toast("Informe o nome da hamburgueria.","error");}
    if(!slugValue){selectStudioTab("presenca");$("#studioSlug")?.focus();return toast("Informe uma URL válida para a hamburgueria.","error");}

    const form=$("#formStudioHamburgueria"), button=$("#btnSalvarStudioVisual"), savebar=document.querySelector(".studio-savebar");
    const oldLogo=storagePathFromPublicUrl(state.loja.logo_url||state.config.logo_url);
    const oldBanner=storagePathFromPublicUrl(state.loja.banner_url);
    let logoUpload=null,bannerUpload=null;
    setButton(button,true,"Salvando...");
    savebar?.classList.add("is-saving");
    if($("#studioSaveHint")){ $("#studioSaveHint").className=""; $("#studioSaveHint").textContent="Enviando alterações para o Go-burger..."; }

    try{
      const logoFile=$("#studioLogoArquivo")?.files?.[0];
      const bannerFile=$("#studioBannerArquivo")?.files?.[0];
      if(logoFile)logoUpload=await uploadStoreAsset(logoFile,"logo");
      if(bannerFile)bannerUpload=await uploadStoreAsset(bannerFile,"banner");

      const payload={
        p_loja_id:state.loja.id,
        p_nome:name,
        p_slug:slugValue,
        p_descricao:studioValue("#studioDescricao")||null,
        p_logo_url:logoUpload?.url||state.loja.logo_url||state.config.logo_url||null,
        p_banner_url:bannerUpload?.url||state.loja.banner_url||null,
        p_telefone:studioValue("#studioTelefone")||null,
        p_whatsapp:studioValue("#studioWhatsapp")||null,
        p_email_contato:studioValue("#studioEmail")||null,
        p_endereco:studioValue("#studioEndereco")||null,
        p_cidade:studioValue("#studioCidade")||null,
        p_estado:studioValue("#studioEstado")||null,
        p_cep:studioValue("#studioCep")||null,
        p_mostrar_whatsapp:studioCheckbox("#studioContatoWhatsapp",true),
        p_mostrar_telefone:studioCheckbox("#studioMostrarTelefone",true),
        p_mostrar_endereco:studioCheckbox("#studioMostrarEndereco",true),
        p_mostrar_email:studioCheckbox("#studioContatoEmail",false)
      };
      const {error}=await db.rpc("go_burger_atualizar_hamburgueria_v1",payload);
      if(error)throw error;
      // Preserva os dados atuais caso uma versão antiga do HTML esteja sem o editor do marketplace.
      const marketEditorPresent=!!$("#studioMarketplaceCategorias");
      const categoryIds=marketEditorPresent
        ? $$("#studioMarketplaceCategorias input:checked").map(x=>Number(x.value)).filter(Number.isFinite)
        : (state.lojaCategorias||[]).map(x=>Number(x.categoria_id)).filter(Number.isFinite);
      const marketResult=await db.rpc("go_burger_atualizar_marketplace_loja_v10",{
        p_loja_id:state.loja.id,
        p_slogan:$("#studioSlogan") ? (studioValue("#studioSlogan")||null) : (state.loja.slogan||null),
        p_instagram:$("#studioInstagram") ? (studioValue("#studioInstagram")||null) : (state.loja.instagram||null),
        p_cor_primaria:$("#studioCorPrimaria") ? (studioValue("#studioCorPrimaria")||"#ff6500") : (state.loja.cor_primaria||state.config.cor_primaria||"#ff6500"),
        p_cor_secundaria:$("#studioCorSecundaria") ? (studioValue("#studioCorSecundaria")||"#17100c") : (state.loja.cor_secundaria||"#17100c"),
        p_cor_destaque:$("#studioCorDestaque") ? (studioValue("#studioCorDestaque")||"#ffc928") : (state.loja.cor_destaque||"#ffc928"),
        p_tema_publico:$("#studioTemaPublico") ? (studioValue("#studioTemaPublico")||"claro") : (state.loja.tema_publico||"claro"),
        p_categoria_ids:categoryIds
      });
      if(marketResult.error)throw marketResult.error;

      const desiredStatus=studioValue("#studioStatus")||state.loja.status||"rascunho";
      if(desiredStatus==="ativa" && String(state.platformControl?.aprovacao_status||"rascunho")!=="aprovada") {
        throw new Error("Antes de ativar a loja, envie o cadastro para aprovação da Go-burger.");
      }
      if(desiredStatus!==state.loja.status){
        const statusResult=await db.rpc("go_burger_definir_status_hamburgueria_v1",{p_loja_id:state.loja.id,p_status:desiredStatus});
        if(statusResult.error)throw statusResult.error;
      }

      if(logoUpload&&oldLogo&&oldLogo!==logoUpload.path)await removeImage(oldLogo);
      if(bannerUpload&&oldBanner&&oldBanner!==bannerUpload.path)await removeImage(oldBanner);

      if(studioDraft.logoObjectUrl){URL.revokeObjectURL(studioDraft.logoObjectUrl);studioDraft.logoObjectUrl=null;}
      if(studioDraft.bannerObjectUrl){URL.revokeObjectURL(studioDraft.bannerObjectUrl);studioDraft.bannerObjectUrl=null;}
      if($("#studioLogoArquivo"))$("#studioLogoArquivo").value="";
      if($("#studioBannerArquivo"))$("#studioBannerArquivo").value="";

      const currentId=Number(state.loja.id);
      localStorage.setItem("go_burger_admin_loja_id",String(currentId));
      await loadAdminStores();
      await loadAll(true);
      renderStoreSwitcher();
      fillStoreStudio();
      if($("#studioSaveHint")){ $("#studioSaveHint").className="saved"; $("#studioSaveHint").textContent="Salvo no Go-burger agora."; }
      toast("Hamburgueria atualizada com sucesso.");
    }catch(e){
      if(logoUpload?.path)await removeImage(logoUpload.path);
      if(bannerUpload?.path)await removeImage(bannerUpload.path);
      if($("#studioSaveHint")){ $("#studioSaveHint").className="error"; $("#studioSaveHint").textContent=e.message||"Não foi possível salvar."; }
      toast(e.message||"Não foi possível salvar a hamburgueria.","error");
    }finally{
      setButton(button,false);
      savebar?.classList.remove("is-saving");
    }
  }

  function openCurrentStore(){
    if(!state.loja)return;
    if(state.loja.status==="rascunho"||state.loja.ativo===false)return toast("Ative a hamburgueria antes de abrir a página pública.","info");
    if(state.loja.status==="bloqueada")return toast("Esta hamburgueria está bloqueada pela plataforma.","error");
    open(`../cliente/cliente.html?loja=${encodeURIComponent(state.loja.slug||"loja-principal")}`,"_blank","noopener");
  }

  function fillPartnerRequestForm(form,r){
    if(!form||!r)return;
    const set=(name,value)=>{if(form.elements[name])form.elements[name].value=value??"";};
    ["nome","slug","descricao","nome_responsavel","tipo_pessoa","documento","razao_social","telefone","whatsapp","email_contato","endereco","cidade","estado","cep","instagram","horario_funcionamento","regiao_entrega","quantidade_produtos","link_atual","observacoes"].forEach(k=>set(k,r[k]));
    if(form.elements.cardapio_digital)form.elements.cardapio_digital.value=r.cardapio_digital===true?"sim":r.cardapio_digital===false?"nao":"";
    ["entrega_propria","retirada_local","consumo_local"].forEach(k=>{if(form.elements[k])form.elements[k].checked=!!r[k];});
    if(form.elements.aceite_parceiro)form.elements.aceite_parceiro.checked=true;
    if(form.elements.declaracao_veracidade)form.elements.declaracao_veracidade.checked=true;
    const slugInput=$("#novaLojaSlug");if(slugInput)slugInput.dataset.touched="1";
  }

  async function openNewStoreModal(){
    const form=$("#formNovaHamburgueria");
    if(!form)return;
    await loadPartnerRequest();
    const r=state.partnerRequest,status=String(r?.status||"").toLowerCase();
    if(["pendente","em_analise"].includes(status)){
      if(!state.loja)renderPartnerRequestStatus();
      return toast("Você já possui uma solicitação em análise. Aguarde a decisão do Super Admin.","info");
    }
    form.reset();
    const slugInput=$("#novaLojaSlug");if(slugInput){delete slugInput.dataset.touched;slugInput.value="";}
    if(r&&["aguardando_correcao","recusado"].includes(status))fillPartnerRequestForm(form,r);
    const title=$("#partnerRequestModalTitle");
    if(title)title.textContent=status==="aguardando_correcao"?"Corrigir solicitação de parceria":status==="recusado"?"Revisar solicitação de parceria":"Solicitar entrada de hamburgueria";
    openModal("modalNovaHamburgueria");
    setTimeout(()=>$("#novaLojaNome")?.focus(),120);
  }

  async function submitPartnerRequest(event){
    event?.preventDefault();
    const form=event?.currentTarget||$("#formNovaHamburgueria");
    if(!form)return;
    const button=$("#btnCriarHamburgueria");
    const nome=String(form.elements.nome?.value||"").trim();
    const slugValue=studioSlugify(form.elements.slug?.value||nome);
    const documento=String(form.elements.documento?.value||"").replace(/\D/g,"");
    if(nome.length<2)return toast("Informe o nome da hamburgueria.","error");
    if(!slugValue)return toast("Informe uma URL válida.","error");
    if(String(form.elements.nome_responsavel?.value||"").trim().length<3)return toast("Informe o nome do responsável.","error");
    if(![11,14].includes(documento.length))return toast("Informe um CPF ou CNPJ com a quantidade correta de dígitos.","error");
    if(!String(form.elements.endereco?.value||"").trim()||!String(form.elements.cidade?.value||"").trim()||String(form.elements.estado?.value||"").trim().length!==2)return toast("Informe endereço, cidade e a sigla do estado.","error");
    if(!form.elements.entrega_propria?.checked&&!form.elements.retirada_local?.checked&&!form.elements.consumo_local?.checked)return toast("Selecione pelo menos uma forma de atendimento.","error");
    if(!form.elements.declaracao_veracidade?.checked)return toast("Confirme que as informações fornecidas são verdadeiras.","error");
    if(!form.elements.aceite_parceiro?.checked)return toast("Aceite os Termos dos Parceiros para enviar a solicitação.","error");
    setButton(button,true,"Enviando...");
    try{
      const {data:launchGate,error:launchGateError}=await db.rpc("go_burger_plataforma_publica_v1");
      if(launchGateError)throw new Error("Não foi possível validar a abertura de novas solicitações. Tente novamente mais tarde.");
      if(launchGate?.manutencao||launchGate?.partner_applications_enabled===false)throw new Error(launchGate?.manutencao_mensagem||"Novas solicitações de parceria estão temporariamente indisponíveis.");
      const digital=String(form.elements.cardapio_digital?.value||"");
      const {data,error}=await db.rpc("go_burger_enviar_solicitacao_parceiro_v1",{
        p_nome:nome,p_slug:slugValue,
        p_descricao:String(form.elements.descricao?.value||"").trim()||null,
        p_nome_responsavel:String(form.elements.nome_responsavel?.value||"").trim(),
        p_tipo_pessoa:String(form.elements.tipo_pessoa?.value||"pj"),
        p_documento:documento,
        p_razao_social:String(form.elements.razao_social?.value||"").trim()||null,
        p_telefone:String(form.elements.telefone?.value||"").trim()||null,
        p_whatsapp:String(form.elements.whatsapp?.value||"").trim()||null,
        p_email_contato:String(form.elements.email_contato?.value||"").trim()||null,
        p_endereco:String(form.elements.endereco?.value||"").trim(),
        p_cidade:String(form.elements.cidade?.value||"").trim(),
        p_estado:String(form.elements.estado?.value||"").trim().toUpperCase(),
        p_cep:String(form.elements.cep?.value||"").trim()||null,
        p_instagram:String(form.elements.instagram?.value||"").trim()||null,
        p_horario_funcionamento:String(form.elements.horario_funcionamento?.value||"").trim()||null,
        p_entrega_propria:!!form.elements.entrega_propria?.checked,
        p_retirada_local:!!form.elements.retirada_local?.checked,
        p_consumo_local:!!form.elements.consumo_local?.checked,
        p_regiao_entrega:String(form.elements.regiao_entrega?.value||"").trim()||null,
        p_quantidade_produtos:form.elements.quantidade_produtos?.value?Number(form.elements.quantidade_produtos.value):null,
        p_cardapio_digital:digital==="sim"?true:digital==="nao"?false:null,
        p_link_atual:String(form.elements.link_atual?.value||"").trim()||null,
        p_observacoes:String(form.elements.observacoes?.value||"").trim()||null,
        p_aceite_termos:true,p_declaracao_veracidade:true
      });
      if(error)throw error;
      if(data?.loja_criada===true)throw new Error("Falha de segurança: a solicitação não deveria criar uma hamburgueria automaticamente.");
      try{await db.rpc("go_burger_aceitar_termo_v1",{p_tipo:"parceiro",p_versao:"1.2",p_aceito:true,p_origem:"solicitacao_parceria"});}catch(error){console.warn("aceite parceiro",error.message);}
      await loadPartnerRequest();
      closeModal("modalNovaHamburgueria");
      form.reset();
      const slugInput=$("#novaLojaSlug");if(slugInput)delete slugInput.dataset.touched;
      if(!state.loja){showPartnerOnboarding();renderPartnerRequestStatus();}
      toast("Solicitação enviada. Nenhuma hamburgueria foi criada; agora ela aguarda sua aprovação pelo Super Admin.");
    }catch(e){
      toast(e.message||"Não foi possível enviar a solicitação de parceria.","error");
    }finally{setButton(button,false);}
  }

  async function requestStoreApproval(){
    if(!state.loja?.id)return toast("Nenhuma hamburgueria selecionada.","error");
    const btn=$("#btnSolicitarAprovacao"); setButton(btn,true,"Enviando...");
    try{
      const {error}=await db.rpc("go_burger_solicitar_aprovacao_v1",{p_loja_id:state.loja.id});
      if(error)throw error;
      const {data:control,error:controlError}=await db.from("loja_controle_plataforma").select("*").eq("loja_id",state.loja.id).maybeSingle();
      if(controlError)throw controlError; state.platformControl=control||{}; renderApprovalStudio();
      toast("Solicitação de publicação enviada ao Super Admin da Go-burger.");
    }catch(e){toast(e.message||"Não foi possível enviar para aprovação.","error");}
    finally{setButton(btn,false);renderApprovalStudio();}
  }

  function openStudioMobilePreview(){
    const mount=$("#studioModalPreviewMount"),source=$("#studioDevicePreview");if(!mount||!source)return;
    mount.innerHTML="";const clone=source.cloneNode(true);clone.removeAttribute("id");clone.classList.remove("desktop");clone.classList.add("mobile");mount.appendChild(clone);openModal("modalStudioMobile");
  }

  async function copyStudioUrl(){
    const text=$("#studioUrlPreview")?.textContent||"";if(!text)return;
    try{await navigator.clipboard.writeText(text);toast("Link da loja copiado.");}catch{toast("Copie manualmente: "+text,"info");}
  }

  function autoPrintEnabled(){return localStorage.getItem("go_burger_auto_print")==="1";}
  function updateAutoPrintButton(){const b=$("#btnAutoPrint");if(!b)return;const on=autoPrintEnabled();b.classList.toggle("active",on);b.setAttribute("aria-pressed",on?"true":"false");b.innerHTML=`<i class="fa-solid fa-print"></i> Impressão automática: ${on?"ON":"OFF"}`;}
  function toggleAutoPrint(){localStorage.setItem("go_burger_auto_print",autoPrintEnabled()?"0":"1");updateAutoPrintButton();toast(autoPrintEnabled()?"Impressão automática ativada.":"Impressão automática desativada.","info");}

  function playSound(){if(!soundEnabled())return;try{const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;const c=new AC(),o=c.createOscillator(),g=c.createGain();o.connect(g);g.connect(c.destination);o.frequency.value=880;g.gain.setValueAtTime(.1,c.currentTime);g.gain.exponentialRampToValueAtTime(.001,c.currentTime+.25);o.start();o.stop(c.currentTime+.25);}catch{}}

  function startRealtime(){
    if(state.realtime){try{db.removeChannel(state.realtime);}catch{}}
    if(!state.loja?.id)return;
    const lojaId=state.loja.id,dot=$("#realtimeDot"),text=$("#statusRealtime");let timer;
    const refresh=()=>{clearTimeout(timer);timer=setTimeout(()=>loadAll(true),300);};
    const onChange=payload=>{if(Number(payload?.new?.loja_id||payload?.old?.loja_id)!==Number(lojaId))return;if(payload?.table==="pedidos"&&payload?.eventType==="INSERT"){
      playSound();toast("Novo pedido recebido!","info");
      if(autoPrintEnabled()&&payload?.new?.id)setTimeout(()=>printOrder(payload.new.id,"automatico"),850);
    }
    refresh();};
    let channel=db.channel(`go-burger-admin-${lojaId}`);
    ["pedidos","produtos","configuracoes","cupons","notificacoes","banners","bairros_entrega","horarios_funcionamento","avaliacoes","fidelidade_movimentos","fidelidade_resgates","fidelidade_recompensas","ofertas_upsell"].forEach(table=>{channel=channel.on("postgres_changes",{event:"*",schema:"public",table,filter:`loja_id=eq.${lojaId}`},onChange);});
    state.realtime=channel.subscribe(status=>{dot?.classList.remove("online","error");if(status==="SUBSCRIBED"){dot?.classList.add("online");if(text)text.textContent="Go-burger Realtime ativo";}else if(["CHANNEL_ERROR","TIMED_OUT","CLOSED"].includes(status)){dot?.classList.add("error");if(text)text.textContent="Realtime indisponível";}else if(text)text.textContent="Conectando...";});
  }

  async function initPanel(){applyTheme();updateSoundIcon();updateAutoPrintButton();updateAdminUI();await loadAll(true);renderStoreSwitcher();startRealtime();navigate(pages[location.hash.slice(1)]?location.hash.slice(1):"dashboard",false);await handleMercadoPagoReturn();}

  function globalSearch(value){const q=String(value||"").trim().toLowerCase();if(q.length<2)return;const p=state.produtos.find(x=>`${x.nome} ${x.categoria}`.toLowerCase().includes(q));if(p){navigate("produtos");$("#pesquisaProduto").value=q;renderProducts();return;}const o=state.pedidos.find(x=>`${x.id} ${x.cliente_nome||""} ${x.telefone||""}`.toLowerCase().includes(q));if(o){navigate("pedidos");$("#pesquisaPedido").value=q;renderOrders();return;}const c=state.clientes.find(x=>`${x.nome||""} ${x.email||""} ${x.telefone||""}`.toLowerCase().includes(q));if(c){navigate("clientes");$("#pesquisaCliente").value=q;renderClients();return;}toast("Nenhum resultado encontrado.","info");}

  $("#formAdminLogin")?.addEventListener("submit",signIn);
  $("#btnRecuperarSenha")?.addEventListener("click",recoverPassword);
  $("#btnSair")?.addEventListener("click",signOut);
  $("#menuMobile")?.addEventListener("click",openMobile);$("#mobileOverlay")?.addEventListener("click",closeMobile);
  $("#btnPrinterTest")?.addEventListener("click",printPrinterTest);$("#btnPrinterConnect")?.addEventListener("click",connectSerialPrinter);$("#printerPaperWidth")?.addEventListener("change",savePrinterSettings);$("#printerMode")?.addEventListener("change",savePrinterSettings);$("#printerBaud")?.addEventListener("change",savePrinterSettings);$("#printerAutoPrint")?.addEventListener("change",savePrinterSettings);$("#btnExportFinancial")?.addEventListener("click",exportFinancial);$("#btnSom")?.addEventListener("click",toggleSound);$("#btnAutoPrint")?.addEventListener("click",toggleAutoPrint);$("#btnStoreLocation")?.addEventListener("click",captureStoreLocation);
  $("#perfilAdmin")?.addEventListener("click",()=>navigate("configuracoes"));
  $("#btnAtualizar")?.addEventListener("click",async()=>{const b=$("#btnAtualizar");b.classList.add("loading");await loadAll(true);b.classList.remove("loading");toast("Dados atualizados.");});
  $("#btnNotificacoes")?.addEventListener("click",()=>navigate("notificacoes"));
  $("#btnEstudioLoja")?.addEventListener("click",()=>navigate("hamburgueria"));
  $("#btnNovaHamburgueria")?.addEventListener("click",openNewStoreModal);
  $("#btnAbrirLojaStudio")?.addEventListener("click",openCurrentStore);
  $("#btnPreviewMobileLoja")?.addEventListener("click",openStudioMobilePreview);
  $("#btnSelecionarLogoStudio")?.addEventListener("click",()=>$("#studioLogoArquivo")?.click());
  $("#btnSelecionarBannerStudio")?.addEventListener("click",()=>$("#studioBannerArquivo")?.click());
  $("#btnResetStudio")?.addEventListener("click",resetStoreStudio);
  $("#btnCopiarUrlStudio")?.addEventListener("click",copyStudioUrl);
  $("#btnSolicitarAprovacao")?.addEventListener("click",requestStoreApproval);
  $("#btnOnboardingNovaHamburgueria")?.addEventListener("click",openNewStoreModal);
  $("#btnOnboardingVoltar")?.addEventListener("click",()=>{if(parent!==window){parent.postMessage({type:"go-burger-mode",mode:"cliente"},location.origin);}else{location.href="../burger/index.html?modo=cliente";}});
  $("#formStudioHamburgueria")?.addEventListener("submit",saveStoreStudioVisual);
  ["#studioSlogan","#studioInstagram","#studioCorPrimaria","#studioCorSecundaria","#studioCorDestaque","#studioTemaPublico"].forEach(sel=>$(sel)?.addEventListener("input",updateStoreStudioPreview));
  $("#formNovaHamburgueria")?.addEventListener("submit",submitPartnerRequest);
  $("#novaLojaNome")?.addEventListener("input",e=>{const s=$("#novaLojaSlug");if(s&&!s.dataset.touched)s.value=studioSlugify(e.target.value);});
  $("#novaLojaSlug")?.addEventListener("input",e=>{e.target.dataset.touched="1";e.target.value=studioSlugify(e.target.value);});
  $("#teamForm")?.addEventListener("submit",addTeamMember);
  $("#adminLojaSelect")?.addEventListener("change",e=>switchAdminStore(e.target.value));
  $("#btnAbrirLoja")?.addEventListener("click",openCurrentStore);$("#btnAbrirLojaDashboard")?.addEventListener("click",openCurrentStore);
  $("#btnToggleLojaRapido")?.addEventListener("click",toggleStoreQuick);$("#btnModoCozinha")?.addEventListener("click",toggleKitchen);$("#btnAtualizarOperacao")?.addEventListener("click",()=>loadAll(false));
  $("#btnNovoProduto")?.addEventListener("click",newProduct);$("#formProduto")?.addEventListener("submit",saveProduct);$("#formEstoque")?.addEventListener("submit",saveStock);
  $("#btnNovoGrupo")?.addEventListener("click",newGroup);$("#formGrupo")?.addEventListener("submit",saveGroup);$("#btnAdicionarOpcaoGrupo")?.addEventListener("click",()=>$("#grupoOpcoesEditor")?.insertAdjacentHTML("beforeend",optionEditorRow()));
  $("#btnAdicionarIngrediente")?.addEventListener("click",()=>$("#produtoIngredientesEditor")?.insertAdjacentHTML("beforeend",ingredientRow()));$("#btnSalvarPersonalizacaoProduto")?.addEventListener("click",saveCustomization);
  $("#btnNovoBanner")?.addEventListener("click",newBanner);$("#formBanner")?.addEventListener("submit",saveBanner);$("#btnNovoUpsell")?.addEventListener("click",newUpsell);$("#formUpsell")?.addEventListener("submit",saveUpsell);
  $("#btnNovoCupom")?.addEventListener("click",newCoupon);$("#formCupom")?.addEventListener("submit",saveCoupon);$("#cupomTipo")?.addEventListener("change",syncCouponFields);
  $("#btnNovoBairro")?.addEventListener("click",newNeighborhood);$("#formBairro")?.addEventListener("submit",saveNeighborhood);$("#btnSalvarHorarios")?.addEventListener("click",saveHours);
  $("#btnNovaRecompensa")?.addEventListener("click",newReward);$("#formRecompensa")?.addEventListener("submit",saveReward);
  $("#formConfiguracoes")?.addEventListener("submit",saveConfig);$("#btnRodarDiagnostico")?.addEventListener("click",runDiagnostic);$("#btnMarcarTodasLidas")?.addEventListener("click",readAllNotifications);
  $("#btnEncerrarHamburgueria")?.addEventListener("click",closeStoreLifecycle);$("#btnReabrirHamburgueria")?.addEventListener("click",reopenStoreLifecycle);
  $("#btnLimparAdminLogs")?.addEventListener("click",openLogDeleteConfirmation);

  /* Eventos delegados: funcionam mesmo se o modal for criado dinamicamente */
  document.addEventListener("click",e=>{
    const target=e.target;
    if(target.closest?.("#btnCancelarExclusaoLogs")||target.closest?.("#btnFecharConfirmacaoLogs")){
      closeLogDeleteConfirmation();
      return;
    }
    if(target.closest?.("#btnConfirmarExclusaoLogs")){
      clearAdminLogs();
      return;
    }
    if(target.id==="confirmarExclusaoLogs")closeLogDeleteConfirmation();
  });
  $("#btnExportarPedidos")?.addEventListener("click",exportOrders);$("#btnExportarProdutos")?.addEventListener("click",exportProducts);$("#btnExportarBackup")?.addEventListener("click",exportBackup);$("#btnExportarPedidosConfig")?.addEventListener("click",exportOrders);$("#btnExportarProdutosConfig")?.addEventListener("click",exportProducts);$("#btnExportarRelatorio")?.addEventListener("click",exportReport);
  $("#periodoGrafico")?.addEventListener("change",renderChart);$("#periodoRelatorios")?.addEventListener("change",renderReports);$("#driverForm")?.addEventListener("submit",saveDriver);$("#assignDeliveryForm")?.addEventListener("submit",assignDelivery);$("#driverInviteForm")?.addEventListener("submit",createDriverInvite);$("#btnInviteDriver")?.addEventListener("click",()=>openModal("modalConviteEntregador"));$("#btnCancelSubscription")?.addEventListener("click",requestSubscriptionCancellation);$("#btnConnectMercadoPago")?.addEventListener("click",connectMercadoPago);$("#btnDisconnectMercadoPago")?.addEventListener("click",disconnectMercadoPago);$("#btnEnableRecurringBilling")?.addEventListener("click",enableRecurringBilling);$("#btnSyncRecurringBilling")?.addEventListener("click",()=>syncRecurringBilling());
  $("#pesquisaProduto")?.addEventListener("input",renderProducts);$("#filtroCategoria")?.addEventListener("change",renderProducts);$("#filtroStatusProduto")?.addEventListener("change",renderProducts);$("#filtroDestaqueProduto")?.addEventListener("change",renderProducts);
  $("#pesquisaPedido")?.addEventListener("input",renderOrders);$("#filtroStatusPedido")?.addEventListener("change",renderOrders);$("#filtroPagamentoPedido")?.addEventListener("change",renderOrders);$("#filtroTipoEntregaPedido")?.addEventListener("change",renderOrders);$("#filtroPeriodoPedido")?.addEventListener("change",renderOrders);
  $("#pesquisaEstoque")?.addEventListener("input",renderStock);$("#filtroEstoque")?.addEventListener("change",renderStock);$("#pesquisaPersonalizacaoProduto")?.addEventListener("input",renderGroups);$("#pesquisaCliente")?.addEventListener("input",renderClients);$("#filtroSegmentoCliente")?.addEventListener("change",renderClients);
  $("#buscaGlobal")?.addEventListener("keydown",e=>{if(e.key==="Enter")globalSearch(e.target.value);});
  document.addEventListener("click",async e=>{const b=e.target.closest?.("[data-copy-driver-invite]");if(!b)return;try{await navigator.clipboard.writeText(b.dataset.copyDriverInvite);toast("Link do convite copiado.")}catch{toast("Não foi possível copiar automaticamente.","error")}});
  $("#produtoImagemArquivo")?.addEventListener("change",e=>{const f=e.target.files?.[0];if(f)$("#produtoImagemPreview").src=URL.createObjectURL(f);});
  $("#bannerImagemArquivo")?.addEventListener("change",e=>{const f=e.target.files?.[0];if(f)$("#bannerImagemPreview").src=URL.createObjectURL(f);});
  $("#configLogoArquivo")?.addEventListener("change",e=>{const f=e.target.files?.[0];if(f)$("#logoPreview").src=URL.createObjectURL(f);});

  $$("[data-studio-tab]").forEach(b=>b.addEventListener("click",()=>selectStudioTab(b.dataset.studioTab)));
  $$("[data-preview-device]").forEach(b=>b.addEventListener("click",()=>{$$("[data-preview-device]").forEach(x=>x.classList.toggle("active",x===b));const p=$("#studioDevicePreview");if(p){p.classList.toggle("desktop",b.dataset.previewDevice==="desktop");p.classList.toggle("mobile",b.dataset.previewDevice!=="desktop");}}));
  ["#studioNome","#studioDescricao","#studioTelefone","#studioWhatsapp","#studioEmail","#studioCep","#studioEndereco","#studioCidade","#studioEstado","#studioStatus","#studioPrioridade"].forEach(id=>$(id)?.addEventListener("input",e=>{if(id==="#studioNome"&&!studioDraft.slugTouched){const slug=$("#studioSlug");if(slug)slug.value=studioSlugify(e.target.value);}updateStoreStudioPreview();}));
  $("#studioSlug")?.addEventListener("input",e=>{studioDraft.slugTouched=true;const start=e.target.selectionStart;e.target.value=studioSlugify(e.target.value);try{e.target.setSelectionRange(start,start);}catch{}updateStoreStudioPreview();});
  $("#studioCep")?.addEventListener("input",e=>{let v=e.target.value.replace(/\D/g,"").slice(0,8);e.target.value=v.length>5?v.slice(0,5)+"-"+v.slice(5):v;updateStoreStudioPreview();});
  $("#studioLogoArquivo")?.addEventListener("change",e=>studioSetImage(e.target,$("#studioLogoPreview"),$("#studioLogoImg"),"logoObjectUrl",$("#publicLogoPreview"),$("#publicLogoImg")));
  $("#studioBannerArquivo")?.addEventListener("change",e=>studioSetImage(e.target,$("#studioCoverStage"),$("#studioBannerPreview"),"bannerObjectUrl",$("#publicCoverPreview"),$("#publicBannerImg")));
  ["#studioContatoWhatsapp","#studioMostrarTelefone","#studioMostrarEndereco","#studioContatoEmail"].forEach(id=>$(id)?.addEventListener("change",updateStoreStudioPreview));

  $("#plansCouponPreviewForm")?.addEventListener("submit",previewPlanCouponP660);
  $("#plansFiscalForm")?.addEventListener("submit",savePlanFiscalP660);
  $("#plansPauseButton")?.addEventListener("click",requestPlanPauseP660);
  $("#plansReactivateButton")?.addEventListener("click",reactivatePlanP660);
  $("#plansCancelButton")?.addEventListener("click",requestPlanCancellationP660);
  $("#plansSandboxCheckoutForm")?.addEventListener("submit",createPlanSandboxCheckoutP660);
  $("#plansReconcileSandbox")?.addEventListener("click",reconcilePlanSandboxP660);
  $("#plansSandboxE2E")?.addEventListener("click",runPlanSandboxE2EP700);
  $("#plansSimulatorForm")?.addEventListener("submit",async e=>{e.preventDefault();state.planRevenueEstimate=Math.max(0,Number($("#plansRevenueEstimate")?.value||0));localStorage.setItem("go-burger-plan-revenue",String(state.planRevenueEstimate));await reloadPlanPortal();toast("Simulação atualizada.","info");});
  document.addEventListener("click",e=>{const b=e.target.closest("[data-plan-retry]");if(!b)return;reloadPlanPortal();});
  document.addEventListener("click",async e=>{const b=e.target.closest("[data-trial-free]");if(!b)return;if(!confirm("Encerrar o trial e voltar ao plano Grátis?"))return;setButton(b,true,"Voltando...");try{const {error}=await db.rpc("go_burger_trial_encerrar_gratis_v627",{p_loja_id:Number(state.loja.id)});if(error)throw error;await reloadPlanPortal();toast("Plano Grátis restaurado sem cobrança.");}catch(err){toast(err.message||"Não foi possível encerrar o trial.","error");}finally{setButton(b,false);}});
  $$('[data-page]').forEach(b=>b.addEventListener("click",()=>navigate(b.dataset.page)));
  $$('[data-close]').forEach(b=>b.addEventListener("click",()=>closeModal(b.dataset.close)));
  $$(".modal").forEach(m=>m.addEventListener("click",e=>{if(e.target===m)closeModal(m.id);}));

  document.addEventListener("change",e=>{const s=e.target.closest?.("[data-order-status]");if(s)return updateOrderStatus(s.dataset.orderStatus,s.value,s);const p=e.target.closest?.("[data-order-priority]");if(p)return updateOrderPriority(p.dataset.orderPriority,p.value,p);});
  document.addEventListener("keydown",e=>{if(e.key==="Escape"){$$(".modal.active").forEach(m=>closeModal(m.id));closeLogDeleteConfirmation();closeMobile();}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"){e.preventDefault();$("#buscaGlobal")?.focus();}});

  document.addEventListener("click",async e=>{
    const el=sel=>e.target.closest?.(sel);
    if(el("[data-team-status]"))return setTeamStatus(el("[data-team-status]").dataset.teamStatus,el("[data-team-status]").dataset.teamActive==="1");
    if(el("[data-toggle-password]")){const b=el("[data-toggle-password]"),input=b.closest(".password-field")?.querySelector("input")||b.closest(".input-password")?.querySelector("input")||b.closest(".input-senha")?.querySelector("input");if(input){input.type=input.type==="text"?"password":"text";const i=b.querySelector("i");if(i)i.className=input.type==="text"?"fa-regular fa-eye-slash":"fa-regular fa-eye";}return;}
    if(el('[data-action="novo-produto"]'))return newProduct();if(el('[data-action="novo-grupo"]'))return newGroup();if(el('[data-action="novo-banner"]'))return newBanner();if(el('[data-action="novo-cupom"]'))return newCoupon();if(el('[data-action="exportar-pedidos"]'))return exportOrders();
    if(el("[data-edit-product]"))return editProduct(el("[data-edit-product]").dataset.editProduct);if(el("[data-custom-product]"))return openCustomization(el("[data-custom-product]").dataset.customProduct);if(el("[data-stock-product]"))return openStock(el("[data-stock-product]").dataset.stockProduct);if(el("[data-toggle-product]"))return toggleProduct(el("[data-toggle-product]").dataset.toggleProduct);
    if(el("[data-stock-delta]"))return quickStock(el("[data-stock-delta]").dataset.productId,Number(el("[data-stock-delta]").dataset.stockDelta));
    if(el("[data-request-refund]"))return requestRefund(el("[data-request-refund]").dataset.requestRefund);
    if(el("[data-plan-cycle]")){state.planCycle=el("[data-plan-cycle]").dataset.planCycle;localStorage.setItem("go-burger-plan-cycle",state.planCycle);renderPlansPortal();return;}
    if(el("[data-plan-subscribe]"))return selectPlanV613(el("[data-plan-subscribe]").dataset.planSubscribe,"assinatura",el("[data-plan-subscribe]"));
    if(el("[data-plan-trial]"))return selectPlanV613(el("[data-plan-trial]").dataset.planTrial,"trial",el("[data-plan-trial]"));
    if(el("[data-plan-cancel-pending]"))return cancelPendingPlanV613(el("[data-plan-cancel-pending]"));
    if(el("[data-change-plan]"))return changePlan(el("[data-change-plan]").dataset.changePlan);
    if(el("[data-start-trial]"))return startPlanTrial(el("[data-start-trial]").dataset.startTrial);
    if(el("[data-order-details]"))return openOrder(el("[data-order-details]").dataset.orderDetails);if(el("[data-print-order]"))return printOrder(el("[data-print-order]").dataset.printOrder);if(el("[data-next-order]")){const id=el("[data-next-order]").dataset.nextOrder,o=state.pedidos.find(x=>Number(x.id)===Number(id)),next=o&&nextStatus(o.status);if(next)return updateOrderStatus(id,next);}
    if(el("[data-save-order]")){const id=el("[data-save-order]").dataset.saveOrder;await updateOrderStatus(id,$("#modalOrderStatus")?.value||"Recebido");await updatePayment(id,$("#modalPaymentStatus")?.value||"Pendente");return;}
    if(el("[data-edit-group]"))return editGroup(el("[data-edit-group]").dataset.editGroup);if(el("[data-delete-group]"))return deleteGroup(el("[data-delete-group]").dataset.deleteGroup);if(el("[data-remove-option]")){el("[data-remove-option]").closest(".option-editor-row")?.remove();return;}if(el("[data-remove-ingredient]")){el("[data-remove-ingredient]").closest(".ingredient-editor-row")?.remove();return;}
    if(el("[data-edit-banner]"))return editBanner(el("[data-edit-banner]").dataset.editBanner);if(el("[data-toggle-banner]"))return toggleBanner(el("[data-toggle-banner]").dataset.toggleBanner);if(el("[data-delete-banner]"))return deleteBanner(el("[data-delete-banner]").dataset.deleteBanner);
    if(el("[data-edit-upsell]"))return editUpsell(el("[data-edit-upsell]").dataset.editUpsell);if(el("[data-delete-upsell]"))return deleteUpsell(el("[data-delete-upsell]").dataset.deleteUpsell);
    if(el("[data-edit-coupon]"))return editCoupon(el("[data-edit-coupon]").dataset.editCoupon);if(el("[data-toggle-coupon]"))return toggleCoupon(el("[data-toggle-coupon]").dataset.toggleCoupon);if(el("[data-delete-coupon]"))return deleteCoupon(el("[data-delete-coupon]").dataset.deleteCoupon);
    if(el("[data-client-details]"))return openClient(el("[data-client-details]").dataset.clientDetails);if(el("[data-adjust-points]"))return adjustPoints(el("[data-adjust-points]").dataset.adjustPoints);
    if(el("[data-edit-reward]"))return editReward(el("[data-edit-reward]").dataset.editReward);if(el("[data-delete-reward]"))return deleteReward(el("[data-delete-reward]").dataset.deleteReward);if(el("[data-toggle-review]"))return toggleReview(el("[data-toggle-review]").dataset.toggleReview);
    if(el("[data-edit-neighborhood]"))return editNeighborhood(el("[data-edit-neighborhood]").dataset.editNeighborhood);if(el("[data-delete-neighborhood]"))return deleteNeighborhood(el("[data-delete-neighborhood]").dataset.deleteNeighborhood);if(el("[data-read-notification]"))return readNotification(el("[data-read-notification]").dataset.readNotification);
  });

  db.auth.onAuthStateChange((event,session)=>{if(event==="SIGNED_OUT")showLogin();if(event==="TOKEN_REFRESHED"&&session?.user)state.user=session.user;});

  try {
    const {data,error}=await db.auth.getSession();if(error)throw error;
    if(!data.session?.user){showLogin();return;}
    state.user=data.session.user;state.profile=await adminProfile(state.user);await ensurePlatformAccess();await loadAdminStores();await loadPartnerRequest();if(!state.loja)showPartnerOnboarding();else{showPanel();await initPanel();}
  } catch(e){console.error(e);showLogin(e.message||"Não foi possível restaurar a sessão.");}
});
