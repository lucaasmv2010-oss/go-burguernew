"use strict";

(() => {
  const SUPABASE_URL = "https://ethlgaszdextwckdwgsf.supabase.co";
  const SUPABASE_KEY = "sb_publishable_qEhxWcCbekPjYFUW-EQ1ow_xccHG8aJ";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = v => String(v ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  const money = v => Number(v || 0).toLocaleString("pt-BR", { style:"currency", currency:"BRL" });
  const num = (v, f = 0) => Number.isFinite(Number(v)) ? Number(v) : f;
  const dt = v => v ? new Date(v).toLocaleString("pt-BR", { dateStyle:"short", timeStyle:"short" }) : "—";
  const dateISO = d => d ? new Date(d).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);

  let db;
  let user;
  let storeId = 0;
  let products = [];
  let ingredients = [];
  let currentHealth = null;
  let currentThreads = [];
  let currentChatOrder = null;
  let modalBound = false;
  let featureState = null;

  function toast(message, type = "success") {
    if (window.GoBurgerUI?.toast) return window.GoBurgerUI.toast(message, type);
    const wrap = $("#toastContainer") || document.body;
    const n = document.createElement("div");
    n.className = `toast ${type}`;
    n.textContent = message;
    wrap.appendChild(n);
    setTimeout(() => n.remove(), 4300);
  }

  function empty(icon, title, text) {
    return `<div class="gbp2-empty"><i class="fa-solid ${icon}"></i><strong>${esc(title)}</strong><p>${esc(text)}</p></div>`;
  }

  function badge(text, kind = "orange") {
    return `<span class="gbp2-badge ${kind}">${esc(text)}</span>`;
  }

  function currentStoreId() {
    return Number(localStorage.getItem("go_burger_admin_loja_id") || storeId || 0);
  }

  async function sessionReady() {
    if (!window.supabase?.createClient) return false;
    db ||= window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession:true, autoRefreshToken:true, detectSessionInUrl:true, storageKey:"go-burger-auth-v1" }
    });
    const { data, error } = await db.auth.getSession();
    if (error || !data.session?.user) return false;
    user = data.session.user;
    storeId = currentStoreId();
    return Boolean(storeId);
  }

  async function rpc(name, params = {}) {
    const { data, error } = await db.rpc(name, params);
    if (error) throw error;
    return data;
  }

  async function featureEnabled(key) {
    try {
      if (!featureState) featureState = await rpc("go_burger_features_v32", { p_loja_id:currentStoreId() });
      return featureState?.[key]?.ativo !== false;
    } catch { return true; }
  }

  function featureOff(root, title) {
    root.innerHTML = `<div class="gbp2-alert"><i class="fa-solid fa-toggle-off"></i><div><strong>${esc(title)} está desativado.</strong><br>O recurso foi desligado por uma Feature Flag da Go-burger para esta hamburgueria.</div></div>`;
  }

  async function queryProducts() {
    const id = currentStoreId();
    const { data, error } = await db.from("produtos").select("id,nome,categoria,preco,estoque,estoque_minimo,ativo,status").eq("loja_id", id).order("nome");
    if (error) throw error;
    products = data || [];
    return products;
  }

  function bindTabs(root) {
    $$("[data-gbp2-tab]", root).forEach(btn => btn.addEventListener("click", () => {
      const tab = btn.dataset.gbp2Tab;
      $$("[data-gbp2-tab]", root).forEach(x => x.classList.toggle("active", x === btn));
      $$("[data-gbp2-panel]", root).forEach(x => x.classList.toggle("active", x.dataset.gbp2Panel === tab));
    }));
  }

  function openModal(html, small = false) {
    let modal = $("#gbp2AdminModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "gbp2AdminModal";
      modal.className = "gbp2-modal";
      modal.innerHTML = `<div class="gbp2-modal-card"><button class="gbp2-modal-close" type="button" data-gbp2-close><i class="fa-solid fa-xmark"></i></button><div id="gbp2AdminModalBody"></div></div>`;
      document.body.appendChild(modal);
    }
    const card = modal.querySelector(".gbp2-modal-card");
    card.classList.toggle("small", small);
    $("#gbp2AdminModalBody").innerHTML = html;
    modal.classList.add("active");
    if (!modalBound) {
      modal.addEventListener("click", e => {
        if (e.target === modal || e.target.closest("[data-gbp2-close]")) modal.classList.remove("active");
      });
      modalBound = true;
    }
    return modal;
  }

  /* =====================================================
     PACOTE 32 — ONBOARDING / SAÚDE
     ===================================================== */
  async function loadActivation() {
    const root = $("#gb32ActivationRoot");
    if (!root || !(await sessionReady())) return;
    if (!(await featureEnabled("onboarding_v32"))) return featureOff(root,"Onboarding guiado");
    root.innerHTML = `<div class="gbp2-skeleton"></div><div class="gbp2-skeleton"></div>`;
    try {
      currentHealth = await rpc("go_burger_loja_saude_v32", { p_loja_id:currentStoreId() });
      renderActivation(root, currentHealth || {});
    } catch (e) {
      root.innerHTML = empty("fa-triangle-exclamation", "Não foi possível calcular a saúde da loja", e.message || "Tente novamente.");
    }
  }

  function renderActivation(root, health) {
    const score = num(health.score);
    const items = Array.isArray(health.itens) ? health.itens : [];
    const pending = Array.isArray(health.pendencias) ? health.pendencias : [];
    const okCount = items.filter(x => x.ok).length;
    root.innerHTML = `
      <div class="gbp2-shell">
        <section class="gbp2-hero">
          <span class="gbp2-eyebrow"><i class="fa-solid fa-wand-magic-sparkles"></i> PACOTE 32 · ATIVAÇÃO GUIADA</span>
          <h2>Sua hamburgueria pronta para vender, sem adivinhação.</h2>
          <p>A Go-burger verifica automaticamente os pontos essenciais da operação e mostra exatamente o que falta para a loja ficar saudável.</p>
          <div class="gbp2-hero-actions">
            <button class="gbp2-btn primary" type="button" data-gb32-refresh><i class="fa-solid fa-rotate"></i> Recalcular saúde</button>
            ${score >= 90 ? `<button class="gbp2-btn success" type="button" data-gb32-complete><i class="fa-solid fa-circle-check"></i> Concluir onboarding</button>` : ""}
          </div>
        </section>
        <div class="gbp2-grid wide-left">
          <article class="gbp2-card">
            <div class="gbp2-card-head"><div><span class="gbp2-eyebrow">CHECKLIST INTELIGENTE</span><h3>${okCount} de ${items.length} áreas configuradas</h3><p>O score é recalculado diretamente com os dados reais da hamburgueria.</p></div><i class="fa-solid fa-list-check"></i></div>
            <div class="gbp2-checklist">
              ${items.map(i => `<div class="gbp2-check ${i.ok ? "ok" : ""}"><i class="fa-solid ${i.ok ? "fa-check" : "fa-arrow-right"}"></i><div class="grow"><strong>${esc(i.titulo)}</strong><small>${i.ok ? "Configurado" : "Precisa de atenção"}</small></div><span class="weight">${num(i.peso)}%</span>${!i.ok ? `<button class="gbp2-btn tiny soft" data-gb32-goto="${esc(i.pagina || "hamburgueria")}" type="button">Resolver</button>` : ""}</div>`).join("")}
            </div>
          </article>
          <article class="gbp2-card">
            <div class="gbp2-card-head"><div><span class="gbp2-eyebrow">SAÚDE DA LOJA</span><h3>${score >= 90 ? "Pronta para operar" : "Ainda há ajustes"}</h3></div><i class="fa-solid fa-heart-pulse"></i></div>
            <div class="gbp2-score"><div class="gbp2-score-ring" style="--score:${Math.max(0, Math.min(score, 100))}"><strong>${score}%</strong></div><div><strong style="font-size:1.05rem;color:var(--gbp2-ink)">${score >= 90 ? "Excelente configuração" : score >= 70 ? "Quase lá" : "Vamos completar"}</strong><p style="margin:6px 0;color:var(--gbp2-muted);font-size:.82rem;line-height:1.5">${pending[0] ? esc(pending[0]) : "Os requisitos principais estão configurados."}</p></div></div>
            <div class="gbp2-progress" style="margin-top:18px"><i style="width:${score}%"></i></div>
            ${pending.length ? `<div class="gbp2-list" style="margin-top:16px">${pending.slice(0,5).map(p => `<div class="gbp2-row"><span class="gbp2-row-icon"><i class="fa-solid fa-circle-exclamation"></i></span><div class="grow"><strong>Pendência</strong><small>${esc(p)}</small></div></div>`).join("")}</div>` : `<div class="gbp2-alert success" style="margin-top:16px"><i class="fa-solid fa-shield-heart"></i><div><strong>Configuração saudável.</strong><br>Continue acompanhando este painel sempre que alterar a operação.</div></div>`}
          </article>
        </div>
      </div>`;

    root.querySelector("[data-gb32-refresh]")?.addEventListener("click", loadActivation);
    root.querySelector("[data-gb32-complete]")?.addEventListener("click", async () => {
      try { await rpc("go_burger_onboarding_salvar_v32", { p_loja_id:currentStoreId(), p_etapa:"concluido", p_concluida:true, p_dispensar:false }); toast("Onboarding concluído."); loadActivation(); }
      catch (e) { toast(e.message, "error"); }
    });
    $$('[data-gb32-goto]', root).forEach(b => b.addEventListener("click", () => document.querySelector(`[data-page="${CSS.escape(b.dataset.gb32Goto)}"]`)?.click()));
  }

  /* =====================================================
     PACOTE 33 — ERP / CMV / DRE
     ===================================================== */
  async function loadERP() {
    const root = $("#gb33ErpRoot");
    if (!root || !(await sessionReady())) return;
    if (!(await featureEnabled("erp_ingredientes_v33"))) return featureOff(root,"ERP de ingredientes");
    root.innerHTML = `<div class="gbp2-skeleton"></div><div class="gbp2-skeleton"></div>`;
    try {
      const today = dateISO();
      const start = new Date(Date.now() - 29 * 86400000).toISOString().slice(0,10);
      const [ings, prods, dre, cash, intel] = await Promise.all([
        rpc("go_burger_ingredientes_v33", { p_loja_id:currentStoreId() }),
        queryProducts(),
        rpc("go_burger_dre_v33", { p_loja_id:currentStoreId(), p_inicio:start, p_fim:today }),
        rpc("go_burger_caixa_resumo_v33", { p_loja_id:currentStoreId(), p_data:today }),
        rpc("go_burger_produtos_inteligencia_v33", { p_loja_id:currentStoreId(), p_dias:30 })
      ]);
      ingredients = Array.isArray(ings) ? ings : [];
      renderERP(root, { dre:dre || {}, cash:cash || {}, intel:Array.isArray(intel) ? intel : [] });
    } catch (e) { root.innerHTML = empty("fa-triangle-exclamation", "ERP indisponível", e.message || "Falha ao carregar."); }
  }

  function renderERP(root, data) {
    const critical = ingredients.filter(i => ["critico","zerado"].includes(i.status)).length;
    const stockValue = ingredients.reduce((s,i) => s + num(i.valor_estoque), 0);
    root.innerHTML = `
      <div class="gbp2-shell">
        <section class="gbp2-hero"><span class="gbp2-eyebrow"><i class="fa-solid fa-boxes-stacked"></i> PACOTE 33 · ERP DA HAMBURGUERIA</span><h2>Ingredientes, ficha técnica, CMV e caixa no mesmo lugar.</h2><p>Controle o que entra, o que sai e quanto cada produto realmente custa. A baixa de ingredientes acontece automaticamente quando o pedido entra em preparo.</p></section>
        <div class="gbp2-kpis">
          <div class="gbp2-kpi"><small>Ingredientes ativos</small><strong>${ingredients.filter(i=>i.ativo).length}</strong><span>${critical} em atenção</span></div>
          <div class="gbp2-kpi"><small>Valor em estoque</small><strong>${money(stockValue)}</strong><span>Custo cadastrado</span></div>
          <div class="gbp2-kpi"><small>CMV 30 dias</small><strong>${money(data.dre.cmv)}</strong><span>${num(data.dre.cmv_percentual).toFixed(1)}% da receita</span></div>
          <div class="gbp2-kpi"><small>Resultado estimado</small><strong>${money(data.dre.resultado_estimado)}</strong><span>Após CMV, comissão e despesas</span></div>
        </div>
        <div class="gbp2-card">
          <div class="gbp2-tabs">
            <button class="active" data-gbp2-tab="ingredientes">Ingredientes</button>
            <button data-gbp2-tab="ficha">Ficha técnica</button>
            <button data-gbp2-tab="dre">DRE & despesas</button>
            <button data-gbp2-tab="caixa">Fechamento de caixa</button>
            <button data-gbp2-tab="produtos">Inteligência de produtos</button>
          </div>
          <div class="gbp2-tab-panel active" data-gbp2-panel="ingredientes" id="gb33IngredientsPanel">${renderIngredientsTable()}</div>
          <div class="gbp2-tab-panel" data-gbp2-panel="ficha" id="gb33RecipePanel">${renderRecipePicker()}</div>
          <div class="gbp2-tab-panel" data-gbp2-panel="dre">${renderDRE(data.dre)}</div>
          <div class="gbp2-tab-panel" data-gbp2-panel="caixa">${renderCash(data.cash)}</div>
          <div class="gbp2-tab-panel" data-gbp2-panel="produtos">${renderProductIntel(data.intel)}</div>
        </div>
      </div>`;
    bindTabs(root);
    bindERPEvents(root);
  }

  function renderIngredientsTable() {
    return `<div class="gbp2-toolbar"><button class="gbp2-btn primary" data-gb33-new-ing type="button"><i class="fa-solid fa-plus"></i> Novo ingrediente</button><span class="grow"></span><button class="gbp2-btn secondary" data-gb33-refresh type="button"><i class="fa-solid fa-rotate"></i> Atualizar</button></div>
      <div class="gbp2-table-wrap"><table class="gbp2-table"><thead><tr><th>Ingrediente</th><th>Saldo</th><th>Mínimo</th><th>Custo</th><th>Valor estoque</th><th>Status</th><th></th></tr></thead><tbody>${ingredients.map(i => `<tr><td><strong>${esc(i.nome)}</strong><br><small>${esc(i.fornecedor || "Sem fornecedor")}</small></td><td>${num(i.quantidade).toLocaleString("pt-BR")} ${esc(i.unidade)}</td><td>${num(i.estoque_minimo).toLocaleString("pt-BR")} ${esc(i.unidade)}</td><td>${money(i.custo_unitario)}</td><td>${money(i.valor_estoque)}</td><td>${badge(i.status, i.status==="ok"?"green":i.status==="critico"?"orange":i.status==="zerado"?"red":"")}</td><td><div style="display:flex;gap:6px"><button class="gbp2-btn tiny secondary" data-gb33-edit-ing="${i.id}" type="button">Editar</button><button class="gbp2-btn tiny soft" data-gb33-adjust-ing="${i.id}" type="button">Ajustar</button></div></td></tr>`).join("") || `<tr><td colspan="7">${empty("fa-box-open","Nenhum ingrediente","Cadastre o primeiro ingrediente para ativar o ERP de ficha técnica.")}</td></tr>`}</tbody></table></div>`;
  }

  function ingredientForm(i = {}) {
    return `<div class="gbp2-card-head"><div><span class="gbp2-eyebrow">ESTOQUE POR INGREDIENTE</span><h3>${i.id ? "Editar ingrediente" : "Novo ingrediente"}</h3></div><i class="fa-solid fa-carrot"></i></div>
      <form class="gbp2-form-grid" id="gb33IngredientForm">
        <input type="hidden" name="id" value="${esc(i.id || "")}">
        <label class="gbp2-field span-2"><span>Nome</span><input class="gbp2-input" name="nome" maxlength="120" required value="${esc(i.nome || "")}"></label>
        <label class="gbp2-field"><span>Unidade</span><select class="gbp2-select" name="unidade">${["un","g","kg","ml","l","porcao"].map(u=>`<option ${i.unidade===u?"selected":""}>${u}</option>`).join("")}</select></label>
        <label class="gbp2-field"><span>Saldo atual</span><input class="gbp2-input" name="quantidade" type="number" min="0" step="0.001" required value="${num(i.quantidade)}"></label>
        <label class="gbp2-field"><span>Estoque mínimo</span><input class="gbp2-input" name="minimo" type="number" min="0" step="0.001" value="${num(i.estoque_minimo)}"></label>
        <label class="gbp2-field"><span>Custo por unidade</span><input class="gbp2-input" name="custo" type="number" min="0" step="0.0001" value="${num(i.custo_unitario)}"></label>
        <label class="gbp2-field"><span>Fornecedor</span><input class="gbp2-input" name="fornecedor" maxlength="160" value="${esc(i.fornecedor || "")}"></label>
        <label class="gbp2-field"><span>Validade</span><input class="gbp2-input" name="validade" type="date" value="${esc(i.validade || "")}"></label>
        <label class="gbp2-field span-2"><span><input name="ativo" type="checkbox" ${i.ativo!==false?"checked":""}> Ingrediente ativo</span></label>
        <button class="gbp2-btn primary span-2" type="submit"><i class="fa-solid fa-floppy-disk"></i> Salvar ingrediente</button>
      </form>`;
  }

  function renderRecipePicker() {
    return `<div class="gbp2-grid wide-left"><div><label class="gbp2-field"><span>Produto</span><select class="gbp2-select" id="gb33RecipeProduct"><option value="">Selecione um produto</option>${products.map(p=>`<option value="${p.id}">${esc(p.nome)}</option>`).join("")}</select></label><div id="gb33RecipeEditor" style="margin-top:14px">${empty("fa-list-check","Selecione um produto","A ficha técnica define quanto de cada ingrediente é consumido por unidade vendida.")}</div></div><div class="gbp2-alert"><i class="fa-solid fa-circle-info"></i><div><strong>Como funciona a baixa automática?</strong><br>Quando o pedido muda para <b>Em preparo</b>, a Go-burger baixa os ingredientes da ficha. Se o pedido for cancelado depois, o saldo é devolvido automaticamente.</div></div></div>`;
  }

  async function loadRecipe(productId) {
    const host = $("#gb33RecipeEditor");
    if (!host || !productId) return;
    host.innerHTML = `<div class="gbp2-skeleton"></div>`;
    try {
      const data = await rpc("go_burger_ficha_produto_v33", { p_loja_id:currentStoreId(), p_produto_id:Number(productId) });
      const selected = new Map((data.itens || []).map(x => [Number(x.ingrediente_id), x]));
      host.innerHTML = `<form id="gb33RecipeForm"><div class="gbp2-card-head"><div><span class="gbp2-eyebrow">FICHA TÉCNICA</span><h3>Custo atual: ${money(data.custo_unitario)}</h3></div><i class="fa-solid fa-calculator"></i></div><div class="gbp2-list">${ingredients.filter(i=>i.ativo).map(i=>{const s=selected.get(Number(i.id));return `<div class="gbp2-row"><input type="checkbox" data-recipe-use="${i.id}" ${s?"checked":""}><div class="grow"><strong>${esc(i.nome)}</strong><small>${money(i.custo_unitario)} / ${esc(i.unidade)}</small></div><input class="gbp2-input" style="width:100px" data-recipe-qty="${i.id}" type="number" min="0.001" step="0.001" value="${num(s?.quantidade,1)}" ${s?"":"disabled"}><input class="gbp2-input" style="width:92px" data-recipe-loss="${i.id}" type="number" min="0" max="100" step="0.1" value="${num(s?.perda_percentual)}" ${s?"":"disabled"} title="Perda %"></div>`}).join("") || empty("fa-carrot","Cadastre ingredientes primeiro","A ficha técnica usa o estoque de ingredientes do ERP.")}</div><button class="gbp2-btn primary" style="margin-top:14px" type="submit"><i class="fa-solid fa-floppy-disk"></i> Salvar ficha técnica</button></form>`;
      $$('[data-recipe-use]', host).forEach(chk => chk.addEventListener("change", () => {
        host.querySelector(`[data-recipe-qty="${chk.dataset.recipeUse}"]`).disabled = !chk.checked;
        host.querySelector(`[data-recipe-loss="${chk.dataset.recipeUse}"]`).disabled = !chk.checked;
      }));
      $("#gb33RecipeForm")?.addEventListener("submit", saveRecipe);
    } catch (e) { host.innerHTML = empty("fa-triangle-exclamation","Erro na ficha técnica",e.message); }
  }

  async function saveRecipe(e) {
    e.preventDefault();
    const pid = Number($("#gb33RecipeProduct")?.value || 0);
    const items = $$('[data-recipe-use]:checked').map(chk => ({ ingrediente_id:Number(chk.dataset.recipeUse), quantidade:num(document.querySelector(`[data-recipe-qty="${chk.dataset.recipeUse}"]`)?.value), perda_percentual:num(document.querySelector(`[data-recipe-loss="${chk.dataset.recipeUse}"]`)?.value) }));
    try { await rpc("go_burger_ficha_salvar_v33", { p_loja_id:currentStoreId(), p_produto_id:pid, p_itens:items, p_maps_removiveis:[] }); toast("Ficha técnica salva e CMV recalculado."); loadRecipe(pid); }
    catch (err) { toast(err.message, "error"); }
  }

  function renderDRE(d) {
    return `<div class="gbp2-kpis"><div class="gbp2-kpi"><small>Receita</small><strong>${money(d.receita_liquida_pedidos)}</strong></div><div class="gbp2-kpi"><small>CMV</small><strong>${money(d.cmv)}</strong><span>${num(d.cmv_percentual).toFixed(1)}%</span></div><div class="gbp2-kpi"><small>Despesas</small><strong>${money(d.despesas_operacionais)}</strong></div><div class="gbp2-kpi"><small>Resultado</small><strong>${money(d.resultado_estimado)}</strong></div></div>
      <div class="gbp2-grid" style="margin-top:16px"><div class="gbp2-card"><div class="gbp2-card-head"><div><span class="gbp2-eyebrow">DRE SIMPLIFICADA</span><h3>Últimos 30 dias</h3></div><i class="fa-solid fa-chart-pie"></i></div><div class="gbp2-list"><div class="gbp2-row"><div class="grow"><strong>Receita de pedidos</strong></div><b>${money(d.receita_liquida_pedidos)}</b></div><div class="gbp2-row"><div class="grow"><strong>(–) CMV</strong></div><b>${money(d.cmv)}</b></div><div class="gbp2-row"><div class="grow"><strong>(–) Despesas cadastradas</strong></div><b>${money(d.despesas_operacionais)}</b></div><div class="gbp2-row"><div class="grow"><strong>Resultado estimado</strong></div><b>${money(d.resultado_estimado)}</b></div></div></div>
      <form class="gbp2-card gbp2-form-grid" id="gb33ExpenseForm"><div class="gbp2-card-head span-2"><div><span class="gbp2-eyebrow">DESPESA</span><h3>Registrar custo operacional</h3></div><i class="fa-solid fa-file-invoice-dollar"></i></div><label class="gbp2-field"><span>Data/competência</span><input class="gbp2-input" type="date" name="competencia" value="${dateISO()}"></label><label class="gbp2-field"><span>Categoria</span><input class="gbp2-input" name="categoria" value="Operacional" maxlength="60"></label><label class="gbp2-field span-2"><span>Descrição</span><input class="gbp2-input" name="descricao" required maxlength="240"></label><label class="gbp2-field"><span>Valor</span><input class="gbp2-input" name="valor" type="number" min="0" step="0.01" required></label><label class="gbp2-field"><span><input type="checkbox" name="recorrente"> Despesa recorrente</span></label><button class="gbp2-btn primary span-2" type="submit">Registrar despesa</button></form></div>`;
  }

  function renderCash(c) {
    return `<div class="gbp2-kpis"><div class="gbp2-kpi"><small>Dinheiro</small><strong>${money(c.dinheiro)}</strong></div><div class="gbp2-kpi"><small>PIX</small><strong>${money(c.pix)}</strong></div><div class="gbp2-kpi"><small>Cartão</small><strong>${money(c.cartao)}</strong></div><div class="gbp2-kpi"><small>Total do dia</small><strong>${money(c.total)}</strong></div></div><form class="gbp2-card gbp2-form-grid" id="gb33CashForm" style="margin-top:16px"><div class="gbp2-card-head span-2"><div><span class="gbp2-eyebrow">FECHAMENTO DIÁRIO</span><h3>${c.fechamento ? "Caixa já conferido" : "Conferir caixa"}</h3></div><i class="fa-solid fa-cash-register"></i></div><label class="gbp2-field"><span>Data</span><input class="gbp2-input" name="data" type="date" value="${esc(c.data || dateISO())}"></label><label class="gbp2-field"><span>Abertura / troco inicial</span><input class="gbp2-input" name="abertura" type="number" step="0.01" min="0" value="${num(c.fechamento?.abertura)}"></label><label class="gbp2-field"><span>Dinheiro contado ao fechar</span><input class="gbp2-input" name="informado" type="number" step="0.01" min="0" value="${num(c.fechamento?.informado_dinheiro)}"></label><label class="gbp2-field"><span>Diferença registrada</span><input class="gbp2-input" disabled value="${money(c.fechamento?.diferenca)}"></label><label class="gbp2-field span-2"><span>Observação</span><textarea class="gbp2-textarea" name="observacao">${esc(c.fechamento?.observacao || "")}</textarea></label><button class="gbp2-btn primary span-2" type="submit">Fechar e conferir caixa</button></form>`;
  }

  function renderProductIntel(rows) {
    return `<div class="gbp2-table-wrap"><table class="gbp2-table"><thead><tr><th>Produto</th><th>Vendas</th><th>Receita</th><th>Custo</th><th>Margem</th><th>Leitura</th></tr></thead><tbody>${rows.map(p=>`<tr><td><strong>${esc(p.nome)}</strong></td><td>${num(p.vendas)}</td><td>${money(p.receita)}</td><td>${money(p.custo_unitario)}</td><td>${money(p.margem_unitaria)} · ${num(p.margem_percentual).toFixed(1)}%</td><td>${badge(p.classificacao,p.classificacao==="ativo"?"green":p.classificacao==="encalhado"?"orange":"red")}</td></tr>`).join("") || `<tr><td colspan="6">${empty("fa-chart-line","Sem histórico suficiente","A inteligência melhora conforme a loja vende.")}</td></tr>`}</tbody></table></div>`;
  }

  function bindERPEvents(root) {
    root.querySelector("[data-gb33-new-ing]")?.addEventListener("click", () => { const m=openModal(ingredientForm(), true); $("#gb33IngredientForm",m)?.addEventListener("submit",saveIngredient); });
    root.querySelector("[data-gb33-refresh]")?.addEventListener("click", loadERP);
    $$('[data-gb33-edit-ing]',root).forEach(b=>b.addEventListener("click",()=>{const i=ingredients.find(x=>Number(x.id)===Number(b.dataset.gb33EditIng));const m=openModal(ingredientForm(i||{}),true);$("#gb33IngredientForm",m)?.addEventListener("submit",saveIngredient);}));
    $$('[data-gb33-adjust-ing]',root).forEach(b=>b.addEventListener("click",()=>openIngredientAdjust(Number(b.dataset.gb33AdjustIng))));
    $("#gb33RecipeProduct")?.addEventListener("change",e=>loadRecipe(Number(e.target.value)));
    $("#gb33ExpenseForm")?.addEventListener("submit", saveExpense);
    $("#gb33CashForm")?.addEventListener("submit", saveCash);
  }

  async function saveIngredient(e) {
    e.preventDefault(); const f=e.currentTarget; const b=f.querySelector('button[type="submit"]'); b.disabled=true;
    try { await rpc("go_burger_ingrediente_salvar_v33",{p_loja_id:currentStoreId(),p_id:f.id.value?Number(f.id.value):null,p_nome:f.nome.value,p_unidade:f.unidade.value,p_quantidade:num(f.quantidade.value),p_minimo:num(f.minimo.value),p_custo:num(f.custo.value),p_fornecedor:f.fornecedor.value||null,p_validade:f.validade.value||null,p_ativo:f.ativo.checked}); toast("Ingrediente salvo."); $("#gbp2AdminModal")?.classList.remove("active"); loadERP(); }
    catch(err){toast(err.message,"error");} finally{b.disabled=false;}
  }

  function openIngredientAdjust(id) {
    const i=ingredients.find(x=>Number(x.id)===id); if(!i)return;
    const m=openModal(`<div class="gbp2-card-head"><div><span class="gbp2-eyebrow">MOVIMENTAÇÃO</span><h3>${esc(i.nome)}</h3><p>Saldo atual: ${num(i.quantidade)} ${esc(i.unidade)}</p></div><i class="fa-solid fa-arrow-right-arrow-left"></i></div><form class="gbp2-form-grid" id="gb33AdjustForm"><label class="gbp2-field"><span>Movimento</span><select class="gbp2-select" name="tipo"><option value="entrada">Entrada</option><option value="saida">Saída</option><option value="perda">Perda</option><option value="ajuste">Ajuste</option></select></label><label class="gbp2-field"><span>Quantidade</span><input class="gbp2-input" type="number" min="0.001" step="0.001" name="qtd" required></label><label class="gbp2-field span-2"><span>Motivo</span><input class="gbp2-input" name="motivo" maxlength="300"></label><button class="gbp2-btn primary span-2" type="submit">Registrar movimento</button></form>`,true);
    $("#gb33AdjustForm",m)?.addEventListener("submit",async e=>{e.preventDefault();const f=e.currentTarget;let delta=num(f.qtd.value);if(["saida","perda"].includes(f.tipo.value))delta=-delta;try{await rpc("go_burger_ingrediente_ajustar_v33",{p_loja_id:currentStoreId(),p_ingrediente_id:id,p_delta:delta,p_tipo:f.tipo.value,p_motivo:f.motivo.value||null});toast("Estoque atualizado.");m.classList.remove("active");loadERP();}catch(err){toast(err.message,"error");}});
  }

  async function saveExpense(e){e.preventDefault();const f=e.currentTarget;try{await rpc("go_burger_despesa_salvar_v33",{p_loja_id:currentStoreId(),p_id:null,p_competencia:f.competencia.value,p_categoria:f.categoria.value,p_descricao:f.descricao.value,p_valor:num(f.valor.value),p_recorrente:f.recorrente.checked});toast("Despesa registrada.");loadERP();}catch(err){toast(err.message,"error");}}
  async function saveCash(e){e.preventDefault();const f=e.currentTarget;try{await rpc("go_burger_caixa_fechar_v33",{p_loja_id:currentStoreId(),p_data:f.data.value,p_abertura:num(f.abertura.value),p_informado_dinheiro:num(f.informado.value),p_observacao:f.observacao.value||null});toast("Caixa fechado e conferido.");loadERP();}catch(err){toast(err.message,"error");}}

  /* =====================================================
     PACOTE 34 — INTELIGÊNCIA OPERACIONAL
     ===================================================== */
  async function loadIntelligence() {
    const root=$("#gb34IntelligenceRoot"); if(!root||!(await sessionReady()))return;
    if (!(await featureEnabled("operacao_inteligente_v34"))) return featureOff(root,"Operação inteligente");
    root.innerHTML=`<div class="gbp2-skeleton"></div><div class="gbp2-skeleton"></div>`;
    try{
      const [cancel,demand,queue,drivers]=await Promise.all([
        rpc("go_burger_cancelamentos_analytics_v34",{p_loja_id:currentStoreId(),p_dias:90}),
        rpc("go_burger_previsao_demanda_v34",{p_loja_id:currentStoreId(),p_dias_futuros:7}),
        rpc("go_burger_fila_preparo_v34",{p_loja_id:currentStoreId()}),
        rpc("go_burger_entregadores_metricas_v34",{p_loja_id:currentStoreId()})
      ]);
      renderIntelligence(root,cancel||{},demand||{},Array.isArray(queue)?queue:[],Array.isArray(drivers)?drivers:[]);
    }catch(e){root.innerHTML=empty("fa-triangle-exclamation","Inteligência operacional indisponível",e.message);}
  }

  function renderIntelligence(root,cancel,demand,queue,drivers){
    const days=Array.isArray(demand.dias)?demand.dias:[];
    root.innerHTML=`<div class="gbp2-shell"><section class="gbp2-hero"><span class="gbp2-eyebrow"><i class="fa-solid fa-brain"></i> PACOTE 34 · OPERAÇÃO INTELIGENTE</span><h2>Priorize o que importa antes que vire atraso.</h2><p>A fila usa prioridade, idade do pedido, quantidade de itens e agendamento. O despacho combina disponibilidade, carga e última localização do entregador.</p></section>
    <div class="gbp2-kpis"><div class="gbp2-kpi"><small>Fila agora</small><strong>${queue.length}</strong><span>Pedidos operacionais</span></div><div class="gbp2-kpi"><small>Cancelamentos 90d</small><strong>${num(cancel.cancelados)}</strong><span>${num(cancel.taxa_cancelamento).toFixed(1)}% dos pedidos</span></div><div class="gbp2-kpi"><small>Entregadores</small><strong>${drivers.length}</strong><span>${drivers.filter(d=>d.disponivel).length} disponíveis</span></div><div class="gbp2-kpi"><small>Previsão 7 dias</small><strong>${Math.round(days.reduce((s,d)=>s+num(d.pedidos_previstos),0))}</strong><span>Pedidos estimados</span></div></div>
    <div class="gbp2-card"><div class="gbp2-tabs"><button class="active" data-gbp2-tab="fila">Fila inteligente</button><button data-gbp2-tab="demanda">Previsão</button><button data-gbp2-tab="cancel">Cancelamentos</button><button data-gbp2-tab="drivers">Entregadores</button></div>
      <div class="gbp2-tab-panel active" data-gbp2-panel="fila">${renderQueue(queue)}</div>
      <div class="gbp2-tab-panel" data-gbp2-panel="demanda">${renderDemand(demand)}</div>
      <div class="gbp2-tab-panel" data-gbp2-panel="cancel">${renderCancel(cancel)}</div>
      <div class="gbp2-tab-panel" data-gbp2-panel="drivers">${renderDrivers(drivers)}</div>
    </div></div>`;
    bindTabs(root);
    $$('[data-gb34-dispatch]',root).forEach(b=>b.addEventListener("click",()=>showDispatch(Number(b.dataset.gb34Dispatch))));
  }

  function renderQueue(q){return `<div class="gbp2-table-wrap"><table class="gbp2-table"><thead><tr><th>Pedido</th><th>Status</th><th>Itens</th><th>Prioridade</th><th>Score</th><th>Recomendação</th><th></th></tr></thead><tbody>${q.map(o=>`<tr><td><strong>#${esc(o.numero_loja||o.id)}</strong><br><small>${dt(o.criado_em)}</small></td><td>${badge(o.status,"blue")}</td><td>${num(o.itens)}</td><td>${badge(o.prioridade,o.prioridade==="urgente"?"red":o.prioridade==="alta"?"orange":"")}</td><td><strong>${num(o.score).toFixed(0)}</strong></td><td>${esc(o.acao_recomendada)}</td><td><button class="gbp2-btn tiny secondary" data-gb34-dispatch="${o.id}" type="button"><i class="fa-solid fa-motorcycle"></i> Despacho</button></td></tr>`).join("")||`<tr><td colspan="7">${empty("fa-circle-check","Fila zerada","Nenhum pedido aguardando ação agora.")}</td></tr>`}</tbody></table></div>`}
  function renderDemand(d){const days=Array.isArray(d.dias)?d.dias:[];const max=Math.max(1,...days.map(x=>num(x.pedidos_previstos)));return `<div class="gbp2-grid wide-left"><div class="gbp2-card"><div class="gbp2-card-head"><div><span class="gbp2-eyebrow">PRÓXIMOS DIAS</span><h3>Demanda prevista</h3><p>${esc(d.metodo||"")}</p></div><i class="fa-solid fa-chart-column"></i></div><div class="gbp2-list">${days.map(x=>`<div class="gbp2-row"><div class="grow"><strong>${new Date(x.data+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'2-digit'})}</strong><small>${num(x.pedidos_previstos).toFixed(1)} pedidos · referência ${money(x.receita_referencia)}</small><div class="gbp2-progress" style="margin-top:7px"><i style="width:${Math.min(100,num(x.pedidos_previstos)/max*100)}%"></i></div></div></div>`).join("")||empty("fa-clock","Ainda sem previsão","A previsão aparece com histórico de pedidos.")}</div></div><div class="gbp2-card"><div class="gbp2-card-head"><div><span class="gbp2-eyebrow">PICOS</span><h3>Horários mais fortes</h3></div><i class="fa-solid fa-fire"></i></div><div class="gbp2-list">${(d.horarios_pico||[]).map(h=>`<div class="gbp2-row"><span class="gbp2-row-icon"><i class="fa-regular fa-clock"></i></span><div class="grow"><strong>${String(h.hora).padStart(2,'0')}:00</strong><small>Média ${num(h.media_pedidos).toFixed(1)} pedido(s)</small></div></div>`).join("")||empty("fa-chart-line","Sem pico calculado","Mais histórico deixará esta leitura melhor.")}</div></div></div>`}
  function renderCancel(c){return `<div class="gbp2-grid"><div class="gbp2-card"><div class="gbp2-card-head"><div><span class="gbp2-eyebrow">MOTIVOS</span><h3>Por que pedidos estão sendo cancelados?</h3></div><i class="fa-solid fa-ban"></i></div><div class="gbp2-list">${(c.motivos||[]).map(m=>`<div class="gbp2-row"><span class="gbp2-row-icon"><i class="fa-solid fa-circle-xmark"></i></span><div class="grow"><strong>${esc(String(m.codigo).replaceAll('_',' '))}</strong><small>${num(m.total)} pedido(s) · ${money(m.valor_perdido)} em pedidos</small></div></div>`).join("")||empty("fa-circle-check","Sem cancelamentos no período","Ótimo sinal operacional.")}</div></div><div class="gbp2-card"><div class="gbp2-card-head"><div><span class="gbp2-eyebrow">INDICADOR</span><h3>Taxa de cancelamento</h3></div><i class="fa-solid fa-percent"></i></div><div class="gbp2-score"><div class="gbp2-score-ring" style="--score:${Math.min(100,num(c.taxa_cancelamento))}"><strong>${num(c.taxa_cancelamento).toFixed(1)}%</strong></div><div><strong>${num(c.cancelados)} de ${num(c.pedidos)} pedidos</strong><p style="color:var(--gbp2-muted);font-size:.82rem">Use os motivos padronizados ao cancelar para melhorar a leitura.</p></div></div></div></div>`}
  function renderDrivers(d){return `<div class="gbp2-table-wrap"><table class="gbp2-table"><thead><tr><th>Entregador</th><th>Disponível</th><th>Entregas</th><th>Nota</th><th>Avaliações</th><th>Tempo médio</th></tr></thead><tbody>${d.map(x=>`<tr><td><strong>${esc(x.nome)}</strong><br><small>${esc(x.veiculo||'—')}</small></td><td>${badge(x.disponivel?'Sim':'Não',x.disponivel?'green':'')}</td><td>${num(x.entregas)}</td><td>${x.nota_media==null?'—':`★ ${num(x.nota_media).toFixed(2)}`}</td><td>${num(x.avaliacoes)}</td><td>${x.tempo_medio_min==null?'—':`${num(x.tempo_medio_min).toFixed(0)} min`}</td></tr>`).join("")||`<tr><td colspan="6">${empty("fa-motorcycle","Nenhum entregador","Cadastre a equipe de entrega para usar o despacho inteligente.")}</td></tr>`}</tbody></table></div>`}

  async function showDispatch(orderId){
    const m=openModal(`<div class="gbp2-skeleton"></div>`,false);
    try{const rows=await rpc("go_burger_despacho_entregadores_v34",{p_loja_id:currentStoreId(),p_pedido_id:orderId});$("#gbp2AdminModalBody",m).innerHTML=`<div class="gbp2-card-head"><div><span class="gbp2-eyebrow">DESPACHO INTELIGENTE</span><h3>Pedido #${orderId}</h3><p>Menor score = melhor combinação neste momento.</p></div><i class="fa-solid fa-route"></i></div><div class="gbp2-list">${(rows||[]).map((d,i)=>`<div class="gbp2-row"><span class="gbp2-row-icon"><b>${i+1}</b></span><div class="grow"><strong>${esc(d.nome)}</strong><small>${esc(d.veiculo||'—')} · ${num(d.entregas_ativas)} entrega(s) ativa(s) · ${d.distancia_loja_km==null?'sem GPS recente':`${num(d.distancia_loja_km).toFixed(2)} km da loja`}</small></div>${badge(`score ${num(d.score).toFixed(0)}`,i===0?'green':'blue')}</div>`).join("")||empty("fa-location-dot","Sem sugestão","Nenhum entregador ativo foi encontrado.")}</div>`;}catch(e){$("#gbp2AdminModalBody",m).innerHTML=empty("fa-triangle-exclamation","Não foi possível sugerir",e.message);}
  }

  /* =====================================================
     PACOTE 35 — CHAT LOJA
     ===================================================== */
  async function loadMessages(){
    const root=$("#gb35MessagesRoot");if(!root||!(await sessionReady()))return;
    if (!(await featureEnabled("chat_pedido_v35"))) return featureOff(root,"Chat do pedido");
    root.innerHTML=`<div class="gbp2-skeleton"></div>`;
    try{currentThreads=await rpc("go_burger_chat_threads_v35",{p_loja_id:currentStoreId(),p_limit:100})||[];renderMessages(root);}catch(e){root.innerHTML=empty("fa-triangle-exclamation","Mensagens indisponíveis",e.message);}
  }
  function renderMessages(root){root.innerHTML=`<div class="gbp2-shell"><section class="gbp2-hero"><span class="gbp2-eyebrow"><i class="fa-solid fa-comments"></i> PACOTE 35 · CHAT DO PEDIDO</span><h2>Converse sem tirar o pedido do contexto.</h2><p>As conversas ficam vinculadas ao pedido e só podem ser vistas pelo cliente, pela hamburgueria e pela Go-burger quando necessário.</p></section><div class="gbp2-grid wide-left"><article class="gbp2-card"><div class="gbp2-card-head"><div><span class="gbp2-eyebrow">CONVERSAS</span><h3>Pedidos com mensagens</h3></div><i class="fa-solid fa-inbox"></i></div><div class="gbp2-list">${currentThreads.map(t=>`<button class="gbp2-row" style="width:100%;text-align:left;cursor:pointer" data-gb35-thread="${t.pedido_id}" type="button"><span class="gbp2-row-icon"><i class="fa-solid fa-receipt"></i></span><div class="grow"><strong>#${esc(t.numero_loja||t.pedido_id)} · ${esc(t.cliente_nome||'Cliente')}</strong><small>${esc(t.ultima_mensagem||'')}${t.ultima_mensagem_em?` · ${dt(t.ultima_mensagem_em)}`:''}</small></div>${badge(t.status,'blue')}</button>`).join("")||empty("fa-comment-slash","Nenhuma conversa ainda","Quando um cliente enviar uma mensagem, ela aparecerá aqui.")}</div></article><article class="gbp2-card"><div class="gbp2-alert"><i class="fa-solid fa-shield-halved"></i><div><strong>Chat protegido por pedido.</strong><br>O servidor valida quem é o cliente e quem pertence à hamburgueria. Há limitação contra spam e o conteúdo não é exposto em tabelas públicas.</div></div></article></div></div>`;$$('[data-gb35-thread]',root).forEach(b=>b.addEventListener('click',()=>openChat(Number(b.dataset.gb35Thread))));}

  async function openChat(orderId){currentChatOrder=orderId;const m=openModal(`<div class="gbp2-card-head"><div><span class="gbp2-eyebrow">CHAT DO PEDIDO</span><h3>Pedido #${orderId}</h3></div><i class="fa-solid fa-comments"></i></div><div class="gbp2-chat"><div class="gbp2-chat-log" id="gb35ChatLog"><div class="gbp2-skeleton"></div></div><form class="gbp2-chat-compose" id="gb35ChatForm"><textarea class="gbp2-textarea" maxlength="1000" placeholder="Escreva uma mensagem para o cliente..." required></textarea><button class="gbp2-btn primary" type="submit"><i class="fa-solid fa-paper-plane"></i> Enviar</button></form></div>`);await refreshChat();$("#gb35ChatForm",m)?.addEventListener('submit',async e=>{e.preventDefault();const ta=e.currentTarget.querySelector('textarea');const msg=ta.value.trim();if(!msg)return;try{await rpc('go_burger_chat_enviar_v35',{p_pedido_id:currentChatOrder,p_mensagem:msg});ta.value='';await refreshChat();}catch(err){toast(err.message,'error');}});}
  async function refreshChat(){const log=$("#gb35ChatLog");if(!log||!currentChatOrder)return;try{const msgs=await rpc('go_burger_chat_listar_v35',{p_pedido_id:currentChatOrder,p_depois_id:0})||[];log.innerHTML=msgs.map(x=>`<div class="gbp2-msg ${x.papel==='loja'?'mine':''}"><strong>${x.papel==='loja'?'Hamburgueria':x.papel==='cliente'?'Cliente':'Go-burger'}</strong><p>${esc(x.mensagem)}</p><time>${dt(x.criado_em)}</time></div>`).join('')||empty('fa-comment-dots','Comece a conversa','Envie uma mensagem vinculada a este pedido.');log.scrollTop=log.scrollHeight;}catch(e){log.innerHTML=empty('fa-triangle-exclamation','Falha ao carregar',e.message);}}

  /* =====================================================
     PACOTE 36 — MESAS / COMANDAS
     ===================================================== */
  async function loadTables(){
    const root=$("#gb36TablesRoot");if(!root||!(await sessionReady()))return;if (!(await featureEnabled("mesas_comandas_v36"))) return featureOff(root,"Mesas e comandas");root.innerHTML=`<div class="gbp2-skeleton"></div>`;
    try{const data=await rpc('go_burger_mesas_listar_v36',{p_loja_id:currentStoreId()})||{};renderTables(root,data.mesas||[],data.comandas||[]);}catch(e){root.innerHTML=empty('fa-triangle-exclamation','Salão indisponível',e.message);}
  }
  function renderTables(root,tables,commands){root.innerHTML=`<div class="gbp2-shell"><section class="gbp2-hero"><span class="gbp2-eyebrow"><i class="fa-solid fa-qrcode"></i> PACOTE 36 · SALÃO & COMANDAS</span><h2>QR Code na mesa, pedido no celular.</h2><p>Crie mesas, gere o QR e acompanhe comandas abertas. O cliente lê o código, entra na conta e os pedidos ficam vinculados à mesa.</p><div class="gbp2-hero-actions"><button class="gbp2-btn primary" data-gb36-new-table type="button"><i class="fa-solid fa-plus"></i> Nova mesa</button></div></section><div class="gbp2-grid wide-left"><article class="gbp2-card"><div class="gbp2-card-head"><div><span class="gbp2-eyebrow">MESAS</span><h3>${tables.length} cadastrada(s)</h3></div><i class="fa-solid fa-chair"></i></div><div class="gbp2-list">${tables.map(t=>`<div class="gbp2-row"><span class="gbp2-row-icon"><i class="fa-solid fa-chair"></i></span><div class="grow"><strong>${esc(t.nome||`Mesa ${t.numero}`)}</strong><small>Nº ${esc(t.numero)} · capacidade ${num(t.capacidade)} · ${num(t.comandas_abertas)} comanda(s) aberta(s)</small></div>${badge(t.ativa?'Ativa':'Inativa',t.ativa?'green':'')}<button class="gbp2-btn tiny secondary" data-gb36-qr="${t.public_id}" data-gb36-number="${esc(t.numero)}" type="button"><i class="fa-solid fa-qrcode"></i> QR</button><button class="gbp2-btn tiny soft" data-gb36-edit='${esc(JSON.stringify(t))}' type="button">Editar</button></div>`).join('')||empty('fa-chair','Nenhuma mesa','Crie a primeira mesa para ativar comandas digitais.')}</div></article><article class="gbp2-card"><div class="gbp2-card-head"><div><span class="gbp2-eyebrow">COMANDAS ABERTAS</span><h3>${commands.length}</h3></div><i class="fa-solid fa-clipboard-list"></i></div><div class="gbp2-list">${commands.map(c=>`<div class="gbp2-row"><div class="grow"><strong>Mesa ${esc(c.mesa_numero)} · ${esc(c.cliente||'Cliente')}</strong><small>${money(c.total)} · aberta ${dt(c.aberta_em)}</small></div>${badge(c.status,c.status==='aberta'?'green':'orange')}<button class="gbp2-btn tiny secondary" data-gb36-command="${c.id}" type="button">Detalhes</button></div>`).join('')||empty('fa-clipboard-check','Nenhuma comanda aberta','As comandas aparecem assim que um cliente entra pelo QR.')}</div></article></div></div>`;
    root.querySelector('[data-gb36-new-table]')?.addEventListener('click',()=>openTableForm());
    $$('[data-gb36-edit]',root).forEach(b=>b.addEventListener('click',()=>{try{openTableForm(JSON.parse(b.dataset.gb36Edit));}catch{}}));
    $$('[data-gb36-qr]',root).forEach(b=>b.addEventListener('click',()=>showQR(b.dataset.gb36Qr,b.dataset.gb36Number)));
    $$('[data-gb36-command]',root).forEach(b=>b.addEventListener('click',()=>showCommand(b.dataset.gb36Command)));
  }
  function openTableForm(t={}){const m=openModal(`<div class="gbp2-card-head"><div><span class="gbp2-eyebrow">SALÃO</span><h3>${t.id?'Editar mesa':'Nova mesa'}</h3></div><i class="fa-solid fa-chair"></i></div><form class="gbp2-form-grid" id="gb36TableForm"><input type="hidden" name="id" value="${esc(t.id||'')}"><label class="gbp2-field"><span>Número/código</span><input class="gbp2-input" name="numero" required maxlength="30" value="${esc(t.numero||'')}"></label><label class="gbp2-field"><span>Nome opcional</span><input class="gbp2-input" name="nome" maxlength="80" value="${esc(t.nome||'')}"></label><label class="gbp2-field"><span>Capacidade</span><input class="gbp2-input" name="capacidade" type="number" min="1" max="50" value="${num(t.capacidade,4)}"></label><label class="gbp2-field"><span><input type="checkbox" name="ativa" ${t.ativa!==false?'checked':''}> Mesa ativa</span></label><button class="gbp2-btn primary span-2" type="submit">Salvar mesa</button></form>`,true);$("#gb36TableForm",m)?.addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget;try{await rpc('go_burger_mesa_salvar_v36',{p_loja_id:currentStoreId(),p_id:f.id.value?Number(f.id.value):null,p_numero:f.numero.value,p_nome:f.nome.value||null,p_capacidade:Number(f.capacidade.value||4),p_ativa:f.ativa.checked});toast('Mesa salva.');m.classList.remove('active');loadTables();}catch(err){toast(err.message,'error');}});}
  async function showQR(publicId,number){const base=['http:','https:'].includes(location.protocol)?`${location.origin}${location.pathname.replace(/admin\/admin\.html.*$/,'')}mesa/index.html`:`https://go-burger.app/mesa/`;const link=`${base}?mesa=${encodeURIComponent(publicId)}`;const m=openModal(`<div class="gbp2-card-head"><div><span class="gbp2-eyebrow">QR DA MESA</span><h3>Mesa ${esc(number)}</h3><p>Imprima e deixe o código sobre a mesa.</p></div><i class="fa-solid fa-qrcode"></i></div><div class="gbp2-qr" id="gb36QrBox"><div class="gbp2-skeleton" style="width:240px;height:240px"></div></div><p style="font-size:.75rem;color:var(--gbp2-muted);word-break:break-all">${esc(link)}</p><div class="gbp2-hero-actions gbp2-no-print"><button class="gbp2-btn primary" id="gb36PrintQr" type="button"><i class="fa-solid fa-print"></i> Imprimir QR</button><button class="gbp2-btn secondary" id="gb36CopyQr" type="button"><i class="fa-regular fa-copy"></i> Copiar link</button></div>`,true);try{const {data,error}=await db.functions.invoke('go-burger-qr',{body:{text:link}});if(error)throw error;$("#gb36QrBox",m).innerHTML=data?.svg||empty('fa-qrcode','QR indisponível','Use o link da mesa.');}catch(e){$("#gb36QrBox",m).innerHTML=empty('fa-triangle-exclamation','QR indisponível',e.message||'Use o link da mesa.');}$("#gb36CopyQr",m)?.addEventListener('click',()=>navigator.clipboard?.writeText(link).then(()=>toast('Link copiado.')));$("#gb36PrintQr",m)?.addEventListener('click',()=>{m.querySelector('.gbp2-modal-card').classList.add('gbp2-print-target');document.body.classList.add('gbp2-printing');window.print();setTimeout(()=>{document.body.classList.remove('gbp2-printing');m.querySelector('.gbp2-modal-card').classList.remove('gbp2-print-target');},250);});}
  async function showCommand(id){const m=openModal(`<div class="gbp2-skeleton"></div>`,true);try{const c=await rpc('go_burger_comanda_detalhe_v36',{p_comanda_id:id});$("#gbp2AdminModalBody",m).innerHTML=`<div class="gbp2-card-head"><div><span class="gbp2-eyebrow">COMANDA</span><h3>Mesa ${esc(c.mesa_numero)}</h3><p>${badge(c.status,c.status==='aberta'?'green':'orange')}</p></div><i class="fa-solid fa-clipboard-list"></i></div><div class="gbp2-kpis" style="grid-template-columns:1fr 1fr"><div class="gbp2-kpi"><small>Total</small><strong>${money(c.total)}</strong></div><div class="gbp2-kpi"><small>Pedidos</small><strong>${(c.pedidos||[]).length}</strong></div></div><div class="gbp2-list" style="margin-top:14px">${(c.pedidos||[]).map(p=>`<div class="gbp2-row"><div class="grow"><strong>#${esc(p.numero||p.id)}</strong><small>${dt(p.criado_em)}</small></div>${badge(p.status,'blue')}<b>${money(p.total)}</b></div>`).join('')}</div><button class="gbp2-btn primary" style="margin-top:14px" id="gb36CloseCommand">Solicitar/confirmar fechamento</button>`;$("#gb36CloseCommand",m)?.addEventListener('click',async()=>{try{const r=await rpc('go_burger_comanda_fechar_v36',{p_comanda_id:id});toast(`Comanda: ${String(r.status).replaceAll('_',' ')}.`);m.classList.remove('active');loadTables();}catch(err){toast(err.message,'error');}});}catch(e){$("#gbp2AdminModalBody",m).innerHTML=empty('fa-triangle-exclamation','Falha na comanda',e.message);}}

  /* =====================================================
     INIT / PÁGINAS
     ===================================================== */
  const loaders={ativacao:loadActivation,erp:loadERP,inteligencia:loadIntelligence,mensagens:loadMessages,salao:loadTables};
  async function loadForPage(page){if(loaders[page])await loaders[page]();}
  function bindPageHooks(){document.addEventListener('click',e=>{const b=e.target.closest('[data-page]');if(b&&loaders[b.dataset.page])setTimeout(()=>loadForPage(b.dataset.page),80);});$("#adminLojaSelect")?.addEventListener('change',()=>setTimeout(()=>{storeId=currentStoreId();featureState=null;loadForPage(location.hash.slice(1));},700));window.addEventListener('hashchange',()=>loadForPage(location.hash.slice(1)));}

  document.addEventListener('DOMContentLoaded',async()=>{bindPageHooks();if(await sessionReady())setTimeout(()=>loadForPage(location.hash.slice(1)),350);});
})();
