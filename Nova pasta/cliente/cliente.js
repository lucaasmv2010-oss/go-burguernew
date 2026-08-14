/* Go-burger CLIENTE — FINAL ORGANIZADO | sessão unificada + multi-lojas */
"use strict";

document.addEventListener("DOMContentLoaded", async () => {
  const SUPABASE_URL = "https://ethlgaszdextwckdwgsf.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_qEhxWcCbekPjYFUW-EQ1ow_xccHG8aJ";
  const ORDER_SELECT = "*,pedido_itens(*,pedido_item_opcoes(*),pedido_item_removidos(*))";
  const FINANCE_ENABLED = false; // P602: pagamento online congelado
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const money = v => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const html = v => String(v ?? "").replace(/[&<>'"]/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" }[c]));
  const num = (v, f = 0) => Number.isFinite(Number(v)) ? Number(v) : f;
  const slug = v => String(v || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const dt = v => v ? new Date(v).toLocaleString("pt-BR", { dateStyle:"short", timeStyle:"short" }) : "—";
  const initials = v => String(v || "Cliente").trim().split(/\s+/).slice(0,2).map(x => x[0] || "").join("").toUpperCase() || "C";
  const empty = (icon, title, text) => `<div class="empty-state"><i class="fa-solid ${icon}"></i><strong>${html(title)}</strong><p>${html(text)}</p></div>`;

  if (!window.supabase?.createClient) {
    showAuthMessage("O Supabase não foi carregado. Verifique sua internet.", "error");
    return;
  }

  const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession:true, autoRefreshToken:true, detectSessionInUrl:true, storageKey:"go-burger-auth-v1" }
  });

  const state = {
    user:null, profile:null, loja:null, config:{}, storeOpen:false,
    produtos:[], grupos:[], opcoes:[], produtoGrupos:[], ingredientes:[],
    bairros:[], horarios:[], banners:[], upsells:[], recompensas:[], resgates:[],
    pedidos:[], enderecos:[], movimentos:[], notificacoes:[], avaliacoes:[], publicAvaliacoes:[],
    cart:[], favorites:new Set(), coupon:null, deliveryType:"Entrega", payment:"PIX", schedule:"agora",
    menuCategory:"", orderFilter:"todos", favoriteOnly:false,
    modalProduct:null, modalUpsell:null, modalQty:1, modalOptions:new Set(), modalRemoved:new Set(),
    reviewStars:5, realtime:null, deferredInstall:null, bannerIndex:0, bannerTimer:null, upsell:null,
    loading:false, deliveryCoords:null, deliveryQuote:null, onlinePayment:false, checkoutInFlight:false,
    cartSessionId:(()=>{
      const key="go_burger_cart_session";
      let id=sessionStorage.getItem(key);
      if(!id){id=crypto.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`;sessionStorage.setItem(key,id);}
      return id;
    })(),
    cartSyncTimer:null,
    trackingTimer:null,
    currentDeviceId:(()=>{
      const key="go_burger_device_id";
      let id=localStorage.getItem(key);
      if(!id){id=crypto.randomUUID?.()||"00000000-0000-4000-8000-"+Math.random().toString(16).slice(2,14).padEnd(12,"0");localStorage.setItem(key,id);}
      return id;
    })
  };

  function toast(message, type="success") {
    const wrap = $("#toastContainer") || document.body;
    const node = document.createElement("div");
    node.className = `toast ${type}`;
    const icon = type === "error" ? "fa-triangle-exclamation" : type === "info" ? "fa-circle-info" : "fa-circle-check";
    node.innerHTML = `<span><i class="fa-solid ${icon}"></i></span><div><strong>${type === "error" ? "Erro" : type === "info" ? "Informação" : "Sucesso"}</strong><p>${html(message)}</p></div>`;
    wrap.appendChild(node);
    requestAnimationFrame(() => node.classList.add("show"));
    setTimeout(() => { node.classList.remove("show"); setTimeout(() => node.remove(), 250); }, 3800);
  }


  async function trackEvent(evento, propriedades = {}) {
    try {
      await db.rpc("go_burger_registrar_evento_v1", {
        p_evento: evento,
        p_loja_id: state.loja?.id || null,
        p_sessao_id: sessionStorage.getItem("go_burger_analytics_session") || null,
        p_origem: "cliente",
        p_propriedades: propriedades
      });
    } catch {}
  }

  async function useCurrentLocation() {
    if (!navigator.geolocation) return toast("Geolocalização não é suportada neste aparelho.", "info");
    const button = $("#useCurrentLocation");
    setButton(button, true, "Localizando...");
    navigator.geolocation.getCurrentPosition(
      async position => {
        state.deliveryCoords = {
          latitude: Number(position.coords.latitude),
          longitude: Number(position.coords.longitude),
          precisao: Number(position.coords.accuracy || 0)
        };
        const status = $("#deliveryLocationStatus");
        if (status) {
          status.textContent = `Localização obtida · precisão aproximada de ${Math.round(state.deliveryCoords.precisao)} m.`;
          status.className = "helper success";
        }
        try {
          const quote = await db.rpc("go_burger_cotacao_entrega_v1", {
            p_loja_id: state.loja.id,
            p_latitude: state.deliveryCoords.latitude,
            p_longitude: state.deliveryCoords.longitude
          });
          if (!quote.error && quote.data?.disponivel === false) {
            state.deliveryQuote=null;
            toast(quote.data?.mensagem || "Este local está fora da área de entrega.", "info");
          } else if (!quote.error && quote.data?.disponivel) {
            state.deliveryQuote=quote.data;
            renderCart();
            toast(`Distância aproximada: ${num(quote.data.distancia_km).toFixed(1)} km · entrega ${money(quote.data.taxa)}.`, "info");
          }
        } catch {}
        setButton(button, false);
      },
      error => {
        toast(error.code === 1 ? "Permissão de localização negada." : "Não foi possível obter sua localização.", "info");
        setButton(button, false);
      },
      { enableHighAccuracy:true, timeout:10000, maximumAge:120000 }
    );
  }

  async function startOnlinePayment(pedidoId) {if(!FINANCE_ENABLED){toast("Pagamento online indisponível nesta versão.","info");return false;}
    try {
      const { data, error } = await db.functions.invoke("go-burger-payment-create", { body:{ pedido_id:Number(pedidoId) } });
      if (error) throw error;
      if (!data?.checkout_url) throw new Error(data?.error || "Pagamento online indisponível para esta loja.");
      await trackEvent("pagamento_online_iniciado", { pedido_id:Number(pedidoId) });
      location.href = data.checkout_url;
      return true;
    } catch (error) {
      console.warn("Go-burger pagamento online", error);
      toast("Pagamento online ainda não está ativado para esta hamburgueria. O pedido foi criado normalmente.", "info");
      return false;
    }
  }


  async function fingerprintDevice(){
    try{
      const raw=[
        navigator.userAgent||"",
        navigator.language||"",
        navigator.platform||"",
        screen?.width||0,
        screen?.height||0,
        Intl.DateTimeFormat().resolvedOptions().timeZone||""
      ].join("|");
      const buffer=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(raw));
      return Array.from(new Uint8Array(buffer)).map(b=>b.toString(16).padStart(2,"0")).join("");
    }catch{return null;}
  }

  function browserLabel(){
    const ua=navigator.userAgent||"";
    if(/Edg\//.test(ua))return "Microsoft Edge";
    if(/OPR\//.test(ua))return "Opera";
    if(/Firefox\//.test(ua))return "Firefox";
    if(/Chrome\//.test(ua))return "Chrome";
    if(/Safari\//.test(ua))return "Safari";
    return "Navegador";
  }

  async function syncLegalAcceptances(){
    if(!state.user)return;
    const accepted=state.user.user_metadata?.go_burger_terms_accepted===true;
    if(!accepted)return;
    const terms=["cliente","privacidade"];
    if(window.GoBurgerUI?.consentValue?.())terms.push("cookies");
    for(const tipo of terms){
      try{
        await db.rpc("go_burger_aceitar_termo_v1",{p_tipo:tipo,p_versao:"1.2",p_aceito:true,p_origem:"cliente_web"});
      }catch(error){console.warn(`Aceite ${tipo}`,error.message);}
    }
  }

  async function registerCurrentDevice(){
    if(!state.user)return;
    try{
      const fingerprint=await fingerprintDevice();
      await db.rpc("go_burger_registrar_dispositivo_v1",{
        p_dispositivo_id:state.currentDeviceId,
        p_dispositivo:navigator.userAgentData?.mobile?"Celular":"Dispositivo",
        p_navegador:browserLabel(),
        p_plataforma:navigator.userAgentData?.platform||navigator.platform||null,
        p_fingerprint_hash:fingerprint
      });
      await renderSessions();
    }catch(error){
      console.warn("Go-burger sessão do dispositivo",error.message);
    }
  }

  async function renderSessions(){
    const wrap=$("#sessionDeviceList");
    if(!wrap||!state.user)return;
    try{
      const {data,error}=await db.rpc("go_burger_minhas_sessoes_v1");
      if(error)throw error;
      const rows=Array.isArray(data)?data:[];
      wrap.innerHTML=rows.slice(0,6).map(row=>`
        <div class="session-device-item ${row.id===state.currentDeviceId?"current":""}">
          <div>
            <strong>${html(row.navegador||row.dispositivo||"Dispositivo")}${row.id===state.currentDeviceId?" · este aparelho":""}</strong>
            <small>${html(row.plataforma||"")} · último acesso ${dt(row.ultimo_acesso_em)}</small>
          </div>
          <span class="status ${row.revogada_em?"cancelado":"concluido"}">${row.revogada_em?"encerrada":"ativa"}</span>
        </div>
      `).join("");
    }catch(error){
      wrap.innerHTML="";
    }
  }

  async function revokeOtherSessions(){
    if(!state.user)return;
    if(!confirm("Encerrar as sessões da sua conta em outros dispositivos?"))return;
    const button=$("#revokeOtherSessions");
    setButton(button,true,"Encerrando...");
    try{
      const {error}=await db.auth.signOut({scope:"others"});
      if(error)throw error;
      await db.rpc("go_burger_marcar_outras_sessoes_revogadas_v1",{p_dispositivo_id:state.currentDeviceId});
      await renderSessions();
      toast("Outras sessões foram encerradas.");
    }catch(error){
      toast(error.message||"Não foi possível encerrar as outras sessões.","error");
    }finally{
      setButton(button,false);
    }
  }

  async function exportMyData() {
    const button=$("#exportMyData"); setButton(button,true,"Preparando...");
    try {
      const {data,error}=await db.rpc("go_burger_exportar_meus_dados_v1"); if(error)throw error;
      const blob=new Blob([JSON.stringify(data||{},null,2)],{type:"application/json;charset=utf-8"});
      const url=URL.createObjectURL(blob),a=document.createElement("a"); a.href=url;a.download=`go-burger-meus-dados-${new Date().toISOString().slice(0,10)}.json`;a.click();
      setTimeout(()=>URL.revokeObjectURL(url),1200);toast("Arquivo dos seus dados preparado.");
    } catch(error){toast(error.message||"Não foi possível exportar seus dados.","error");}
    finally{setButton(button,false);}
  }

  async function requestLgpd(tipo) {
    if(!state.user)return requireLogin("gerenciar seus dados");
    let description="";
    let confirmation="";

    if(tipo==="correcao"){
      description=prompt("Descreva o dado que precisa ser corrigido:")||"";
      if(!description.trim())return;
    }

    if(tipo==="eliminacao"){
      confirmation=prompt("Esta ação remove sua conta e anonimiza seus dados pessoais históricos. Para confirmar, digite EXCLUIR:")||"";
      if(confirmation.trim().toUpperCase()!=="EXCLUIR")return toast("Exclusão cancelada. Nada foi alterado.","info");
      description="Exclusão definitiva confirmada pelo titular na central de privacidade da Go-burger.";
    }

    const button=tipo==="eliminacao"?$("#requestAccountDeletion"):$("#requestDataCorrection");
    setButton(button,true,tipo==="eliminacao"?"Excluindo...":"Enviando...");

    try{
      const {data:protocol,error}=await db.rpc("go_burger_solicitar_direito_lgpd_v1",{p_tipo:tipo,p_descricao:description||null});
      if(error)throw error;

      const status=$("#privacyRequestStatus");
      if(status){status.textContent=`Solicitação registrada. Protocolo: ${protocol}`;status.className="helper success";}

      if(tipo!=="eliminacao"){
        toast(`Solicitação registrada · ${protocol}`);
        return;
      }

      const {data:sessionData}=await db.auth.getSession();
      const accessToken=sessionData?.session?.access_token;
      if(!accessToken)throw new Error("Sua sessão expirou. Entre novamente antes de excluir a conta.");

      const response=await fetch(`${SUPABASE_URL}/functions/v1/go-burger-account-delete`,{
        method:"POST",
        headers:{
          "Content-Type":"application/json",
          "Authorization":`Bearer ${accessToken}`,
          "apikey":SUPABASE_PUBLISHABLE_KEY
        },
        body:JSON.stringify({confirmacao:"EXCLUIR"})
      });
      const result=await response.json().catch(()=>({}));
      if(!response.ok||!result?.ok)throw new Error(result?.error||"A exclusão automática não pôde ser concluída.");

      try{await db.auth.signOut({scope:"local"});}catch{}
      Object.keys(localStorage).filter(key=>key.startsWith("go_burger_cart_")||key.startsWith("go_burger_favorites_")||key==="go-burger-auth-v1").forEach(key=>localStorage.removeItem(key));
      sessionStorage.clear();
      alert("Sua conta Go-burger foi excluída e os dados pessoais históricos foram anonimizados.");
      location.href="./marketplace/market.html";
    }catch(error){
      toast(error.message||"Não foi possível concluir a solicitação.","error");
    }finally{
      setButton(button,false);
    }
  }

  async function shareStore(){
    const base=new URL("marketplace/market.html",location.href);
    const publicUrl=new URL("cliente.html",base);
    publicUrl.searchParams.set("loja",state.loja?.slug||"");
    const data={title:state.loja?.nome?`${state.loja.nome} · Go-burger`:"Go-burger",text:state.loja?.slogan||"Confira esta hamburgueria na Go-burger.",url:publicUrl.toString()};
    try{
      if(navigator.share){await navigator.share(data);return;}
      await navigator.clipboard.writeText(data.url);toast("Link da hamburgueria copiado.");
    }catch(error){if(error?.name!=="AbortError")toast("Não foi possível compartilhar agora.","error");}
  }

  function showAuthMessage(message="", type="error") {
    const box = $("#authMessage");
    if (!box) return;
    box.textContent = message;
    box.className = `auth-message${message ? ` show ${type}` : ""}`;
  }

  function setButton(button, loading, label="Processando...") {
    if (!button) return;
    if (loading) {
      button.dataset.oldHtml ||= button.innerHTML;
      button.disabled = true;
      button.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${html(label)}`;
    } else {
      button.disabled = false;
      if (button.dataset.oldHtml) { button.innerHTML = button.dataset.oldHtml; delete button.dataset.oldHtml; }
    }
  }

  function normalizePhoneBR(value) {
    let d = String(value || "").replace(/\D/g, "");
    if ((d.length === 10 || d.length === 11)) d = `55${d}`;
    return d ? `+${d}` : "";
  }

  function cartKey() { return `go_burger_cart_${state.user?.id || "guest"}_${state.loja?.id || "default"}`; }
  function favoriteKey() { return `go_burger_favorites_${state.user?.id || "guest"}_${state.loja?.id || "default"}`; }
  function loadLocal() {
    try { state.cart = JSON.parse(localStorage.getItem(cartKey()) || "[]"); } catch { state.cart = []; }
    try { state.favorites = new Set(JSON.parse(localStorage.getItem(favoriteKey()) || "[]").map(Number)); } catch { state.favorites = new Set(); }
  }
  function showCartResumeBanner(){
    if(!state.cart.length||document.querySelector(".cart-resume-banner"))return;
    const hero=document.querySelector('[data-section="inicio"] .hero')||document.querySelector('[data-section="inicio"]');
    if(!hero)return;
    const qty=state.cart.reduce((sum,item)=>sum+num(item.quantidade,1),0);
    const box=document.createElement("div");
    box.className="cart-resume-banner";
    box.innerHTML=`<span><strong>Seu carrinho continua aqui 🍔</strong><small>${qty} item(ns) salvos neste aparelho.</small></span><button type="button">Ver carrinho</button>`;
    box.querySelector("button").addEventListener("click",openCart);
    hero.insertAdjacentElement("afterend",box);
  }

  function persistCart() {
    localStorage.setItem(cartKey(), JSON.stringify(state.cart));
    clearTimeout(state.cartSyncTimer);
    state.cartSyncTimer=setTimeout(syncCartSnapshot,650);
  }

  async function syncCartSnapshot(){
    if(!state.loja?.id)return;
    try{
      const itens=state.cart.map(item=>({
        produto_id:Number(item.produto_id),
        quantidade:Math.max(1,Number(item.quantidade||1))
      })).filter(item=>Number.isFinite(item.produto_id));
      await db.rpc("go_burger_salvar_carrinho_v1",{
        p_loja_id:state.loja.id,
        p_sessao_id:state.cartSessionId,
        p_itens:itens
      });
    }catch{}
  }
  function persistFavorites() { localStorage.setItem(favoriteKey(), JSON.stringify([...state.favorites])); }

  async function loadPersistentFavorites(){
    if(!state.user||!state.loja?.id)return;
    try{
      const {data,error}=await db.from("produto_favoritos")
        .select("produto_id")
        .eq("user_id",state.user.id)
        .eq("loja_id",state.loja.id);
      if(error)throw error;
      state.favorites=new Set((data||[]).map(row=>Number(row.produto_id)));
      persistFavorites();
    }catch(error){
      console.warn("Go-burger favoritos",error.message);
    }
  }

  function showAuth() { $("#authScreen")?.classList.remove("hidden"); $("#app")?.classList.add("hidden"); }
  function showApp() { $("#authScreen")?.classList.add("hidden"); $("#app")?.classList.remove("hidden"); }

  function switchAuth(tab) {
    $$('[data-auth-tab]').forEach(b => b.classList.toggle("active", b.dataset.authTab === tab));
    $$('[data-auth-form]').forEach(f => f.classList.toggle("active", f.dataset.authForm === tab));
    showAuthMessage("");
  }

  async function signIn(event) {
    event.preventDefault();
    const f = event.currentTarget, b = f.querySelector('[type="submit"]');
    const email = String(f.elements.identificador.value || "").trim().toLowerCase();
    const password = String(f.elements.senha.value || "");
    if (!email || !password) return showAuthMessage("Informe seu e-mail e sua senha.");
    if (!email.includes("@")) return showAuthMessage("Informe um e-mail válido.");
    setButton(b, true, "Entrando..."); showAuthMessage("");
    try {
      const { data, error } = await db.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (!data.user) throw new Error("Não foi possível identificar sua conta.");
      state.user = data.user;
      await boot();
    } catch (e) {
      const m = /invalid login credentials/i.test(e.message || "") ? "E-mail ou senha incorretos." : e.message;
      showAuthMessage(m || "Não foi possível entrar.");
    } finally { setButton(b, false); }
  }

  async function register(event) {
    event.preventDefault();
    const f = event.currentTarget, b = f.querySelector('[type="submit"]');
    const nome = String(f.elements.nome.value || "").trim();
    const email = String(f.elements.email.value || "").trim().toLowerCase();
    const telefone = normalizePhoneBR(f.elements.telefone.value);
    const password = String(f.elements.senha.value || ""), confirmPass = String(f.elements.confirmar.value || "");
    if (!nome || !email || !telefone) return showAuthMessage("Preencha nome, e-mail e celular.");
    if (password.length < 8) return showAuthMessage("A senha precisa ter pelo menos 8 caracteres.");
    if (password !== confirmPass) return showAuthMessage("As senhas não coincidem.");
    if (!f.elements.termos?.checked) return showAuthMessage("Aceite os Termos e a Política de Privacidade para continuar.");
    setButton(b, true, "Criando conta..."); showAuthMessage("");
    try {
      const { data: signupGate, error: signupGateError } = await db.rpc("go_burger_plataforma_publica_v1");
      if (signupGateError) throw new Error("Não foi possível validar a abertura de novos cadastros. Tente novamente mais tarde.");
      if (signupGate?.manutencao || signupGate?.user_signups_enabled === false) {
        throw new Error(signupGate?.manutencao_mensagem || "Novos cadastros estão temporariamente indisponíveis enquanto a Go Burger finaliza o lançamento.");
      }
      const { data, error } = await db.auth.signUp({ email, password, options:{ data:{ nome, telefone, go_burger_terms_accepted:true, go_burger_terms_version:"1.2" } } });
      if (error) throw error;
      if (data.session?.user) { state.user = data.session.user; await boot(); toast("Conta criada com sucesso."); }
      else { switchAuth("login"); $("#loginForm").elements.identificador.value = email; showAuthMessage("Conta criada. Confira seu e-mail para confirmar o cadastro e depois entre.", "info"); }
    } catch (e) { showAuthMessage(e.message || "Não foi possível criar a conta."); }
    finally { setButton(b, false); }
  }

  async function recoverPassword() {
    const value = String($("#loginForm")?.elements.identificador?.value || "").trim();
    if (!value.includes("@")) return showAuthMessage("Para recuperar a senha, informe seu e-mail no campo de acesso.", "info");
    try {
      const redirectTo = ["http:","https:"].includes(location.protocol) ? `${location.origin}${location.pathname}` : undefined;
      const { error } = await db.auth.resetPasswordForEmail(value.toLowerCase(), redirectTo ? { redirectTo } : undefined);
      if (error) throw error;
      showAuthMessage("Se o e-mail estiver cadastrado, você receberá as instruções de recuperação.", "info");
    } catch (e) { showAuthMessage(e.message || "Não foi possível solicitar a recuperação."); }
  }

  async function signOut() {
    if (!confirm("Deseja sair da sua conta?")) return;
    if (state.realtime) try { await db.removeChannel(state.realtime); } catch {}
    await db.auth.signOut();
    state.user = state.profile = null; state.cart = []; state.pedidos=[]; state.enderecos=[]; state.movimentos=[]; state.notificacoes=[]; state.avaliacoes=[]; state.resgates=[];
    await boot();
  }

  async function fetchOne(name, query, fallback=[]) {
    try { const r = await query(); if (r.error) throw r.error; state[name] = r.data ?? fallback; return true; }
    catch (e) { console.error(name, e); toast(`${name}: ${e.message}`, "error"); state[name] = fallback; return false; }
  }

  async function loadStoreContext() {
    const url = new URL(location.href);
    const requestedSlug = String(url.searchParams.get("loja") || localStorage.getItem("go_burger_loja_slug") || "").trim().toLowerCase();
    let data = null;

    if (requestedSlug) {
      const r = await db.from("lojas").select("id,slug,nome,slogan,descricao,logo_url,banner_url,telefone,whatsapp,instagram,cidade,estado,status,ativo,padrao,cor_primaria,cor_secundaria,cor_destaque,tema_publico").eq("slug", requestedSlug).maybeSingle();
      if (r.error) throw r.error;
      data = r.data;
    }

    if (!data) {
      const r = await db.from("lojas").select("id,slug,nome,slogan,descricao,logo_url,banner_url,telefone,whatsapp,instagram,cidade,estado,status,ativo,padrao,cor_primaria,cor_secundaria,cor_destaque,tema_publico").eq("padrao", true).maybeSingle();
      if (r.error) throw r.error;
      data = r.data;
    }

    if (!data || data.ativo === false || data.status === "bloqueada") throw new Error("Esta hamburgueria não está disponível na Go-burger.");
    state.loja = data;
    localStorage.setItem("go_burger_loja_slug", data.slug);
    if (url.searchParams.get("loja") !== data.slug) {
      url.searchParams.set("loja", data.slug);
      history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    }
  }

  async function loadConfig() {
    if (!state.loja?.id) throw new Error("Nenhuma hamburgueria foi selecionada.");
    const { data, error } = await db.rpc("go_burger_configuracao_publica_p602",{p_loja_id:state.loja.id});
    if (error) throw error;
    state.config = data || { loja_id:state.loja.id, nome:state.loja.nome||"Hamburgueria", taxa_entrega:0, pedido_minimo:0, aceita_entrega:true, aceita_retirada:true, tempo_estimado_min:30, tempo_estimado_max:50, loja_modo:"automatico" };
  }

  async function loadProfile() {
    if (!state.user) { state.profile = null; return; }
    const { data, error } = await db.from("profiles").select("*").eq("id",state.user.id).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Seu perfil ainda não foi criado no banco.");
    state.profile = data;
  }

  async function loadOrders() {
    if (!state.user) { state.pedidos = []; return; }
    const r = await db.from("pedidos").select(ORDER_SELECT).eq("user_id",state.user.id).eq("loja_id",state.loja.id).order("criado_em",{ascending:false});
    if (r.error) throw r.error;
    state.pedidos = r.data || [];
  }

  async function loadStoreOpen() {
    try {
      if (state.loja?.status === "pausada" || state.loja?.status === "bloqueada" || state.loja?.status === "rascunho") return state.storeOpen = false;
      if (state.config.loja_modo === "aberta") return state.storeOpen = true;
      if (state.config.loja_modo === "fechada") return state.storeOpen = false;
      const r = await db.rpc("go_burger_loja_aberta_em", { p_loja_id:state.loja.id, p_momento:new Date().toISOString() });
      if (r.error) throw r.error;
      state.storeOpen = !!r.data;
    } catch { state.storeOpen = state.config.loja_modo !== "fechada"; }
  }

  async function loadLoyaltyBalance() {
    if (!state.config.fidelidade_ativa) return 0;
    return state.movimentos.reduce((s,x)=>s+num(x.pontos),0);
  }

  async function loadData() {
    if (state.loading) return;
    state.loading = true;
    try {
      await loadStoreContext();
      await loadConfig();
      await loadProfile();
      const lojaId = state.loja.id;
      const publicLoads = [
        fetchOne("produtos", () => db.from("produtos").select("*").eq("loja_id",lojaId).eq("ativo",true).order("ordem").order("nome")),
        fetchOne("grupos", () => db.from("grupos_adicionais").select("*").eq("loja_id",lojaId).eq("ativo",true).order("ordem")),
        fetchOne("opcoes", () => db.from("grupo_adicional_opcoes").select("*").eq("loja_id",lojaId).eq("ativo",true).order("ordem")),
        fetchOne("produtoGrupos", () => db.from("produto_grupos").select("*").eq("loja_id",lojaId).eq("ativo",true).order("ordem")),
        fetchOne("ingredientes", () => db.from("produto_ingredientes").select("*").eq("loja_id",lojaId).eq("ativo",true).order("ordem")),
        fetchOne("bairros", () => db.from("bairros_entrega").select("*").eq("loja_id",lojaId).eq("ativo",true).order("ordem")),
        fetchOne("horarios", () => db.from("horarios_funcionamento").select("*").eq("loja_id",lojaId).order("dia_semana")),
        fetchOne("banners", () => db.from("banners").select("*").eq("loja_id",lojaId).eq("ativo",true).order("ordem")),
        fetchOne("upsells", () => db.from("ofertas_upsell").select("*").eq("loja_id",lojaId).eq("ativo",true).order("ordem")),
        fetchOne("recompensas", () => db.from("fidelidade_recompensas").select("*").eq("loja_id",lojaId).eq("ativo",true).order("pontos_necessarios")),
        fetchOne("publicAvaliacoes", () => db.from("avaliacoes").select("id,nota,comentario,criado_em").eq("loja_id",lojaId).eq("status","publicada").order("criado_em",{ascending:false}).limit(12)),
        loadStoreOpen()
      ];
      await Promise.all(publicLoads);
      if (state.user) {
        await Promise.all([
          fetchOne("resgates", () => db.from("fidelidade_resgates").select("*").eq("loja_id",lojaId).eq("user_id",state.user.id).order("criado_em",{ascending:false})),
          fetchOne("enderecos", () => db.from("enderecos").select("*").eq("user_id",state.user.id).eq("ativo",true).order("principal",{ascending:false}).order("criado_em")),
          fetchOne("movimentos", () => db.from("fidelidade_movimentos").select("*").eq("loja_id",lojaId).eq("user_id",state.user.id).order("criado_em",{ascending:false}).limit(100)),
          fetchOne("notificacoes", () => db.from("notificacoes").select("*").eq("loja_id",lojaId).order("criado_em",{ascending:false}).limit(100)),
          fetchOne("avaliacoes", () => db.from("avaliacoes").select("*").eq("loja_id",lojaId).eq("user_id",state.user.id).order("criado_em",{ascending:false})),
          loadOrders()
        ]);
      } else {
        state.resgates=[]; state.enderecos=[]; state.movimentos=[]; state.notificacoes=[]; state.avaliacoes=[]; state.pedidos=[];
      }
    } finally { state.loading = false; }
  }

  async function ensurePlatformAccess() {
    if (!state.user) return true;
    const { data, error } = await db.rpc("go_burger_status_usuario");
    if (error) throw new Error("Não foi possível validar sua conta na Go-burger.");
    const status = String(data?.status || "ativo").toLowerCase();
    if (status !== "ativo" && data?.super_admin !== true) {
      const reason = String(data?.motivo || "").trim();
      await db.auth.signOut();
      state.user = state.profile = state.loja = null;
      showAuth();
      showAuthMessage(`Sua conta está ${status} na Go-burger.${reason ? ` Motivo: ${reason}` : ""} Fale com o suporte para continuar.`, "error");
      return false;
    }
    return true;
  }

  async function boot() {
    try {
      if (!(await ensurePlatformAccess())) return;
      showApp();
      await loadData();
      loadLocal();
      applyBrand(); renderAll(); startRealtime(); navigate(location.hash.slice(1) || "inicio", false);
    } catch (e) {
      console.error(e); toast(e.message || "Não foi possível carregar sua conta.", "error");
      if (/perfil/i.test(e.message || "")) { await db.auth.signOut(); showAuth(); }
    }
  }

  function applyBrand() {
    const c = state.config, name = state.loja?.nome || c.nome || "Hamburgueria", profileName = state.profile?.nome || (state.user ? "Cliente" : "Visitante");
    document.title = `${name} | Go-burger`;
    const storePrimary = state.loja?.cor_primaria || c.cor_primaria || "#ff6500";
    document.documentElement.style.setProperty("--primary", storePrimary);
    document.documentElement.style.setProperty("--store-secondary", state.loja?.cor_secundaria || "#17100c");
    document.documentElement.style.setProperty("--store-accent", state.loja?.cor_destaque || "#ffc928");
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", storePrimary);
    $("#nomeLoja").textContent = name; $("#authBrandName").textContent = "Go-burger";
    const logo = state.loja?.logo_url || c.logo_url;
    if (logo) { $("#brandLogo").innerHTML = `<img src="${html(logo)}" alt="${html(name)}">`; } else { $("#brandLogo").textContent = "🍔"; }
    const cover = state.loja?.banner_url || "";
    const heroVisual = $("#storeHeroVisual");
    if (heroVisual) {
      heroVisual.classList.toggle("has-cover", Boolean(cover));
      heroVisual.style.backgroundImage = cover ? `linear-gradient(180deg,rgba(18,10,6,.06),rgba(18,10,6,.34)),url("${String(cover).replace(/"/g,"%22")}")` : "";
      const fallback=$("#storeHeroFallback"); if(fallback) fallback.classList.toggle("hidden", Boolean(cover));
    }
    $("#nomeHeader").textContent = profileName.split(/\s+/)[0]; $("#nomeBoasVindas").textContent = profileName.split(/\s+/)[0];
    $("#avatarHeader").textContent = initials(profileName); $("#profileAvatar").textContent = initials(profileName);
    $("#profileName").textContent = profileName; $("#profileEmail").textContent = state.user?.email || state.profile?.email || "Entre para acessar sua conta"; $("#profilePhone").textContent = state.profile?.telefone || "—";
    const accountSmall = document.querySelector('.user-button small'); if (accountSmall) accountSmall.textContent = state.user ? "Minha conta" : "Entrar";
    $("#homePrepTime").textContent = `${num(c.tempo_estimado_min,30)}–${num(c.tempo_estimado_max,50)} min`;
    $("#homeDelivery").textContent = c.aceita_entrega === false ? "Indisponível" : (state.bairros.length ? "Taxa por bairro" : `A partir de ${money(c.taxa_entrega)}`);
    $("#homePickup").textContent = c.aceita_retirada === false ? "Indisponível" : "Disponível";
    const ratingCount=state.publicAvaliacoes.length,rating=ratingCount?state.publicAvaliacoes.reduce((sum,a)=>sum+num(a.nota),0)/ratingCount:0;
    if($("#homeRating"))$("#homeRating").textContent=ratingCount?`${rating.toFixed(1)} · ${ratingCount} avaliação${ratingCount===1?"":"ões"}`:"Nova na Go-burger";
    $("#pixKey").textContent = c.pix_chave || "Consulte a loja"; $("#pixName").textContent = c.pix_nome || name;
    const paused = state.loja?.status === "pausada";
    const label = state.storeOpen ? "Loja aberta agora" : (paused ? "Loja pausada temporariamente" : (c.mensagem_loja_fechada || "Loja fechada agora"));
    $("#storeStatusHeader").textContent = label; $("#storeChip").innerHTML = `<i class="fa-solid fa-circle"></i> ${html(label)}`; $("#storeChip").classList.toggle("closed", !state.storeOpen);
    $("#heroText").textContent = state.storeOpen ? "Escolha seus favoritos, personalize cada detalhe e acompanhe tudo em tempo real." : (paused ? "Esta hamburgueria pausou temporariamente os pedidos. Volte em breve." : (c.agendamento_ativo ? "A loja está fechada agora, mas você pode preparar um pedido e agendar para o próximo horário disponível." : (c.mensagem_loja_fechada || "A loja está fechada no momento.")));
    if (c.aceita_entrega === false) { state.deliveryType = "Retirada"; }
    renderDeliveryChoices();
  }

  function requireLogin(message="continuar") { if (state.user) return true; showAuth(); showAuthMessage(`Entre ou crie sua conta para ${message}.`, "info"); return false; }

  function navigate(page, hash=true) {
    const allowed = ["inicio","cardapio","pedidos","fidelidade","beneficios","perfil"];
    if (!allowed.includes(page)) page = "inicio";
    if (!state.user && ["pedidos","fidelidade","beneficios","perfil"].includes(page)) { requireLogin(page === "pedidos" ? "acompanhar seus pedidos" : page === "fidelidade" ? "usar a fidelidade" : "abrir seu perfil"); return; }
    $$('[data-section]').forEach(x => x.classList.toggle("active", x.dataset.section === page));
    $$('[data-page]').forEach(x => x.classList.toggle("active", x.dataset.page === page));
    if (hash) history.replaceState(null,"",`#${page}`);
    if (page === "pedidos") renderOrders(); if (page === "fidelidade") renderLoyalty(); if (page === "perfil") renderProfile();
    scrollTo({top:0,behavior:"smooth"});
  }

  function productAvailable(p) { return p && p.ativo !== false && p.status !== "Indisponível" && num(p.estoque) > 0; }
  async function favoriteToggle(id) {
    id=Number(id);
    const wasFavorite=state.favorites.has(id);
    wasFavorite?state.favorites.delete(id):state.favorites.add(id);
    persistFavorites();
    renderProducts();
    if(state.modalProduct?.id===id)updateModalFavorite();

    if(!state.user)return;
    try{
      if(wasFavorite){
        const {error}=await db.from("produto_favoritos")
          .delete()
          .eq("user_id",state.user.id)
          .eq("loja_id",state.loja.id)
          .eq("produto_id",id);
        if(error)throw error;
      }else{
        const {error}=await db.from("produto_favoritos").insert({
          user_id:state.user.id,
          loja_id:state.loja.id,
          produto_id:id
        });
        if(error)throw error;
      }
    }catch(error){
      wasFavorite?state.favorites.add(id):state.favorites.delete(id);
      persistFavorites();renderProducts();updateModalFavorite();
      toast("Não foi possível sincronizar o favorito.","error");
    }
  }

  function productCard(p) {
    const fav = state.favorites.has(Number(p.id)), available = productAvailable(p);
    return `<article class="product-card ${available ? "" : "unavailable"}" data-product-card="${p.id}"><div class="product-image"><img src="${html(p.imagem || "../assets/placeholder-burger.svg")}" alt="${html(p.nome)}" loading="lazy"><div class="product-tags">${p.destaque?"<span>DESTAQUE</span>":""}${p.novidade?"<span>NOVO</span>":""}</div><button class="favorite-button ${fav?"active":""}" data-favorite="${p.id}" aria-label="Favoritar"><i class="fa-${fav?"solid":"regular"} fa-heart"></i></button></div><div class="product-body"><span class="category">${html(p.categoria || "Cardápio")}</span><h3>${html(p.nome)}</h3><p>${html(p.descricao || "Preparado na hora para você.")}</p><div class="product-footer"><strong>${money(p.preco)}</strong><button data-open-product="${p.id}" ${available?"":"disabled"} aria-label="${available?"Adicionar":"Indisponível"}"><i class="fa-solid ${available?"fa-plus":"fa-ban"}"></i></button></div></div></article>`;
  }

  function renderProducts() {
    const q = String($("#productSearch")?.value || "").trim().toLowerCase();
    let list = state.produtos.filter(p => (!state.menuCategory || p.categoria === state.menuCategory) && (!q || `${p.nome} ${p.categoria} ${p.descricao||""}`.toLowerCase().includes(q)) && (!state.favoriteOnly || state.favorites.has(Number(p.id))));
    const sort = $("#productSort")?.value || "ordem";
    list = [...list].sort((a,b) => sort === "menor" ? num(a.preco)-num(b.preco) : sort === "maior" ? num(b.preco)-num(a.preco) : sort === "nome" ? String(a.nome).localeCompare(String(b.nome),"pt-BR") : (num(a.ordem)-num(b.ordem) || Number(b.destaque)-Number(a.destaque)));
    $("#productGrid").innerHTML = list.length ? list.map(productCard).join("") : empty("fa-burger","Nenhum produto","Tente mudar a busca ou o filtro.");
    const featured = state.produtos.filter(p => productAvailable(p) && (p.destaque || p.novidade)).slice(0,4); const f = featured.length ? featured : state.produtos.filter(productAvailable).slice(0,4);
    $("#featuredProducts").innerHTML = f.length ? f.map(productCard).join("") : empty("fa-burger","Cardápio em atualização","Os produtos aparecerão aqui em breve.");
    $("#clearSearch")?.classList.toggle("hidden", !q);
  }

  function renderCategories() {
    const cats = [...new Set(state.produtos.map(p=>p.categoria).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"pt-BR"));
    $("#categories").innerHTML = [`<button class="${state.menuCategory===""?"active":""}" data-category="">Todos</button>`, ...cats.map(c=>`<button class="${state.menuCategory===c?"active":""}" data-category="${html(c)}">${html(c)}</button>`)].join("");
  }

  function productGroups(productId) {
    const ids = state.produtoGrupos.filter(x=>Number(x.produto_id)===Number(productId)).sort((a,b)=>num(a.ordem)-num(b.ordem)).map(x=>Number(x.grupo_id));
    return ids.map(id=>state.grupos.find(g=>Number(g.id)===id)).filter(Boolean);
  }

  function modalBasePrice() {
    if (!state.modalProduct) return 0;
    const normal = num(state.modalProduct.preco);
    const promo = state.modalUpsell?.preco_promocional;
    return promo == null ? normal : Math.min(normal, Math.max(0, num(promo)));
  }

  function openProduct(id, upsellOffer = null) {
    const p = state.produtos.find(x=>Number(x.id)===Number(id)); if (!p) return;
    state.modalProduct = p;
    state.modalUpsell = upsellOffer && Number(upsellOffer.produto_ofertado_id)===Number(p.id) ? upsellOffer : null;
    state.modalQty = 1; state.modalOptions = new Set(); state.modalRemoved = new Set();
    const promoAtiva = state.modalUpsell?.preco_promocional != null && modalBasePrice() < num(p.preco);
    $("#modalProductImage").src = p.imagem || "../assets/placeholder-burger.svg"; $("#modalProductName").textContent = p.nome; $("#modalProductCategory").textContent = p.categoria || "PRODUTO"; $("#modalProductDescription").textContent = p.descricao || "Preparado na hora."; $("#modalProductPrice").textContent = promoAtiva ? `${money(modalBasePrice())} · de ${money(p.preco)}` : money(p.preco); $("#productObservation").value = ""; $("#productObservationField").classList.toggle("hidden", p.permite_observacao === false);
    const groups = productGroups(p.id);
    $("#productGroups").innerHTML = groups.map(g=>{ const ops=state.opcoes.filter(o=>Number(o.grupo_id)===Number(g.id)); return `<section class="config-group" data-config-group="${g.id}"><div class="config-group-head"><strong>${html(g.nome)}${g.obrigatorio?" *":""}</strong><small>Escolha ${num(g.minimo)}–${num(g.maximo,1)}</small></div><div class="option-list">${ops.map(o=>`<label class="option-row"><span><input type="${num(g.maximo,1)===1?"radio":"checkbox"}" name="group_${g.id}" value="${o.id}" data-option-id="${o.id}" data-group-id="${g.id}"><strong>${html(o.nome)}</strong></span><b>${num(o.preco_adicional)>0?`+ ${money(o.preco_adicional)}`:"Grátis"}</b></label>`).join("")}</div></section>`;}).join("");
    const ing = state.ingredientes.filter(x=>Number(x.produto_id)===Number(p.id) && x.removivel!==false);
    $("#productIngredients").innerHTML = ing.length ? `<section class="config-group"><div class="config-group-head"><strong>Remover ingredientes</strong><small>Opcional</small></div><div class="option-list">${ing.map(i=>`<label class="ingredient-row"><span><input type="checkbox" value="${i.id}" data-remove-id="${i.id}"><strong>Sem ${html(i.nome)}</strong></span></label>`).join("")}</div></section>` : "";
    updateModalFavorite(); updateModalTotal(); openModal("productModal");
  }

  function updateModalFavorite() {
    const b=$("#modalFavorite"); if(!b||!state.modalProduct)return; const fav=state.favorites.has(Number(state.modalProduct.id)); b.classList.toggle("active",fav); b.innerHTML=`<i class="fa-${fav?"solid":"regular"} fa-heart"></i>`;
  }
  function selectedExtrasTotal() { return [...state.modalOptions].reduce((s,id)=>s+num(state.opcoes.find(o=>Number(o.id)===Number(id))?.preco_adicional),0); }
  function updateModalTotal() { if(!state.modalProduct)return; $("#modalQty").textContent=state.modalQty; $("#modalProductTotal").textContent=money((modalBasePrice()+selectedExtrasTotal())*state.modalQty); }

  function handleOption(input) {
    const id=Number(input.dataset.optionId), gid=Number(input.dataset.groupId), group=state.grupos.find(g=>Number(g.id)===gid); if(!group)return;
    if (input.type === "radio") { state.opcoes.filter(o=>Number(o.grupo_id)===gid).forEach(o=>state.modalOptions.delete(Number(o.id))); if(input.checked)state.modalOptions.add(id); }
    else { if(input.checked){ const selected=state.opcoes.filter(o=>Number(o.grupo_id)===gid && state.modalOptions.has(Number(o.id))).length; if(selected>=num(group.maximo,1)){ input.checked=false; return toast(`Você pode escolher no máximo ${group.maximo} opção(ões) em ${group.nome}.`,"info"); } state.modalOptions.add(id);} else state.modalOptions.delete(id); }
    updateModalTotal();
  }

  function validateModalConfiguration() {
    for (const g of productGroups(state.modalProduct.id)) {
      const count=state.opcoes.filter(o=>Number(o.grupo_id)===Number(g.id)&&state.modalOptions.has(Number(o.id))).length;
      if(count<num(g.minimo)) return `Escolha pelo menos ${g.minimo} opção(ões) em ${g.nome}.`;
      if(count>num(g.maximo,1)) return `Escolha no máximo ${g.maximo} opção(ões) em ${g.nome}.`;
    }
    return null;
  }

  function addConfiguredProduct() {
    if(!state.modalProduct)return; const err=validateModalConfiguration(); if(err)return toast(err,"error");
    const ops=[...state.modalOptions].map(id=>state.opcoes.find(o=>Number(o.id)===Number(id))).filter(Boolean).map(o=>({id:Number(o.id),nome:o.nome,preco:num(o.preco_adicional)}));
    const rem=[...state.modalRemoved].map(id=>state.ingredientes.find(i=>Number(i.id)===Number(id))).filter(Boolean).map(i=>({id:Number(i.id),nome:i.nome}));
    const obs=String($("#productObservation")?.value||"").trim();
    const upsellId=state.modalUpsell?.preco_promocional!=null && modalBasePrice()<num(state.modalProduct.preco) ? Number(state.modalUpsell.id) : null;
    const stockRemaining=Math.max(0,Math.trunc(num(state.modalProduct.estoque))-cartQuantityForProduct(state.modalProduct.id));
    if(state.modalQty>stockRemaining)return toast(`Estoque disponível para este produto: ${stockRemaining}.`,"error");
    if(upsellId){
      const promoRemaining=availablePromoUnits(state.modalUpsell);
      if(state.modalQty>promoRemaining)return toast(`Esta oferta permite no máximo ${promoRemaining} unidade(s) promocional(is) para os itens gatilho do carrinho.`,"info");
    }
    const signature=JSON.stringify({p:Number(state.modalProduct.id),u:upsellId,o:ops.map(x=>x.id).sort((a,b)=>a-b),r:rem.map(x=>x.id).sort((a,b)=>a-b),n:obs});
    const existing=state.cart.find(x=>x.signature===signature);
    if(existing) existing.quantidade=Math.min(num(state.modalProduct.estoque,99),num(existing.quantidade)+state.modalQty);
    else state.cart.push({signature,produto_id:Number(state.modalProduct.id),upsell_id:upsellId,nome:state.modalProduct.nome,imagem:state.modalProduct.imagem,preco_base:modalBasePrice(),quantidade:state.modalQty,opcoes:ops,removidos:rem,observacao:obs});
    const addedProduct=state.modalProduct, addedViaUpsell=!!upsellId;
    persistCart(); renderCart(); closeModal("productModal"); state.modalUpsell=null; toast(`${addedProduct.nome} adicionado ao carrinho.`);
    if(!addedViaUpsell)showUpsellFor(addedProduct);
  }

  function cartProduct(item){ return state.produtos.find(p=>Number(p.id)===Number(item.produto_id)); }
  function cartUpsell(item){ return item?.upsell_id ? state.upsells.find(u=>Number(u.id)===Number(item.upsell_id) && u.ativo!==false && Number(u.produto_ofertado_id)===Number(item.produto_id) && u.preco_promocional!=null) : null; }
  function cartItemSignature(item, upsellId=item?.upsell_id||null){
    return JSON.stringify({
      p:Number(item.produto_id),
      u:upsellId?Number(upsellId):null,
      o:(item.opcoes||[]).map(x=>Number(x.id)).sort((a,b)=>a-b),
      r:(item.removidos||[]).map(x=>Number(x.id)).sort((a,b)=>a-b),
      n:String(item.observacao||"")
    });
  }
  function offerMatchesTriggerItem(offer,item){
    if(!offer||!item||item.upsell_id)return false;
    const p=cartProduct(item); if(!p)return false;
    return (offer.produto_gatilho_id!=null && Number(offer.produto_gatilho_id)===Number(p.id)) ||
      (String(offer.categoria_gatilho||"").trim() && String(offer.categoria_gatilho).trim().toLowerCase()===String(p.categoria||"").trim().toLowerCase());
  }
  function triggerQuantityForOffer(offer){
    return state.cart.reduce((total,item)=>total+(offerMatchesTriggerItem(offer,item)?Math.max(1,Math.trunc(num(item.quantidade,1))):0),0);
  }
  function promoQuantityForOffer(offer,excludeIndex=-1){
    if(!offer)return 0;
    return state.cart.reduce((total,item,index)=>total+(index!==excludeIndex&&Number(item.upsell_id)===Number(offer.id)?Math.max(1,Math.trunc(num(item.quantidade,1))):0),0);
  }
  function availablePromoUnits(offer,excludeIndex=-1){ return Math.max(0,triggerQuantityForOffer(offer)-promoQuantityForOffer(offer,excludeIndex)); }
  function cartQuantityForProduct(productId,excludeIndex=-1){
    return state.cart.reduce((total,item,index)=>total+(index!==excludeIndex&&Number(item.produto_id)===Number(productId)?Math.max(1,Math.trunc(num(item.quantidade,1))):0),0);
  }
  function reconcileCartPromotions(){
    const before=JSON.stringify(state.cart);
    const remainingByOffer=new Map();
    const rebuilt=[];
    const pushMerged=item=>{
      const existing=rebuilt.find(x=>x.signature===item.signature);
      if(existing)existing.quantidade+=item.quantidade; else rebuilt.push(item);
    };

    for(const raw of state.cart){
      const p=cartProduct(raw);
      if(!p){pushMerged({...raw});continue;}
      const qty=Math.max(1,Math.trunc(num(raw.quantidade,1)));
      const offer=cartUpsell(raw);

      if(!raw.upsell_id||!offer){
        const normal={...raw,upsell_id:null,preco_base:num(p.preco),quantidade:qty};
        normal.signature=cartItemSignature(normal,null);
        pushMerged(normal);
        continue;
      }

      if(!remainingByOffer.has(Number(offer.id)))remainingByOffer.set(Number(offer.id),triggerQuantityForOffer(offer));
      const remaining=Math.max(0,remainingByOffer.get(Number(offer.id))||0);
      const promoQty=Math.min(qty,remaining);
      const normalQty=qty-promoQty;

      if(promoQty>0){
        const promo={...raw,upsell_id:Number(offer.id),preco_base:Math.min(num(p.preco),Math.max(0,num(offer.preco_promocional))),quantidade:promoQty};
        promo.signature=cartItemSignature(promo,promo.upsell_id);
        pushMerged(promo);
        remainingByOffer.set(Number(offer.id),remaining-promoQty);
      }
      if(normalQty>0){
        const normal={...raw,upsell_id:null,preco_base:num(p.preco),quantidade:normalQty};
        normal.signature=cartItemSignature(normal,null);
        pushMerged(normal);
      }
    }

    state.cart=rebuilt;
    if(JSON.stringify(state.cart)!==before)persistCart();
  }
  function cartUnit(item){ return num(item.preco_base)+(item.opcoes||[]).reduce((s,o)=>s+num(o.preco),0); }
  function cartSubtotal(){ return state.cart.reduce((s,i)=>s+cartUnit(i)*num(i.quantidade),0); }
  function selectedBairro(){ return state.bairros.find(b=>Number(b.id)===Number($("#neighborhoodSelect")?.value)); }
  function deliveryFee(){
    if(state.deliveryType==="Retirada")return 0;
    if(state.config?.usa_taxa_distancia===true && state.deliveryQuote?.disponivel){
      return num(state.deliveryQuote.taxa);
    }
    const b=selectedBairro();
    return b?num(b.taxa):num(state.config.taxa_entrega);
  }
  function minOrder(){ const b=selectedBairro(); return Math.max(num(state.config.pedido_minimo), state.deliveryType==="Entrega"?num(b?.pedido_minimo):0); }
  function couponEligibleSubtotal(){
    if(!state.coupon?.valido)return 0;
    const productId=state.coupon.aplica_produto_id==null?null:Number(state.coupon.aplica_produto_id);
    const category=String(state.coupon.aplica_categoria||"").trim().toLowerCase();
    return state.cart.reduce((total,item)=>{
      const product=cartProduct(item);
      const eligible=(!productId&&!category)||(productId&&Number(item.produto_id)===productId)||(category&&String(product?.categoria||"").trim().toLowerCase()===category);
      return total+(eligible?cartUnit(item)*num(item.quantidade):0);
    },0);
  }
  function estimatedDiscount(){ if(!state.coupon?.valido)return 0; const eligible=couponEligibleSubtotal(); if(state.coupon.tipo==="percentual")return Math.min(eligible,eligible*num(state.coupon.desconto)/100); if(state.coupon.tipo==="fixo")return Math.min(eligible,num(state.coupon.valor_desconto)); return 0; }

  function renderCart() {
    reconcileCartPromotions();
    const totalQty=state.cart.reduce((s,i)=>s+num(i.quantidade),0); const cartBadge=$("#cartBadge"); cartBadge.textContent=totalQty>99?"99+":totalQty; cartBadge.classList.toggle("zero",!totalQty); $("#cartCountText").textContent=`${totalQty} ${totalQty===1?"item":"itens"}`;
    $("#cartItems").innerHTML=state.cart.length?state.cart.map((i,index)=>{const details=[...(i.opcoes||[]).map(x=>x.nome),...((i.removidos||[]).length?[`Sem ${(i.removidos||[]).map(x=>x.nome).join(", ")}`]:[]),...(i.observacao?[`Obs.: ${i.observacao}`]:[]),...(i.upsell_id?["Preço promocional"] : [])].join(" · ");return `<article class="cart-item"><img src="${html(i.imagem||"../assets/placeholder-burger.svg")}" alt="${html(i.nome)}"><div><h4>${html(i.nome)}</h4>${details?`<p>${html(details)}</p>`:""}<span class="price">${money(cartUnit(i)*i.quantidade)}</span></div><div class="cart-item-actions"><button data-cart-remove="${index}" title="Remover"><i class="fa-solid fa-trash"></i></button><div class="inline-qty"><button data-cart-delta="-1" data-cart-index="${index}">−</button><b>${i.quantidade}</b><button data-cart-delta="1" data-cart-index="${index}">+</button></div></div></article>`;}).join(""):empty("fa-bag-shopping","Seu carrinho está vazio","Escolha algo gostoso no cardápio.");
    const sub=cartSubtotal(), disc=estimatedDiscount(), fee=state.coupon?.frete_gratis?0:deliveryFee(), total=Math.max(0,sub-disc)+fee;
    $("#cartSubtotal").textContent=money(sub); $("#cartDiscount").textContent=`- ${money(disc)}`; $("#cartDeliveryFee").textContent=money(fee); $("#cartTotal").textContent=money(total);
    const modes=checkoutModes();
    $("#checkoutBtn").disabled=!state.cart.length||(!modes.entrega&&!modes.retirada)||(!state.storeOpen&&!modes.agendamento);
  }

  function updateCartQty(index,delta){
    const i=state.cart[index];if(!i)return;
    const p=cartProduct(i);if(!p)return;
    const current=Math.max(1,Math.trunc(num(i.quantidade,1)));
    const stockMax=Math.max(0,Math.trunc(num(p.estoque))-cartQuantityForProduct(p.id,index));
    let maxQty=stockMax;
    const offer=cartUpsell(i);
    if(offer)maxQty=Math.min(maxQty,availablePromoUnits(offer,index));
    maxQty=Math.max(1,maxQty);
    const requested=current+Number(delta);
    if(Number(delta)>0&&requested>maxQty){
      return toast(offer?`Esta oferta permite no máximo ${maxQty} unidade(s) promocional(is) para os itens gatilho do carrinho.`:`Estoque disponível para este produto: ${maxQty}.`,"info");
    }
    i.quantidade=Math.max(1,Math.min(maxQty,requested));
    persistCart();renderCart();
  }
  function removeCart(index){state.cart.splice(index,1);persistCart();renderCart();}
  function openCart(){renderCheckoutOptions();renderCart();$("#cartOverlay").classList.add("show");$("#cartDrawer").classList.add("open");document.body.style.overflow="hidden";}
  function closeCart(){$("#cartOverlay").classList.remove("show");$("#cartDrawer").classList.remove("open");document.body.style.overflow="";}

  function checkoutModes(){
    const paused = state.loja?.status === "pausada" || state.loja?.status === "bloqueada" || state.loja?.status === "rascunho";
    return {
      entrega: !paused && state.config.aceita_entrega !== false,
      retirada: !paused && state.config.aceita_retirada !== false,
      agendamento: !paused && state.config.agendamento_ativo === true
    };
  }

  function normalizeCheckoutAvailability(){
    const modes=checkoutModes();

    if(state.deliveryType==="Entrega"&&!modes.entrega&&modes.retirada)state.deliveryType="Retirada";
    if(state.deliveryType==="Retirada"&&!modes.retirada&&modes.entrega)state.deliveryType="Entrega";

    if(!modes.agendamento){
      state.schedule="agora";
    }else if(!state.storeOpen&&state.schedule==="agora"){
      state.schedule="agendar";
    }
  }

  function renderDeliveryChoices(){
    normalizeCheckoutAvailability();
    const modes=checkoutModes();

    $$('[data-delivery]').forEach(b=>{
      const t=b.dataset.delivery;
      const disabled=(t==="Entrega"&&!modes.entrega)||(t==="Retirada"&&!modes.retirada);
      b.disabled=disabled;
      b.classList.toggle("active",!disabled&&state.deliveryType===t);
      b.setAttribute("aria-disabled",String(disabled));
    });

    $("#deliveryFields")?.classList.toggle("hidden",state.deliveryType!=="Entrega");
  }

  function updateCheckoutProgress(){
    const steps=[...document.querySelectorAll("[data-checkout-step]")];
    if(!steps.length)return;
    const hasDelivery=state.deliveryType==="Retirada"||Boolean(String($("#checkoutAddress")?.value||"").trim())||Boolean($("#savedAddressSelect")?.value);
    const hasNeighborhood=state.deliveryType==="Retirada"||!state.bairros.length||Boolean($("#neighborhoodSelect")?.value);
    const completed={recebimento:true,endereco:hasDelivery&&hasNeighborhood,pagamento:Boolean(state.payment||state.onlinePayment),revisao:state.cart.length>0&&hasDelivery&&hasNeighborhood};
    let current="recebimento";
    if(completed.endereco)current="pagamento";
    if(completed.pagamento&&completed.endereco)current="revisao";
    steps.forEach(step=>{const key=step.dataset.checkoutStep;step.classList.toggle("done",completed[key]&&key!==current);step.classList.toggle("active",key===current);});
  }

  function renderCheckoutOptions(){
    normalizeCheckoutAvailability();
    renderDeliveryChoices();
    updateCheckoutProgress();

    const selected=$("#neighborhoodSelect")?.value;
    $("#neighborhoodSelect").innerHTML='<option value="">📍 Selecione o bairro / região</option>'+state.bairros.map(b=>`<option value="${b.id}">${html(b.nome)} · entrega ${money(b.taxa)}${num(b.tempo_extra_min)>0?` · +${num(b.tempo_extra_min)} min`:``}</option>`).join("");
    if(selected&&state.bairros.some(b=>String(b.id)===selected))$("#neighborhoodSelect").value=selected;

    const aSel=$("#savedAddressSelect")?.value;
    $("#savedAddressSelect").innerHTML='<option value="">＋ Informar outro endereço</option>'+state.enderecos.map(a=>`<option value="${a.id}">${a.principal?`★ `:``}${html(a.apelido||"Endereço")} · ${html(a.logradouro)}, ${html(a.numero||"s/n")}</option>`).join("");
    if(aSel&&state.enderecos.some(a=>String(a.id)===aSel))$("#savedAddressSelect").value=aSel;
    else {
      const main=state.enderecos.find(a=>a.principal);
      if(main){
        $("#savedAddressSelect").value=main.id;
        applySavedAddress(main.id);
      }else if(state.profile?.endereco&&!$("#checkoutAddress").value){
        $("#checkoutAddress").value=state.profile.endereco;
      }
    }

    $("#addressNeighborhood").innerHTML='<option value="">Selecione</option>'+state.bairros.map(b=>`<option value="${b.id}">${html(b.nome)}</option>`).join("");

    const modes=checkoutModes();
    $$('[data-schedule]').forEach(b=>{
      const isSchedule=b.dataset.schedule==="agendar";
      b.disabled=isSchedule&&!modes.agendamento;
      b.classList.toggle("active",!b.disabled&&b.dataset.schedule===state.schedule);
      b.setAttribute("aria-disabled",String(b.disabled));
    });

    const scheduleInput=$("#scheduleAt");
    scheduleInput.classList.toggle("hidden",state.schedule!=="agendar"||!modes.agendamento);
    scheduleInput.disabled=!modes.agendamento;
    setScheduleBounds();

    const helper=$("#scheduleAvailabilityMessage");
    if(helper){
      if(!modes.entrega&&!modes.retirada){
        helper.textContent="A loja não está aceitando entrega nem retirada neste momento.";
        helper.className="helper error";
      }else if(!state.storeOpen&&modes.agendamento){
        helper.textContent="A loja está fechada agora. Escolha um horário disponível para agendar.";
        helper.className="helper";
      }else if(!modes.agendamento){
        helper.textContent="Agendamento indisponível. Pedidos são aceitos somente para agora, durante o horário de funcionamento.";
        helper.className="helper";
      }else{
        helper.textContent=`Agende com pelo menos ${num(state.config.agendamento_antecedencia_min,30)} min de antecedência, em até ${num(state.config.agendamento_max_dias,7)} dia(s).`;
        helper.className="helper";
      }
    }

    $$('[data-payment]').forEach(b=>b.classList.toggle("active",!state.onlinePayment&&b.dataset.payment===state.payment));
    $("#cardFields").classList.toggle("hidden",state.onlinePayment||state.payment!=="Cartão");
    $("#cashFields").classList.toggle("hidden",state.onlinePayment||state.payment!=="Dinheiro");
    $("#pixBox").classList.toggle("hidden",state.onlinePayment||state.payment!=="PIX");
    $("#onlinePaymentChoice")?.classList.toggle("active",state.onlinePayment);
  }

  function setScheduleBounds(){
    const input=$("#scheduleAt");
    if(!input)return;

    const min=new Date(Date.now()+num(state.config.agendamento_antecedencia_min,30)*60000);
    const max=new Date(Date.now()+num(state.config.agendamento_max_dias,7)*86400000);
    const local=v=>new Date(v.getTime()-v.getTimezoneOffset()*60000).toISOString().slice(0,16);

    input.min=local(min);
    input.max=local(max);

    const current=input.value?new Date(input.value):null;
    if(!current||Number.isNaN(current.getTime())||current<min||current>max){
      input.value=local(min);
    }
  }

  async function validateScheduleBeforeCheckout(){
    const modes=checkoutModes();

    if(!modes.entrega&&!modes.retirada)throw new Error("A loja não está aceitando entrega nem retirada neste momento.");
    if(state.deliveryType==="Entrega"&&!modes.entrega)throw new Error("A loja não está aceitando entregas neste momento.");
    if(state.deliveryType==="Retirada"&&!modes.retirada)throw new Error("A loja não está aceitando retiradas neste momento.");

    if(state.schedule!=="agendar"){
      await loadStoreOpen();
      if(!state.storeOpen){
        throw new Error(modes.agendamento?"A loja está fechada agora. Selecione Agendar e escolha um horário disponível.":(state.config.mensagem_loja_fechada||"A loja está fechada no momento."));
      }
      return null;
    }

    if(!modes.agendamento)throw new Error("A loja não aceita pedidos agendados.");

    const raw=$("#scheduleAt")?.value;
    if(!raw)throw new Error("Escolha a data e o horário do agendamento.");

    const scheduled=new Date(raw);
    if(Number.isNaN(scheduled.getTime()))throw new Error("Data ou horário de agendamento inválido.");

    const min=new Date(Date.now()+num(state.config.agendamento_antecedencia_min,30)*60000);
    const max=new Date(Date.now()+num(state.config.agendamento_max_dias,7)*86400000);

    if(scheduled<min)throw new Error("O horário escolhido não respeita a antecedência mínima.");
    if(scheduled>max)throw new Error("O agendamento está além do limite permitido.");

    const availability=await db.rpc("go_burger_loja_aberta_em",{p_loja_id:state.loja.id,p_momento:scheduled.toISOString()});
    if(availability.error)throw availability.error;
    if(!availability.data)throw new Error("A loja estará fechada no horário escolhido.");

    return scheduled;
  }
  function applySavedAddress(id){const a=state.enderecos.find(x=>Number(x.id)===Number(id));if(!a)return;const parts=[a.logradouro,a.numero,a.complemento,a.bairro,a.cidade,a.estado,a.referencia?`Ref.: ${a.referencia}`:null].filter(Boolean);$("#checkoutAddress").value=parts.join(", ");if(a.bairro_id){$("#neighborhoodSelect").value=String(a.bairro_id);}state.deliveryCoords=(a.latitude!=null&&a.longitude!=null)?{latitude:num(a.latitude),longitude:num(a.longitude),precisao:null}:null;state.deliveryQuote=null;renderCart();}

  async function applyCoupon(){const code=String($("#couponInput").value||"").trim().toUpperCase(),msg=$("#couponMessage");if(!code){state.coupon=null;msg.textContent="";renderCart();return;}const b=$("#applyCoupon");setButton(b,true,"...");try{const r=await db.rpc("validar_cupom_detalhado_v10",{p_loja_id:state.loja.id,p_codigo:code});if(r.error)throw r.error;const c=Array.isArray(r.data)?r.data[0]:r.data;if(!c?.valido){state.coupon=null;msg.className="helper error";msg.textContent=c?.mensagem||"Cupom inválido.";return renderCart();}state.coupon=c;msg.className="helper success";msg.textContent=`${c.mensagem} O servidor confirmará o valor final.`;renderCart();toast("Cupom aplicado.");}catch(e){state.coupon=null;msg.className="helper error";msg.textContent=e.message;renderCart();}finally{setButton(b,false);}}

  async function checkout(){
    if(!FINANCE_ENABLED) state.onlinePayment=false;
    if(state.checkoutInFlight)return toast("Seu pedido já está sendo processado.","info");
    if(!state.cart.length)return toast("Seu carrinho está vazio.","error");
    if(!requireLogin("finalizar seu pedido"))return;

    const tableMode=Boolean(state.tableContext?.comanda_id&&state.tableContext?.public_id);
    const modes=checkoutModes();
    if(!tableMode&&!modes.entrega&&!modes.retirada)return toast("A loja não está aceitando entrega nem retirada neste momento.","error");
    if(!tableMode&&state.deliveryType==="Entrega"&&!modes.entrega)return toast("A loja não está aceitando entregas neste momento.","error");
    if(!tableMode&&state.deliveryType==="Retirada"&&!modes.retirada)return toast("A loja não está aceitando retiradas neste momento.","error");

    const sub=cartSubtotal(), min=minOrder();
    if(sub<min)return toast(`O pedido mínimo para esta opção é ${money(min)}.`,"error");

    if(!tableMode&&state.deliveryType==="Entrega"&&!String($("#checkoutAddress").value||"").trim())return toast("Informe o endereço de entrega.","error");
    if(!tableMode&&state.deliveryType==="Entrega"&&state.bairros.length&&!$("#neighborhoodSelect").value)return toast("Selecione o bairro de entrega.","error");

    const b=$("#checkoutBtn");
    state.checkoutInFlight=true;
    setButton(b,true,"Confirmando...");

    try{
      const scheduled=await validateScheduleBeforeCheckout();

      if(!tableMode&&state.deliveryType==="Entrega"&&state.config?.usa_taxa_distancia===true){
        if(!state.deliveryCoords){
          throw new Error("Use sua localização para calcular a taxa de entrega por distância.");
        }
        const prepared=await db.rpc("go_burger_preparar_entrega_distancia_v1",{
          p_loja_id:state.loja.id,
          p_latitude:state.deliveryCoords.latitude,
          p_longitude:state.deliveryCoords.longitude
        });
        if(prepared.error)throw prepared.error;
        state.deliveryQuote=prepared.data||state.deliveryQuote;
      }

      const items=state.cart.map(i=>({produto_id:i.produto_id,quantidade:i.quantidade,upsell_id:i.upsell_id||null,opcoes:(i.opcoes||[]).map(o=>o.id),removidos:(i.removidos||[]).map(r=>r.id),observacao:i.observacao||null}));
      const params={p_loja_id:state.loja.id,p_endereco:state.deliveryType==="Entrega"?String($("#checkoutAddress").value).trim():"Retirada na loja",p_itens:items,p_cupom:state.coupon?.codigo||null,p_forma_pagamento:state.payment,p_cartao_tipo:state.payment==="Cartão"?$("#cardType").value:null,p_troco_para:state.payment==="Dinheiro"&&$("#cashChange").value?num($("#cashChange").value):null,p_tipo_entrega:state.deliveryType,p_bairro_id:state.deliveryType==="Entrega"&&$("#neighborhoodSelect").value?Number($("#neighborhoodSelect").value):null,p_agendado_para:scheduled?scheduled.toISOString():null,p_observacao:String($("#orderNote").value||"").trim()||null};
      const r=tableMode
        ? await db.rpc("go_burger_criar_pedido_mesa_v36",{
            p_mesa_public_id:state.tableContext.public_id,
            p_comanda_id:state.tableContext.comanda_id,
            p_itens:items,
            p_cupom:state.coupon?.codigo||null,
            p_forma_pagamento:state.payment,
            p_cartao_tipo:state.payment==="Cartão"?$("#cardType").value:null,
            p_troco_para:state.payment==="Dinheiro"&&$("#cashChange").value?num($("#cashChange").value):null,
            p_observacao:String($("#orderNote").value||"").trim()||null
          })
        : await db.rpc("criar_pedido_v10",params);
      if(r.error)throw r.error;const id=Number(r.data);
      if(!tableMode&&state.deliveryType==="Entrega"&&state.deliveryCoords&&state.config?.usa_taxa_distancia!==true){
        const geo=await db.rpc("go_burger_definir_local_entrega_v1",{p_pedido_id:id,p_latitude:state.deliveryCoords.latitude,p_longitude:state.deliveryCoords.longitude});
        if(geo.error)console.warn("Go-burger localização da entrega",geo.error.message);
      }
      await trackEvent("pedido_criado",{pedido_id:id,tipo_entrega:state.deliveryType,online:state.onlinePayment});
      try{
        await db.rpc("go_burger_converter_carrinho_v1",{
          p_loja_id:state.loja.id,
          p_sessao_id:state.cartSessionId,
          p_pedido_id:id
        });
      }catch{}
      const payOnline=state.onlinePayment;
      state.cart=[];state.coupon=null;state.deliveryQuote=null;persistCart();$("#couponInput").value="";$("#couponMessage").textContent="";$("#orderNote").value="";renderCart();closeCart();
      await Promise.all([loadOrders(),fetchOne("produtos",()=>db.from("produtos").select("*").eq("loja_id",state.loja.id).eq("ativo",true).order("ordem")),fetchOne("movimentos",()=>db.from("fidelidade_movimentos").select("*").eq("loja_id",state.loja.id).eq("user_id",state.user.id).order("criado_em",{ascending:false}).limit(100)),fetchOne("resgates",()=>db.from("fidelidade_resgates").select("*").eq("loja_id",state.loja.id).eq("user_id",state.user.id).order("criado_em",{ascending:false})),fetchOne("notificacoes",()=>db.from("notificacoes").select("*").eq("loja_id",state.loja.id).order("criado_em",{ascending:false}).limit(100))]);
      renderAll();toast(`Pedido #${id} recebido pela loja!`);
      if(payOnline){const redirected=await startOnlinePayment(id);if(redirected)return;}
      navigate("pedidos");setTimeout(()=>openOrder(id),200);
    }catch(e){toast(e.message||"Não foi possível concluir o pedido.","error");}
    finally{state.checkoutInFlight=false;setButton(b,false);}
  }

  function showUpsellFor(product){const offer=state.upsells.find(u=>Number(u.produto_gatilho_id)===Number(product.id)||(u.categoria_gatilho&&String(u.categoria_gatilho).trim().toLowerCase()===String(product.categoria||"").trim().toLowerCase()));if(!offer||availablePromoUnits(offer)<=0)return;const p=state.produtos.find(x=>Number(x.id)===Number(offer.produto_ofertado_id));if(!productAvailable(p))return;state.upsell={offer,product:p};$("#upsellImage").src=p.imagem||"../assets/placeholder-burger.svg";$("#upsellName").textContent=offer.nome||p.nome;$("#upsellPrice").textContent=offer.preco_promocional!=null?`Oferta: ${money(Math.min(num(p.preco),Math.max(0,num(offer.preco_promocional))))}`:`A partir de ${money(p.preco)}`;$("#upsellToast").classList.remove("hidden");}
  function closeUpsell(){$("#upsellToast").classList.add("hidden");state.upsell=null;}

  function visibleBanners(){
    const now=Date.now();
    return state.banners.filter(b=>{
      const start=b.valido_de?new Date(b.valido_de).getTime():null;
      const end=b.valido_ate?new Date(b.valido_ate).getTime():null;
      return b.ativo!==false && (!start||Number.isNaN(start)||now>=start) && (!end||Number.isNaN(end)||now<=end);
    });
  }
  function renderBanners(){clearInterval(state.bannerTimer);const wrap=$("#bannerSection"),list=visibleBanners();if(!list.length){wrap.classList.add("hidden");return;}wrap.classList.remove("hidden");state.bannerIndex=Math.min(state.bannerIndex,list.length-1);$("#bannerTrack").innerHTML=list.map((b,i)=>`<article class="banner-slide" data-banner="${i}">${b.imagem_url?`<img src="${html(b.imagem_url)}" alt="">`:""}<div class="banner-content"><h3>${html(b.titulo)}</h3><p>${html(b.subtitulo||"")}</p>${b.texto_botao?`<button class="btn primary small" data-banner-action="${i}">${html(b.texto_botao)}</button>`:""}</div></article>`).join("");$("#bannerDots").innerHTML=list.map((_,i)=>`<button class="${i===state.bannerIndex?"active":""}" data-banner-dot="${i}"></button>`).join("");updateBanner();if(list.length>1)state.bannerTimer=setInterval(()=>{const current=visibleBanners();if(!current.length)return renderBanners();state.bannerIndex=(state.bannerIndex+1)%current.length;updateBanner();},6500);}
  function updateBanner(){$("#bannerTrack").style.transform=`translateX(-${state.bannerIndex*100}%)`;$$('[data-banner-dot]').forEach(b=>b.classList.toggle("active",Number(b.dataset.bannerDot)===state.bannerIndex));}
  function bannerAction(index){const b=visibleBanners()[index];if(!b)return;if(b.link_tipo==="produto"&&b.link_valor)return openProduct(Number(b.link_valor));if(b.link_tipo==="categoria"&&b.link_valor){state.menuCategory=b.link_valor;renderCategories();renderProducts();return navigate("cardapio");}navigate("cardapio");}

  function orderProgress(status){const stages=["Recebido","Em preparo","Pronto","Saiu para entrega","Concluído"];if(status==="Cancelado")return `<div class="order-progress"><span></span><span></span><span></span><span></span><span></span></div>`;const idx=Math.max(0,stages.indexOf(status));return `<div class="order-progress">${stages.map((_,i)=>`<span class="${i<=idx?"done":""}"></span>`).join("")}</div>`;}
  function orderSummary(o){return (o.pedido_itens||[]).slice(0,3).map(i=>`${i.quantidade}x ${i.nome||i.nome_produto||"Produto"}`).join(" · ")+((o.pedido_itens||[]).length>3?` · +${o.pedido_itens.length-3}`:"");}
  function filteredOrders(){return state.pedidos.filter(o=>state.orderFilter==="todos"||(state.orderFilter==="andamento"&&["Recebido","Em preparo","Pronto","Saiu para entrega"].includes(o.status))||(state.orderFilter==="concluidos"&&o.status==="Concluído")||(state.orderFilter==="cancelados"&&o.status==="Cancelado"));}
  function renderOrders(){const list=filteredOrders();$("#ordersList").innerHTML=list.length?list.map(o=>{const reviewed=state.avaliacoes.some(a=>Number(a.pedido_id)===Number(o.id));return `<article class="order-card"><div class="order-card-head"><div><h3>Pedido #${o.numero_loja||o.id}</h3><small>${dt(o.criado_em)} · ${html(o.tipo_entrega||"Entrega")}</small></div><span class="status ${slug(o.status)}">${html(o.status)}</span></div><div class="order-summary">${html(orderSummary(o)||"Itens do pedido")}</div>${orderProgress(o.status)}<div class="order-card-footer"><strong>${money(o.total)}</strong><div class="order-actions"><button class="btn secondary small" data-order-details="${o.id}">Detalhes</button>${o.status==="Recebido"?`<button class="btn danger small" data-cancel-order="${o.id}">Cancelar</button>`:""}${o.status==="Concluído"&&!reviewed?`<button class="btn secondary small" data-review-order="${o.id}"><i class="fa-solid fa-star"></i> Avaliar</button>`:""}${o.status!=="Cancelado"?`<button class="btn secondary small" data-reorder="${o.id}">Pedir novamente</button>`:""}</div></div></article>`;}).join(""):empty("fa-receipt","Nenhum pedido","Seus pedidos aparecerão aqui.");}

  function orderItemDetails(i){const ops=i.pedido_item_opcoes||[],rem=i.pedido_item_removidos||[],parts=[];if(ops.length)parts.push(ops.map(x=>`${x.nome}${num(x.preco_adicional)>0?` (+${money(x.preco_adicional)})`:""}`).join(", "));if(rem.length)parts.push(`Sem ${rem.map(x=>x.nome).join(", ")}`);if(i.observacao)parts.push(`Obs.: ${i.observacao}`);return parts.join(" · ");}
  function openOrder(id){
    const o=state.pedidos.find(x=>Number(x.id)===Number(id));
    if(!o)return;

    $("#orderModalTitle").textContent=`Pedido #${o.numero_loja||o.id}`;
    const reviewed=state.avaliacoes.find(a=>Number(a.pedido_id)===Number(o.id));
    const showTracking=o.tipo_entrega==="Entrega"&&!["Cancelado","Concluído"].includes(o.status);

    $("#orderModalContent").innerHTML=`
      <div class="order-detail-grid">
        <div class="detail-box"><span>Status</span><strong>${html(o.status)}</strong></div>
        <div class="detail-box"><span>Recebimento</span><strong>${html(o.tipo_entrega||"Entrega")}</strong></div>
        <div class="detail-box"><span>Pagamento</span><strong>${html(o.forma_pagamento||"—")}</strong><small>${html(o.pagamento_status||"—")}</small></div>
        <div class="detail-box"><span>Data</span><strong>${dt(o.criado_em)}</strong><small>${o.agendado_para?`Agendado: ${dt(o.agendado_para)}`:"Pedido imediato"}</small></div>
      </div>

      ${o.endereco?`<div class="panel" style="margin-top:10px"><span class="eyebrow">LOCAL</span><p style="font-size:10px">${html(o.endereco)}${o.bairro_nome?` · ${html(o.bairro_nome)}`:""}</p></div>`:""}
      ${o.observacao?`<div class="panel" style="margin-top:10px"><span class="eyebrow">OBSERVAÇÃO</span><p style="font-size:10px">${html(o.observacao)}</p></div>`:""}

      <div class="order-detail-items">
        ${(o.pedido_itens||[]).map(i=>`
          <div class="order-detail-item">
            <div>
              <strong>${i.quantidade}x ${html(i.nome||i.nome_produto||"Produto")}</strong>
              ${orderItemDetails(i)?`<small>${html(orderItemDetails(i))}</small>`:""}
            </div>
            <strong>${money(i.subtotal)}</strong>
          </div>
        `).join("")}
      </div>

      <div class="order-total-box"><span>Total</span><strong>${money(o.total)}</strong></div>

      <div class="modal-actions" style="margin-top:12px">
        ${o.status==="Recebido"?`<button class="btn danger" data-cancel-order="${o.id}">Cancelar pedido</button>`:""}
        ${o.status==="Concluído"&&!reviewed?`<button class="btn secondary" data-review-order="${o.id}">Avaliar pedido</button>`:""}
        ${o.status!=="Cancelado"?`<button class="btn primary" data-reorder="${o.id}">Pedir novamente</button>`:""}
      </div>

      ${showTracking?`
        <div class="delivery-tracking-box" data-delivery-tracking-box="${o.id}">
          <div class="tracking-head">
            <div><i class="fa-solid fa-motorcycle"></i><strong>Rastreamento da entrega</strong></div>
            <span class="status aguardando">aguardando</span>
          </div>
          <p>Acompanhe a última localização compartilhada pelo entregador.</p>
          <div class="delivery-tracking-actions">
            <button class="btn secondary small" type="button" data-track-delivery="${o.id}">
              <i class="fa-solid fa-location-crosshairs"></i>
              Atualizar localização
            </button>
          </div>
        </div>
      `:""}
    `;

    openModal("orderModal");
    clearInterval(state.trackingTimer);
    if(showTracking){
      loadDeliveryTracking(o.id);
      state.trackingTimer=setInterval(()=>{
        if(!$("#orderModal")?.classList.contains("active")){clearInterval(state.trackingTimer);state.trackingTimer=null;return;}
        loadDeliveryTracking(o.id);
      },15000);
    }
  }


  async function loadDeliveryTracking(pedidoId){
    const target=$(`[data-delivery-tracking-box="${pedidoId}"]`);
    if(target)target.innerHTML='<p><i class="fa-solid fa-spinner fa-spin"></i> Atualizando localização...</p>';
    try{
      const {data,error}=await db.rpc("go_burger_rastrear_entrega_v1",{p_pedido_id:Number(pedidoId)});
      if(error)throw error;
      const row=data||{};
      const hasCoords=Number.isFinite(Number(row.latitude))&&Number.isFinite(Number(row.longitude));
      const mapUrl=hasCoords
        ?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${row.latitude},${row.longitude}`)}`
        :"";
      if(target){
        target.innerHTML=`
          <div class="tracking-head">
            <div><i class="fa-solid fa-motorcycle"></i><strong>${html(row.entregador?`Entregador: ${row.entregador}`:"Aguardando entregador")}</strong></div>
            <span class="status ${slug(row.status_entrega||"aguardando")}">${html(String(row.status_entrega||"aguardando").replaceAll("_"," "))}</span>
          </div>
          <p>${hasCoords?`Última localização recebida ${row.localizacao_em?dt(row.localizacao_em):"agora"}.`:"A localização aparecerá quando o entregador iniciar a rota e compartilhar a posição."}${row.previsao_min!=null?` · ${row.rastreamento_ativo?"Chegada estimada":"Previsão"}: ${html(row.previsao_min)} min.`:""}${(row.distancia_restante_km??row.distancia_km)!=null?` · ${row.rastreamento_ativo?"Restante":"Distância"}: ${num(row.distancia_restante_km??row.distancia_km).toFixed(1)} km.`:""}</p>
          ${hasCoords?`<div class="tracking-signal"><span><i class="fa-solid fa-signal"></i> Sinal: <strong>${html(String(row.qualidade_sinal||"—").replaceAll("_"," "))}</strong></span>${row.eta_confianca?`<span>ETA: <strong>confiança ${html(row.eta_confianca)}</strong></span>`:""}${row.velocidade_kmh!=null?`<span>Velocidade aprox.: <strong>${num(row.velocidade_kmh).toFixed(0)} km/h</strong></span>`:""}</div>`:""}
          <div class="delivery-tracking-actions">
            <button class="btn secondary small" type="button" data-track-delivery="${pedidoId}">
              <i class="fa-solid fa-rotate"></i> Atualizar
            </button>
            ${mapUrl?`<a class="btn primary small" href="${mapUrl}" target="_blank" rel="noopener"><i class="fa-solid fa-map-location-dot"></i> Ver no mapa</a>`:""}
          </div>`;
      }
    }catch(error){
      if(target)target.innerHTML=`<p>${html(error.message||"Não foi possível atualizar o rastreamento.")}</p>`;
    }
  }

  async function cancelOrder(id){if(!confirm(`Cancelar o pedido #${id}?`))return;try{const r=await db.rpc("cancelar_meu_pedido",{p_pedido_id:Number(id)});if(r.error)throw r.error;await loadOrders();renderOrders();closeModal("orderModal");toast("Pedido cancelado e estoque devolvido.");}catch(e){toast(e.message,"error");}}
  function reorder(id){const o=state.pedidos.find(x=>Number(x.id)===Number(id));if(!o)return;let added=0;for(const item of o.pedido_itens||[]){const p=state.produtos.find(x=>Number(x.id)===Number(item.produto_id));if(!productAvailable(p))continue;const ops=(item.pedido_item_opcoes||[]).map(x=>state.opcoes.find(o=>Number(o.id)===Number(x.opcao_id))).filter(Boolean).map(x=>({id:Number(x.id),nome:x.nome,preco:num(x.preco_adicional)}));const rem=(item.pedido_item_removidos||[]).map(x=>state.ingredientes.find(i=>Number(i.id)===Number(x.ingrediente_id))).filter(Boolean).map(x=>({id:Number(x.id),nome:x.nome}));const obs=item.observacao||"";const signature=JSON.stringify({p:Number(p.id),u:null,o:ops.map(x=>x.id).sort((a,b)=>a-b),r:rem.map(x=>x.id).sort((a,b)=>a-b),n:obs});const ex=state.cart.find(x=>x.signature===signature);if(ex)ex.quantidade+=num(item.quantidade,1);else state.cart.push({signature,produto_id:Number(p.id),upsell_id:null,nome:p.nome,imagem:p.imagem,preco_base:num(p.preco),quantidade:num(item.quantidade,1),opcoes:ops,removidos:rem,observacao:obs});added++;}persistCart();renderCart();if(added){closeModal("orderModal");openCart();toast(`${added} item(ns) adicionado(s) novamente.`);}else toast("Os produtos desse pedido não estão disponíveis agora.","info");}

  function openReview(id){const o=state.pedidos.find(x=>Number(x.id)===Number(id));if(!o||o.status!=="Concluído")return;const existing=state.avaliacoes.find(a=>Number(a.pedido_id)===Number(id));state.reviewStars=existing?.nota||5;$("#reviewForm").elements.pedido_id.value=id;$("#reviewForm").elements.comentario.value=existing?.comentario||"";$("#reviewTitle").textContent=existing?`Editar avaliação do pedido #${id}`:`Como foi o pedido #${id}?`;renderStars();openModal("reviewModal");}
  function renderStars(){$$('[data-star]').forEach(b=>b.classList.toggle("active",Number(b.dataset.star)<=state.reviewStars));}
  async function saveReview(event){event.preventDefault();const f=event.currentTarget,b=f.querySelector('[type="submit"]'),pedidoId=Number(f.elements.pedido_id.value);setButton(b,true,"Enviando...");try{const payload={loja_id:state.loja.id,nota:state.reviewStars,comentario:String(f.elements.comentario.value||"").trim()||null,atualizado_em:new Date().toISOString()};const existing=state.avaliacoes.find(a=>Number(a.pedido_id)===pedidoId);const r=existing?await db.from("avaliacoes").update(payload).eq("id",existing.id):await db.from("avaliacoes").insert({...payload,user_id:state.user.id,pedido_id:pedidoId});if(r.error)throw r.error;await fetchOne("avaliacoes",()=>db.from("avaliacoes").select("*").eq("loja_id",state.loja.id).eq("user_id",state.user.id).order("criado_em",{ascending:false}));closeModal("reviewModal");renderOrders();toast(existing?"Avaliação atualizada.":"Obrigado pela avaliação! ⭐");}catch(e){toast(e.message,"error");}finally{setButton(b,false);}}

  async function renderLoyalty(){
    const balance=await loadLoyaltyBalance(),active=!!state.config.fidelidade_ativa;
    $("#loyaltyBalance").textContent=balance;
    $("#homePoints").textContent=`${balance} pontos`;
    $("#profilePoints").textContent=balance;
    $("#loyaltyRule").textContent=active?`${num(state.config.pontos_por_real,1)} ponto(s) a cada R$ 1 em pedidos pagos e concluídos.`:"O programa de fidelidade está temporariamente desativado.";
    $("#rewardGrid").innerHTML=state.recompensas.length?state.recompensas.map(r=>{
      const needed=num(r.pontos_necessarios),can=active&&balance>=needed;
      return `<article class="reward-card ${can?"":"locked"}"><span class="points">${needed} pts</span><h3>${html(r.nome)}</h3><p>${html(r.descricao||rewardText(r))}</p><p>${!active?"Programa temporariamente desativado.":can?"Você já pode resgatar esta recompensa.":`Faltam ${Math.max(0,needed-balance)} pontos.`}</p><button class="btn ${can?"primary":"secondary"} small reward-redeem" type="button" data-redeem-reward="${r.id}" ${can?"":"disabled"}><i class="fa-solid fa-gift"></i> ${can?"Resgatar":"Pontos insuficientes"}</button></article>`;
    }).join(""):empty("fa-star","Sem recompensas","A loja ainda não cadastrou recompensas.");
    const red=$("#redemptionList");
    if(red)red.innerHTML=state.resgates.length?state.resgates.map(r=>`<article class="redemption-card ${html(r.status)}"><div class="redemption-icon"><i class="fa-solid ${r.status==="usado"?"fa-circle-check":r.status==="cancelado"?"fa-ban":"fa-ticket"}"></i></div><div class="redemption-main"><div class="redemption-head"><strong>${html(r.recompensa_nome)}</strong><span class="status ${r.status==="disponivel"?"ativo":r.status==="usado"?"concluido":"inativo"}">${r.status==="disponivel"?"Disponível":r.status==="usado"?"Usado":"Cancelado"}</span></div><p>${html(redeemText(r))}</p><code>${html(r.codigo)}</code><small>${r.pontos_gastos} pontos · ${dt(r.criado_em)}</small></div>${r.status==="disponivel"?`<div class="redemption-actions"><button class="btn primary small" type="button" data-use-redemption="${r.id}"><i class="fa-solid fa-bag-shopping"></i> Usar no pedido</button><button class="btn secondary small" type="button" data-cancel-redemption="${r.id}">Cancelar resgate</button></div>`:""}</article>`).join(""):empty("fa-ticket","Nenhum benefício resgatado","Quando você trocar pontos, seu benefício aparecerá aqui.");
    $("#movementList").innerHTML=state.movimentos.length?state.movimentos.map(m=>`<div class="movement ${num(m.pontos)<0?"negative":""}"><i class="fa-solid ${num(m.pontos)<0?"fa-minus":"fa-plus"}"></i><div><strong>${html(m.descricao||m.tipo)}</strong><small>${dt(m.criado_em)}</small></div><b>${num(m.pontos)>0?"+":""}${m.pontos}</b></div>`).join(""):empty("fa-clock","Sem movimentos","Seus pontos aparecerão aqui após as compras.");
  }
  function rewardText(r){if(r.tipo==="desconto_fixo")return `${money(r.valor)} de desconto`;if(r.tipo==="desconto_percentual")return `${num(r.valor)}% de desconto`;if(r.tipo==="frete_gratis")return "Frete grátis";if(r.tipo==="produto")return `Produto: ${state.produtos.find(p=>Number(p.id)===Number(r.produto_id))?.nome||"item selecionado"}`;return "Recompensa Burger Club";}
  function redeemText(r){if(r.recompensa_tipo==="desconto_fixo")return `${money(r.recompensa_valor)} de desconto`;if(r.recompensa_tipo==="desconto_percentual")return `${num(r.recompensa_valor)}% de desconto`;if(r.recompensa_tipo==="frete_gratis")return "Frete grátis no pedido";if(r.recompensa_tipo==="produto")return "Produto grátis conforme a recompensa";return "Benefício Burger Club";}
  async function refreshLoyalty(){if(!state.user)return renderLoyalty();await Promise.all([fetchOne("movimentos",()=>db.from("fidelidade_movimentos").select("*").eq("loja_id",state.loja.id).eq("user_id",state.user.id).order("criado_em",{ascending:false}).limit(100)),fetchOne("resgates",()=>db.from("fidelidade_resgates").select("*").eq("loja_id",state.loja.id).eq("user_id",state.user.id).order("criado_em",{ascending:false}))]);await renderLoyalty();}
  async function redeemReward(id){
    if(!requireLogin("resgatar recompensas"))return;
    const reward=state.recompensas.find(r=>Number(r.id)===Number(id));if(!reward)return;
    const balance=await loadLoyaltyBalance();
    if(!state.config.fidelidade_ativa)return toast("O programa de fidelidade está desativado.","info");
    if(balance<num(reward.pontos_necessarios))return toast("Você ainda não tem pontos suficientes.","info");
    if(!confirm(`Resgatar "${reward.nome}" por ${reward.pontos_necessarios} pontos?`))return;
    const button=document.querySelector(`[data-redeem-reward="${id}"]`);setButton(button,true,"Resgatando...");
    try{const r=await db.rpc("resgatar_recompensa_v10",{p_loja_id:state.loja.id,p_recompensa_id:Number(id)});if(r.error)throw r.error;await refreshLoyalty();toast(`Recompensa resgatada! Código: ${r.data?.codigo||"disponível na sua conta"}`);}
    catch(e){toast(e.message||"Não foi possível resgatar a recompensa.","error");}
    finally{setButton(button,false);}
  }
  async function useRedemption(id){
    const r=state.resgates.find(x=>Number(x.id)===Number(id));if(!r||r.status!=="disponivel")return;
    const input=$("#couponInput");if(!input)return toast("Abra o carrinho para usar o benefício.","info");
    input.value=r.codigo;state.coupon=null;openCart();await applyCoupon();
  }
  async function cancelRedemption(id){
    const r=state.resgates.find(x=>Number(x.id)===Number(id));if(!r||r.status!=="disponivel")return;
    if(!confirm(`Cancelar o resgate de "${r.recompensa_nome}" e devolver ${r.pontos_gastos} pontos?`))return;
    try{const x=await db.rpc("cancelar_resgate_fidelidade_v10",{p_loja_id:state.loja.id,p_resgate_id:Number(id)});if(x.error)throw x.error;await refreshLoyalty();toast(`Resgate cancelado. Saldo: ${num(x.data)} pontos.`);}
    catch(e){toast(e.message||"Não foi possível cancelar o resgate.","error");}
  }

  async function renderProfile(){
    if(!state.user){ $("#profileName").textContent="Visitante"; $("#profileEmail").textContent="Entre para acessar seu perfil"; $("#profilePhone").textContent="—"; $("#profileOrdersCount").textContent="0"; $("#profilePoints").textContent="0"; return; }
    const p=state.profile||{};$("#profileName").textContent=p.nome||"Cliente";$("#profileEmail").textContent=state.user?.email||p.email||"—";$("#profilePhone").textContent=p.telefone||"—";$("#profileOrdersCount").textContent=state.pedidos.filter(o=>o.status!=="Cancelado").length;$("#profileForm").elements.nome.value=p.nome||"";$("#profileForm").elements.telefone.value=p.telefone||"";$("#profileForm").elements.endereco.value=p.endereco||"";renderAddresses();renderNotifications();await renderLoyalty();}

  async function saveProfile(event){event.preventDefault();const f=event.currentTarget,b=f.querySelector('[type="submit"]');setButton(b,true,"Salvando...");try{const payload={nome:String(f.elements.nome.value||"").trim(),telefone:String(f.elements.telefone.value||"").trim()||null,endereco:String(f.elements.endereco.value||"").trim()||null,atualizado_em:new Date().toISOString()};if(!payload.nome)throw new Error("Informe seu nome.");const r=await db.from("profiles").update(payload).eq("id",state.user.id).select().single();if(r.error)throw r.error;state.profile=r.data;applyBrand();toast("Perfil atualizado.");}catch(e){toast(e.message,"error");}finally{setButton(b,false);}}

  function renderAddresses(){$("#addressList").innerHTML=state.enderecos.length?state.enderecos.map(a=>`<article class="address-card"><div><strong>${html(a.apelido||"Endereço")}${a.principal?" · Principal":""}</strong><small>${html([a.logradouro,a.numero,a.complemento,a.bairro,a.cidade,a.estado].filter(Boolean).join(", "))}</small></div><div class="actions"><button class="mini-action" data-edit-address="${a.id}"><i class="fa-solid fa-pen"></i></button><button class="mini-action" data-delete-address="${a.id}"><i class="fa-solid fa-trash"></i></button></div></article>`).join(""):empty("fa-location-dot","Nenhum endereço salvo","Cadastre um endereço para agilizar o checkout.");renderCheckoutOptions();}
  function openAddress(id=null){const f=$("#addressForm");f.reset();delete f.dataset.id;$("#addressModalTitle").textContent=id?"Editar endereço":"Novo endereço";if(id){const a=state.enderecos.find(x=>Number(x.id)===Number(id));if(!a)return;f.dataset.id=a.id;["apelido","cep","logradouro","numero","complemento","cidade","estado","referencia"].forEach(k=>f.elements[k].value=a[k]||"");f.elements.bairro_id.value=a.bairro_id||"";f.elements.principal.checked=!!a.principal;}openModal("addressModal");}
  async function saveAddress(event){event.preventDefault();const f=event.currentTarget,b=f.querySelector('[type="submit"]'),id=f.dataset.id;setButton(b,true,"Salvando...");try{const bairro=state.bairros.find(x=>Number(x.id)===Number(f.elements.bairro_id.value));const payload={user_id:state.user.id,apelido:String(f.elements.apelido.value||"").trim()||null,cep:String(f.elements.cep.value||"").trim()||null,logradouro:String(f.elements.logradouro.value||"").trim(),numero:String(f.elements.numero.value||"").trim()||null,complemento:String(f.elements.complemento.value||"").trim()||null,bairro:bairro?.nome||null,bairro_id:bairro?.id||null,cidade:String(f.elements.cidade.value||"").trim()||null,estado:String(f.elements.estado.value||"").trim().toUpperCase()||null,referencia:String(f.elements.referencia.value||"").trim()||null,principal:f.elements.principal.checked,ativo:true,atualizado_em:new Date().toISOString()};if(!payload.logradouro)throw new Error("Informe a rua/logradouro.");if(payload.principal)await db.from("enderecos").update({principal:false}).eq("user_id",state.user.id);const r=id?await db.from("enderecos").update(payload).eq("id",Number(id)):await db.from("enderecos").insert(payload);if(r.error)throw r.error;await fetchOne("enderecos",()=>db.from("enderecos").select("*").eq("user_id",state.user.id).eq("ativo",true).order("principal",{ascending:false}).order("criado_em"));closeModal("addressModal");renderAddresses();toast("Endereço salvo.");}catch(e){toast(e.message,"error");}finally{setButton(b,false);}}
  async function deleteAddress(id){if(!confirm("Excluir este endereço?"))return;const r=await db.from("enderecos").delete().eq("id",Number(id));if(r.error)return toast(r.error.message,"error");state.enderecos=state.enderecos.filter(x=>Number(x.id)!==Number(id));renderAddresses();toast("Endereço removido.");}

  function renderNotifications(){if(!state.user){$("#notificationBadge").textContent="0";$("#notificationBadge").classList.add("zero");$("#notificationList").innerHTML=empty("fa-bell","Entre para ver notificações","Atualizações dos seus pedidos aparecerão aqui.");return;}const visible=state.notificacoes.filter(n=>!n.user_id||n.user_id===state.user.id);const unread=visible.filter(n=>n.user_id===state.user.id&&!n.lida).length;$("#notificationBadge").textContent=unread>99?"99+":unread;$("#notificationBadge").classList.toggle("zero",!unread);$("#notificationList").innerHTML=visible.length?visible.map(n=>`<article class="notification-card ${n.user_id===state.user.id&&!n.lida?"unread":""}"><div><strong>${html(n.titulo)}</strong><p>${html(n.mensagem||"")}</p><small>${dt(n.criado_em)}${!n.user_id?" · Aviso geral":""}</small></div><div class="actions">${n.pedido_id?`<button class="mini-action" data-order-details="${n.pedido_id}"><i class="fa-solid fa-eye"></i></button>`:""}${n.user_id===state.user.id&&!n.lida?`<button class="mini-action" data-read-notification="${n.id}"><i class="fa-solid fa-check"></i></button>`:""}</div></article>`).join(""):empty("fa-bell-slash","Sem notificações","Novidades dos seus pedidos aparecerão aqui.");}

  async function readNotification(id){const r=await db.rpc("go_burger_marcar_notificacao_lida_v10",{p_notificacao_id:Number(id),p_lida:true});if(r.error)return toast(r.error.message,"error");const n=state.notificacoes.find(x=>Number(x.id)===Number(id));if(n)n.lida=true;renderNotifications();}
  async function markAllRead(){const ids=state.notificacoes.filter(n=>n.user_id===state.user.id&&!n.lida).map(n=>n.id);if(!ids.length)return toast("Você não tem notificações pessoais pendentes.","info");const r=await db.rpc("go_burger_marcar_notificacoes_lidas_v10",{p_loja_id:null});if(r.error)return toast(r.error.message,"error");state.notificacoes.forEach(n=>{if(ids.includes(n.id))n.lida=true});renderNotifications();toast("Notificações marcadas como lidas.");}

  function renderRecentOrder(){const o=state.pedidos.find(x=>x.status!=="Cancelado");const sec=$("#recentOrderSection");if(!o){sec.classList.add("hidden");return;}sec.classList.remove("hidden");$("#recentOrderCard").innerHTML=`<article class="order-card"><div class="order-card-head"><div><h3>Pedido #${o.numero_loja||o.id}</h3><small>${dt(o.criado_em)}</small></div><span class="status ${slug(o.status)}">${html(o.status)}</span></div><div class="order-summary">${html(orderSummary(o))}</div><div class="order-card-footer"><strong>${money(o.total)}</strong><div class="order-actions"><button class="btn secondary small" data-order-details="${o.id}">Detalhes</button><button class="btn primary small" data-reorder="${o.id}">Pedir novamente</button></div></div></article>`;}

  function renderPublicReviews(){const wrap=$("#publicReviews");if(!wrap)return;const list=state.publicAvaliacoes.slice(0,6);wrap.innerHTML=list.length?list.map(a=>`<article class="public-review-card"><div class="public-review-stars">${"★".repeat(Math.max(1,Math.min(5,Number(a.nota)||5)))}</div><p>${html(a.comentario||"Cliente avaliou esta hamburgueria.")}</p><small>${dt(a.criado_em)}</small></article>`).join(""):empty("fa-star","Ainda sem avaliações públicas","Seja um dos primeiros clientes a avaliar esta hamburgueria.");}

  function renderAll(){applyBrand();renderCategories();renderProducts();renderBanners();renderPublicReviews();renderOrders();renderRecentOrder();if(state.user)renderProfile();else{renderNotifications();renderLoyalty();}renderCheckoutOptions();renderCart();}

  function openModal(id){const m=document.getElementById(id);if(!m)return;m.classList.add("active");m.setAttribute("aria-hidden","false");document.body.style.overflow="hidden";}
  function closeModal(id){const m=document.getElementById(id);if(!m)return;m.classList.remove("active");m.setAttribute("aria-hidden","true");if(id==="orderModal"&&state.trackingTimer){clearInterval(state.trackingTimer);state.trackingTimer=null;}if(!$(".modal.active")&&!$("#cartDrawer.open"))document.body.style.overflow="";}

  function applyTheme(){window.GoBurgerTheme?.apply?.();}
  function toggleTheme(){window.GoBurgerTheme?.toggle?.();}
  function updateOnline(){const offline=!navigator.onLine;$("#offlineBar")?.classList.toggle("hidden",!offline);}

  function startRealtime(){
    if(state.realtime)try{db.removeChannel(state.realtime)}catch{}
    const lojaId=state.loja?.id;
    if(!lojaId || !state.user)return;
    let timer;
    const refreshOrders=()=>{clearTimeout(timer);timer=setTimeout(async()=>{
      await Promise.all([
        loadOrders(),
        fetchOne("notificacoes",()=>db.from("notificacoes").select("*").eq("loja_id",lojaId).order("criado_em",{ascending:false}).limit(100)),
        fetchOne("movimentos",()=>db.from("fidelidade_movimentos").select("*").eq("loja_id",lojaId).eq("user_id",state.user.id).order("criado_em",{ascending:false}).limit(100)),
        fetchOne("resgates",()=>db.from("fidelidade_resgates").select("*").eq("loja_id",lojaId).eq("user_id",state.user.id).order("criado_em",{ascending:false}))
      ]);
      renderOrders();renderRecentOrder();renderNotifications();renderLoyalty();
    },250)};
    const refreshMarketing=async()=>{
      await Promise.all([
        fetchOne("banners",()=>db.from("banners").select("*").eq("loja_id",lojaId).eq("ativo",true).order("ordem")),
        fetchOne("upsells",()=>db.from("ofertas_upsell").select("*").eq("loja_id",lojaId).eq("ativo",true).order("ordem")),
        fetchOne("recompensas",()=>db.from("fidelidade_recompensas").select("*").eq("loja_id",lojaId).eq("ativo",true).order("pontos_necessarios"))
      ]);renderBanners();renderLoyalty();
    };
    let ch=db.channel(`go-burger-client-${lojaId}-${state.user.id}`);
    ch=ch.on("postgres_changes",{event:"*",schema:"public",table:"pedidos",filter:`user_id=eq.${state.user.id}`},p=>{if(Number(p.new?.loja_id||p.old?.loja_id)!==Number(lojaId))return;if(p.eventType==="UPDATE")toast(`Pedido #${p.new?.id}: ${p.new?.status||"atualizado"}.`,"info");refreshOrders();});
    ch=ch.on("postgres_changes",{event:"*",schema:"public",table:"notificacoes",filter:`loja_id=eq.${lojaId}`},refreshOrders);
    ch=ch.on("postgres_changes",{event:"*",schema:"public",table:"fidelidade_movimentos",filter:`user_id=eq.${state.user.id}`},p=>{if(Number(p.new?.loja_id||p.old?.loja_id)===Number(lojaId))refreshOrders();});
    ch=ch.on("postgres_changes",{event:"*",schema:"public",table:"fidelidade_resgates",filter:`user_id=eq.${state.user.id}`},p=>{if(Number(p.new?.loja_id||p.old?.loja_id)===Number(lojaId))refreshOrders();});
    ["banners","ofertas_upsell","fidelidade_recompensas"].forEach(table=>{ch=ch.on("postgres_changes",{event:"*",schema:"public",table,filter:`loja_id=eq.${lojaId}`},refreshMarketing);});
    ch=ch.on("postgres_changes",{event:"*",schema:"public",table:"produtos",filter:`loja_id=eq.${lojaId}`},async()=>{await fetchOne("produtos",()=>db.from("produtos").select("*").eq("loja_id",lojaId).eq("ativo",true).order("ordem"));renderProducts();renderCart();});
    ch=ch.on("postgres_changes",{event:"UPDATE",schema:"public",table:"configuracoes",filter:`loja_id=eq.${lojaId}`},async()=>{await loadConfig();await loadStoreOpen();applyBrand();renderCheckoutOptions();renderCart();renderLoyalty();});
    state.realtime=ch.subscribe();
  }

  // EVENTS
  $$('[data-auth-tab]').forEach(b=>b.addEventListener("click",()=>switchAuth(b.dataset.authTab)));
  $("#loginForm")?.addEventListener("submit",signIn);$("#registerForm")?.addEventListener("submit",register);$("#btnRecover")?.addEventListener("click",recoverPassword);
  $("#logoutBtn")?.addEventListener("click",signOut);$("#profileForm")?.addEventListener("submit",saveProfile);$("#addressForm")?.addEventListener("submit",saveAddress);$("#reviewForm")?.addEventListener("submit",saveReview);$("#exportMyData")?.addEventListener("click",exportMyData);$("#requestDataCorrection")?.addEventListener("click",()=>requestLgpd("correcao"));$("#requestAccountDeletion")?.addEventListener("click",()=>requestLgpd("eliminacao"));$("#manageConsentPreferences")?.addEventListener("click",()=>window.GoBurgerUI?.openConsentPreferences?.());$("#revokeOtherSessions")?.addEventListener("click",revokeOtherSessions);
  $$('[data-page]').forEach(b=>b.addEventListener("click",()=>navigate(b.dataset.page)));
  $("#openCart")?.addEventListener("click",()=>{trackEvent("carrinho_aberto",{itens:state.cart.length});openCart();});$("#closeCart")?.addEventListener("click",closeCart);$("#cartOverlay")?.addEventListener("click",closeCart);$("#checkoutBtn")?.addEventListener("click",()=>{trackEvent("checkout_iniciado",{itens:state.cart.length});checkout();});$("#applyCoupon")?.addEventListener("click",applyCoupon);$("#useCurrentLocation")?.addEventListener("click",useCurrentLocation);$("#onlinePaymentChoice")?.addEventListener("click",()=>{if(!FINANCE_ENABLED)return toast("Pagamento online indisponível nesta versão.","info");state.onlinePayment=!state.onlinePayment;if(state.onlinePayment)state.payment="PIX";renderCheckoutOptions();});
  $("#btnMarketplace")?.addEventListener("click",()=>{ if(window.parent&&window.parent!==window) window.parent.postMessage({type:"go-burger-home"},location.origin); else location.href="marketplace/market.html"; });$("#shareStoreBtn")?.addEventListener("click",shareStore);
  $("#btnNotifications")?.addEventListener("click",()=>navigate("perfil"));$("#markAllRead")?.addEventListener("click",markAllRead);$("#newAddressBtn")?.addEventListener("click",()=>openAddress());$("#checkoutNewAddress")?.addEventListener("click",()=>openAddress());$("#exploreStoresBtn")?.addEventListener("click",()=>{if(window.parent&&window.parent!==window)window.parent.postMessage({type:"go-burger-home"},location.origin);else location.href="marketplace/market.html";});
  $("#productSearch")?.addEventListener("input",renderProducts);$("#productSort")?.addEventListener("change",renderProducts);$("#clearSearch")?.addEventListener("click",()=>{$("#productSearch").value="";renderProducts();});$("#filterFavorites")?.addEventListener("click",()=>{state.favoriteOnly=!state.favoriteOnly;$("#filterFavorites").classList.toggle("active",state.favoriteOnly);renderProducts();});
  $("#modalQtyMinus")?.addEventListener("click",()=>{state.modalQty=Math.max(1,state.modalQty-1);updateModalTotal()});$("#modalQtyPlus")?.addEventListener("click",()=>{if(!state.modalProduct)return;const stockRemaining=Math.max(0,Math.trunc(num(state.modalProduct.estoque))-cartQuantityForProduct(state.modalProduct.id));let maxQty=stockRemaining;if(state.modalUpsell)maxQty=Math.min(maxQty,availablePromoUnits(state.modalUpsell));maxQty=Math.max(1,maxQty);if(state.modalQty>=maxQty)return toast(state.modalUpsell?`Esta oferta permite no máximo ${maxQty} unidade(s) promocional(is) neste carrinho.`:`Estoque disponível para este produto: ${maxQty}.`,"info");state.modalQty++;updateModalTotal()});$("#addConfiguredProduct")?.addEventListener("click",addConfiguredProduct);$("#modalFavorite")?.addEventListener("click",()=>state.modalProduct&&favoriteToggle(state.modalProduct.id));
  $("#savedAddressSelect")?.addEventListener("change",e=>{if(e.target.value)applySavedAddress(e.target.value);else{$("#checkoutAddress").focus();updateCheckoutProgress();}});$("#neighborhoodSelect")?.addEventListener("change",()=>{renderCart();updateCheckoutProgress();});$("#checkoutAddress")?.addEventListener("input",updateCheckoutProgress);$("#couponInput")?.addEventListener("input",()=>{state.coupon=null;$("#couponMessage").textContent="";renderCart();});
  $("#closeUpsell")?.addEventListener("click",closeUpsell);$("#acceptUpsell")?.addEventListener("click",()=>{const p=state.upsell?.product,offer=state.upsell?.offer;closeUpsell();if(p)openProduct(p.id,offer)});
  $("#starPicker")?.addEventListener("click",e=>{const b=e.target.closest("[data-star]");if(!b)return;state.reviewStars=Number(b.dataset.star);renderStars();});
  $("#btnInstall")?.addEventListener("click",async()=>{if(!state.deferredInstall)return;state.deferredInstall.prompt();await state.deferredInstall.userChoice;state.deferredInstall=null;$("#btnInstall").classList.add("hidden")});
  window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();state.deferredInstall=e;$("#btnInstall")?.classList.remove("hidden")});
  window.addEventListener("gb-consent-changed",e=>{trackEvent("consentimento_atualizado",{analytics:!!e.detail?.analytics,marketing:!!e.detail?.marketing});if(state.user)db.rpc("go_burger_aceitar_termo_v1",{p_tipo:"cookies",p_versao:"1.2",p_aceito:true,p_origem:"preferencias_privacidade"}).catch(()=>{});});window.addEventListener("online",updateOnline);window.addEventListener("offline",updateOnline);window.addEventListener("hashchange",()=>navigate(location.hash.slice(1)||"inicio",false));

  document.addEventListener("change",e=>{const op=e.target.closest?.("[data-option-id]");if(op)return handleOption(op);const rem=e.target.closest?.("[data-remove-id]");if(rem){const id=Number(rem.dataset.removeId);rem.checked?state.modalRemoved.add(id):state.modalRemoved.delete(id);return;}});
  document.addEventListener("click",async e=>{
    const el=s=>e.target.closest?.(s);
    if(el("[data-toggle-password]")){const b=el("[data-toggle-password]"),input=b.closest(".password-wrap")?.querySelector("input")||b.closest(".input-icon")?.querySelector("input");if(input){input.type=input.type==="password"?"text":"password";const i=b.querySelector("i");if(i)i.className=input.type==="text"?"fa-regular fa-eye-slash":"fa-regular fa-eye";}return;}
    if(el("[data-open-product]"))return openProduct(el("[data-open-product]").dataset.openProduct);
    if(el("[data-favorite]"))return favoriteToggle(el("[data-favorite]").dataset.favorite);
    if(el("[data-category]")){state.menuCategory=el("[data-category]").dataset.category;renderCategories();renderProducts();return;}
    if(el("[data-order-filter]")){state.orderFilter=el("[data-order-filter]").dataset.orderFilter;$$('[data-order-filter]').forEach(b=>b.classList.toggle("active",b.dataset.orderFilter===state.orderFilter));renderOrders();return;}
    if(el("[data-cart-remove]"))return removeCart(Number(el("[data-cart-remove]").dataset.cartRemove));
    if(el("[data-cart-delta]"))return updateCartQty(Number(el("[data-cart-delta]").dataset.cartIndex),Number(el("[data-cart-delta]").dataset.cartDelta));
    if(el("[data-delivery]")){state.deliveryType=el("[data-delivery]").dataset.delivery;renderCheckoutOptions();renderCart();return;}
    if(el("[data-schedule]")){state.schedule=el("[data-schedule]").dataset.schedule;renderCheckoutOptions();return;}
    if(el("[data-payment]")){state.onlinePayment=false;state.payment=el("[data-payment]").dataset.payment;renderCheckoutOptions();return;}
    if(el("[data-order-details]"))return openOrder(el("[data-order-details]").dataset.orderDetails);
    if(el("[data-cancel-order]"))return cancelOrder(el("[data-cancel-order]").dataset.cancelOrder);
    if(el("[data-reorder]"))return reorder(el("[data-reorder]").dataset.reorder);
    if(el("[data-track-delivery]"))return loadDeliveryTracking(el("[data-track-delivery]").dataset.trackDelivery);
    if(el("[data-review-order]"))return openReview(el("[data-review-order]").dataset.reviewOrder);
    if(el("[data-redeem-reward]"))return redeemReward(el("[data-redeem-reward]").dataset.redeemReward);
    if(el("[data-use-redemption]"))return useRedemption(el("[data-use-redemption]").dataset.useRedemption);
    if(el("[data-cancel-redemption]"))return cancelRedemption(el("[data-cancel-redemption]").dataset.cancelRedemption);
    if(el("[data-edit-address]"))return openAddress(el("[data-edit-address]").dataset.editAddress);
    if(el("[data-delete-address]"))return deleteAddress(el("[data-delete-address]").dataset.deleteAddress);
    if(el("[data-read-notification]"))return readNotification(el("[data-read-notification]").dataset.readNotification);
    if(el("[data-banner-dot]")){state.bannerIndex=Number(el("[data-banner-dot]").dataset.bannerDot);updateBanner();return;}
    if(el("[data-banner-action]"))return bannerAction(Number(el("[data-banner-action]").dataset.bannerAction));
    if(el("[data-close]"))return closeModal(el("[data-close]").dataset.close);
  });
  $$(".modal").forEach(m=>m.addEventListener("click",e=>{if(e.target===m)closeModal(m.id)}));
  document.addEventListener("keydown",e=>{if(e.key==="Escape"){$$(".modal.active").forEach(m=>closeModal(m.id));closeCart();closeUpsell();}});

  window.GoBurgerClientBridge = {
    getContext:()=>({userId:state.user?.id||null,storeId:Number(state.loja?.id||0),storeName:state.loja?.nome||"Hamburgueria",tableContext:state.tableContext||null}),
    getProductCustomization:(productId)=>{
      const id=Number(productId);
      const groups=groupsForProduct(id).map(g=>({
        id:Number(g.id),
        nome:g.nome,
        minimo:num(g.minimo),
        maximo:num(g.maximo,1),
        obrigatorio:!!g.obrigatorio,
        opcoes:state.opcoes.filter(o=>Number(o.grupo_id)===Number(g.id)&&o.ativo!==false).map(o=>({id:Number(o.id),nome:o.nome,preco:num(o.preco_adicional)}))
      }));
      const ingredients=state.ingredientes.filter(i=>Number(i.produto_id)===id&&i.ativo!==false&&i.removivel!==false).map(i=>({id:Number(i.id),nome:i.nome}));
      return {groups,ingredients};
    },
    navigate:(page)=>navigate(page),
    setTableContext:(ctx)=>{state.tableContext=ctx||null;if(ctx){state.deliveryType="Retirada";renderCheckoutOptions();renderCart();}},
    importGroupItems:(rawItems=[])=>{
      let added=0;
      for(const raw of rawItems){
        const p=state.produtos.find(x=>Number(x.id)===Number(raw.produto_id));
        if(!productAvailable(p))continue;
        const opIds=Array.isArray(raw.opcoes)?raw.opcoes.map(Number):[];
        const remIds=Array.isArray(raw.removidos)?raw.removidos.map(Number):[];
        const ops=opIds.map(id=>state.opcoes.find(o=>Number(o.id)===id)).filter(Boolean).map(o=>({id:Number(o.id),nome:o.nome,preco:num(o.preco_adicional)}));
        const rem=remIds.map(id=>state.ingredientes.find(i=>Number(i.id)===id)).filter(Boolean).map(i=>({id:Number(i.id),nome:i.nome}));
        const obs=String(raw.observacao||"").slice(0,300);
        const signature=JSON.stringify({p:Number(p.id),u:null,o:ops.map(x=>x.id).sort((a,b)=>a-b),r:rem.map(x=>x.id).sort((a,b)=>a-b),n:obs});
        const ex=state.cart.find(x=>x.signature===signature);
        const qty=Math.max(1,Math.min(20,Math.trunc(num(raw.quantidade,1))));
        if(ex)ex.quantidade+=qty;else state.cart.push({signature,produto_id:Number(p.id),upsell_id:null,nome:p.nome,imagem:p.imagem,preco_base:num(p.preco),quantidade:qty,opcoes:ops,removidos:rem,observacao:obs});
        added++;
      }
      persistCart();renderCart();if(added)openCart();return added;
    },
    applyCouponCode:async(code)=>{const input=$("#couponInput");if(!input)return false;input.value=String(code||"");await applyCoupon();openCart();return Boolean(state.coupon);},
    getOrders:()=>[...(state.pedidos||[])],
    openCart:()=>openCart()
  };

  applyTheme();updateOnline();
  if ("serviceWorker" in navigator && ["http:","https:"].includes(location.protocol)) navigator.serviceWorker.register("../sw.js").catch(()=>{});
  db.auth.onAuthStateChange((event,session)=>{if(event==="SIGNED_OUT"){state.user=null;state.profile=null;setTimeout(()=>boot().catch(()=>{}),0);}if((event==="SIGNED_IN"||event==="TOKEN_REFRESHED")&&session?.user){state.user=session.user;setTimeout(()=>boot().catch(()=>{}),0);}});
  try { const { data, error } = await db.auth.getSession(); if(error)throw error; state.user=data.session?.user||null; await boot(); trackEvent("cliente_aberto",{slug:state.loja?.slug||null}); if(state.user){registerCurrentDevice();syncLegalAcceptances();} }
  catch(e){console.error(e);showAuth();showAuthMessage(e.message||"Não foi possível restaurar a sessão.");}
});
