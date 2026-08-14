(() => {
  "use strict";
  const SUPABASE_URL="https://ethlgaszdextwckdwgsf.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY="sb_publishable_qEhxWcCbekPjYFUW-EQ1ow_xccHG8aJ";
  const AUTH_KEY="go-burger-auth-v1";
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const html=v=>String(v??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  const money=v=>Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
  const date=v=>v?new Date(v).toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"}):"—";
  const initials=v=>String(v||"Visitante").trim().split(/\s+/).slice(0,2).map(x=>x[0]||"").join("").toUpperCase()||"V";
  const state={db:null,user:null,profile:null,stores:[],allStores:[],categories:[],favoriteIds:new Set(),orders:[],notifications:[],query:"",category:"",city:"",sort:"recomendadas",openOnly:false,page:"discover",loading:false,realtime:null};
  let searchTimer=null;
  const analyticsSession=(()=>{let id=sessionStorage.getItem("go_burger_market_session");if(!id){id=crypto.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`;sessionStorage.setItem("go_burger_market_session",id);}return id;})();
  async function track(evento,lojaId=null,propriedades={}){try{await state.db?.rpc("go_burger_registrar_evento_v1",{p_evento:evento,p_loja_id:lojaId,p_sessao_id:analyticsSession,p_origem:"marketplace",p_propriedades:propriedades});}catch{}}

  function withTimeout(promise, ms, label = "operação") {
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`Tempo esgotado: ${label}`)),
        ms
      );
    });

    return Promise.race([promise, timeout])
      .finally(() => clearTimeout(timer));
  }

  function toast(message){const wrap=$("#marketToast"),n=document.createElement("div");n.className="market-toast";n.textContent=message;wrap.appendChild(n);setTimeout(()=>n.remove(),3300)}
  function empty(icon,title,text){return `<div class="empty-market"><div><i class="fa-solid ${icon}"></i><strong>${html(title)}</strong><p>${html(text)}</p></div></div>`}
  function normalizePhoneBR(value){let d=String(value||"").replace(/\D/g,"");if(d.length===10||d.length===11)d=`55${d}`;return d?`+${d}`:""}
  function authMessage(message="",type="error"){const el=$("#marketAuthMessage");el.textContent=message;el.className=`auth-message${message?` show ${type}`:""}`}
  function showAuth(tab="login"){switchAuth(tab);$("#authModal").classList.remove("hidden")}
  function closeAuth(){$("#authModal").classList.add("hidden");authMessage("")}
  function switchAuth(tab){$$('[data-market-auth]').forEach(b=>b.classList.toggle("active",b.dataset.marketAuth===tab));$$('[data-market-auth-form]').forEach(f=>f.classList.toggle("active",f.dataset.marketAuthForm===tab));authMessage("")}
  function requireLogin(action){if(state.user)return true;showAuth();if(action)toast(`Entre para ${action}.`);return false}

  async function initDb(){if(!window.supabase?.createClient)throw new Error("Não foi possível carregar a Go-burger.");state.db=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:AUTH_KEY}});const {data}=await withTimeout(state.db.auth.getSession(),5000,"sessão do marketplace");state.user=data?.session?.user||null;await loadProfile();}
  async function loadProfile(){state.profile=null;if(!state.user)return;const {data}=await state.db.from("profiles").select("id,nome,email,telefone").eq("id",state.user.id).maybeSingle();state.profile=data||null}
  function renderAccount(){const name=state.profile?.nome||state.user?.email?.split("@")[0]||"Visitante";$("#marketAvatar").textContent=initials(name);$("#marketUserName").textContent=name.split(/\s+/)[0];$("#marketAccountLabel").textContent=state.user?"Minha conta":"Entrar"}

  async function loadCategories(){const {data,error}=await withTimeout(state.db.rpc("go_burger_marketplace_categorias_v10"),7000,"categorias");if(error)throw error;state.categories=data||[];renderCategories()}
  async function loadAllForCities(){const {data,error}=await withTimeout(state.db.rpc("go_burger_marketplace_lojas_v10",{p_busca:null,p_categoria:null,p_cidade:null,p_ordem:"nome",p_apenas_abertas:false,p_limit:100,p_offset:0}),7000,"cidades");if(error)throw error;state.allStores=data||[];const cities=[...new Set(state.allStores.map(x=>x.cidade).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"pt-BR"));const sel=$("#cityFilter");sel.innerHTML='<option value="">Todas as cidades</option>'+cities.map(c=>`<option value="${html(c)}">${html(c)}</option>`).join("");}
  async function loadStores(){state.loading=true;$("#marketLoading").classList.remove("hidden");try{const {data,error}=await withTimeout(state.db.rpc("go_burger_marketplace_lojas_v10",{p_busca:state.query||null,p_categoria:state.category||null,p_cidade:state.city||null,p_ordem:state.sort,p_apenas_abertas:state.openOnly,p_limit:100,p_offset:0}),7000,"hamburguerias");if(error)throw error;state.stores=data||[];renderStores()}catch(e){console.error(e);$("#storeGrid").innerHTML=empty("fa-triangle-exclamation","Não foi possível carregar",e.message||"Tente novamente.")}finally{state.loading=false;$("#marketLoading").classList.add("hidden")}}
  async function loadFavorites(){state.favoriteIds=new Set();if(!state.user)return renderFavorites();const {data,error}=await state.db.from("loja_favoritos").select("loja_id").eq("user_id",state.user.id);if(!error)state.favoriteIds=new Set((data||[]).map(x=>Number(x.loja_id)));renderFavorites();renderStores()}
  async function loadOrders(){state.orders=[];if(!state.user)return renderOrders();const {data,error}=await state.db.rpc("go_burger_meus_pedidos_marketplace_v10",{p_limit:200});if(error)throw error;state.orders=data||[];renderOrders()}
  async function loadNotifications(){state.notifications=[];if(!state.user)return renderNotifications();const {data,error}=await state.db.rpc("go_burger_minhas_notificacoes_marketplace_v10",{p_limit:200});if(error)throw error;state.notifications=data||[];renderNotifications()}

  function renderCategories(){const all=`<button class="category-chip ${!state.category?"active":""}" data-category=""><i class="fa-solid fa-border-all"></i> Todos</button>`;$("#marketCategories").innerHTML=all+state.categories.map(c=>`<button class="category-chip ${state.category===c.slug?"active":""}" data-category="${html(c.slug)}"><i class="fa-solid ${html(c.icone||"fa-burger")}"></i> ${html(c.nome)} <small>${Number(c.lojas_total||0)||""}</small></button>`).join("")}
  function storeCard(s){const fav=state.favoriteIds.has(Number(s.id));const cats=(s.categorias||[]).slice(0,3);const cover=s.banner_url?`<img src="${html(s.banner_url)}" alt="" loading="lazy">`:"";const logo=s.logo_url?`<img src="${html(s.logo_url)}" alt="${html(s.nome)}" loading="lazy">`:"🍔";return `<article class="store-card" data-store="${html(s.slug)}" style="--card-primary:${html(s.cor_primaria||"#ff6500")}"><div class="store-cover">${cover}${s.patrocinada?'<span class="sponsored-badge"><i class="fa-solid fa-bolt"></i> PATROCINADA</span>':""}<button class="store-favorite ${fav?"active":""}" data-store-favorite="${s.id}" type="button" aria-label="${fav?"Remover dos":"Adicionar aos"} favoritos"><i class="fa-${fav?"solid":"regular"} fa-heart"></i></button><span class="store-logo">${logo}</span></div><div class="store-body"><div class="store-name-line"><h3>${html(s.nome)}</h3>${s.verificada?'<i class="fa-solid fa-circle-check verified" title="Verificada pela Go-burger"></i>':""}</div><p class="store-slogan">${html(s.slogan||s.descricao||"Hamburgueria parceira da Go-burger")}</p><div class="store-meta"><span class="star"><i class="fa-solid fa-star"></i> ${Number(s.nota_media||0).toFixed(1)}</span><span>${Number(s.avaliacoes_total||0)} avaliações</span><i class="meta-dot"></i><span><i class="fa-regular fa-clock"></i> ${Number(s.tempo_estimado_min||30)}–${Number(s.tempo_estimado_max||50)} min</span><i class="meta-dot"></i><span>${Number(s.taxa_entrega_min||0)<=0?"Entrega grátis":`Taxa ${money(s.taxa_entrega_min)}`}</span></div><div class="store-tags">${cats.map(c=>`<span>${html(c)}</span>`).join("")}</div><div class="store-footer"><span class="open-status ${s.aberta?"open":"closed"}"><i class="fa-solid fa-circle"></i> ${s.aberta?"Aberta agora":s.status==="pausada"?"Pausada":"Fechada agora"}</span><button class="store-open-btn" type="button" data-store-open="${html(s.slug)}">Ver loja <i class="fa-solid fa-arrow-right"></i></button></div></div></article>`}
  function renderStores(){const list=state.stores;$("#storeCountText").textContent=list.length===1?"1 hamburgueria encontrada":`${list.length} hamburguerias encontradas`;$("#storeGrid").innerHTML=list.length?list.map(storeCard).join(""):empty("fa-magnifying-glass","Nenhuma hamburgueria encontrada","Tente remover algum filtro ou buscar outro termo.");const sponsored=list.filter(x=>x.patrocinada||x.destaque).slice(0,8);$("#sponsoredSection").classList.toggle("hidden",!sponsored.length);$("#sponsoredStores").innerHTML=sponsored.map(storeCard).join("");const dirty=!!(state.query||state.category||state.city||state.openOnly||state.sort!=="recomendadas");$("#btnClearFilters").classList.toggle("hidden",!dirty);renderFavorites()}
  function renderFavorites(){const wrap=$("#favoriteGrid");if(!state.user){wrap.innerHTML=empty("fa-heart","Entre para ver seus favoritos","Sua lista fica sincronizada em qualquer aparelho.");return}const source=(state.allStores.length?state.allStores:state.stores).filter(s=>state.favoriteIds.has(Number(s.id)));wrap.innerHTML=source.length?source.map(storeCard).join(""):empty("fa-heart","Nenhum favorito ainda","Toque no coração de uma hamburgueria para salvá-la.")}
  function renderOrders(){const w=$("#marketOrders");if(!state.user){w.innerHTML=empty("fa-receipt","Entre para ver seus pedidos","Seu histórico em todas as hamburguerias aparecerá aqui.");return}w.innerHTML=state.orders.length?state.orders.map(o=>`<article class="order-row"><span class="row-logo">${o.loja_logo?`<img src="${html(o.loja_logo)}" alt="">`:"🍔"}</span><div><strong>${html(o.loja_nome)} · Pedido #${o.id}</strong><p>${date(o.criado_em)} · ${money(o.total)} · ${html(o.tipo_entrega||"")}</p></div><div><span class="row-status">${html(o.status)}</span> <button class="row-action" data-store-open="${html(o.loja_slug)}" type="button">Abrir loja</button></div></article>`).join(""):empty("fa-receipt","Nenhum pedido ainda","Quando pedir em uma hamburgueria, seu histórico aparecerá aqui.")}
  function renderNotifications(){const w=$("#marketNotifications");if(!state.user){w.innerHTML=empty("fa-bell","Entre para ver suas notificações","Atualizações de pedidos e lojas aparecem aqui.");updateBadges();return}w.innerHTML=state.notifications.length?state.notifications.map(n=>`<article class="notice-row"><span class="row-logo"><i class="fa-solid ${n.tipo==="pedido"?"fa-receipt":n.tipo==="pagamento"?"fa-credit-card":"fa-bell"}"></i></span><div><strong>${html(n.titulo)}</strong><p>${html(n.mensagem||"")} · ${date(n.criado_em)}${n.loja_nome?` · ${html(n.loja_nome)}`:""}</p></div><div>${n.loja_slug?`<button class="row-action" data-store-open="${html(n.loja_slug)}" type="button">Ver loja</button>`:""}</div></article>`).join(""):empty("fa-bell-slash","Tudo tranquilo","Você não tem notificações novas.");updateBadges()}
  function updateBadges(){const n=state.notifications.filter(x=>!x.lida).length;[$("#marketNotificationBadge"),$("#mobileNotifBadge")].forEach(el=>{if(!el)return;el.textContent=n>99?"99+":n;el.classList.toggle("zero",!n)})}

  async function toggleFavorite(id){if(!requireLogin("salvar hamburguerias favoritas"))return;const current=state.favoriteIds.has(Number(id));const {data,error}=await state.db.rpc("go_burger_favoritar_loja_v10",{p_loja_id:Number(id),p_favoritar:!current});if(error)return toast(error.message);if(data)state.favoriteIds.add(Number(id));else state.favoriteIds.delete(Number(id));renderStores();renderFavorites();toast(data?"Hamburgueria adicionada aos favoritos.":"Hamburgueria removida dos favoritos.")}
  function openStore(slug){if(!slug)return;localStorage.setItem("go_burger_loja_slug",slug);if(window.parent&&window.parent!==window){window.parent.postMessage({type:"go-burger-open-store",slug},location.origin)}else{location.href=`../cliente.html?loja=${encodeURIComponent(slug)}`}}
  function partner(){
    if(!state.user){showAuth("register");toast("Crie sua conta ou entre para cadastrar sua hamburgueria.");return;}
    if(window.parent&&window.parent!==window){
      window.parent.postMessage({type:"go-burger-mode",mode:"admin"},location.origin);
    }else{
      location.href="../../burger/index.html?modo=admin";
    }
  }

  function setPage(page){state.page=page;$$('[data-market-page]').forEach(b=>b.classList.toggle("active",b.dataset.marketPage===page));const sections={favorites:"favoritesSection",orders:"ordersSection",notifications:"notificationsSection"};Object.values(sections).forEach(id=>$("#"+id).classList.add("hidden"));if(page==="discover"){$("#storeSection").scrollIntoView({behavior:"smooth",block:"start"});return}if(page==="account"){if(state.user){if(confirm("Deseja sair da sua conta Go-burger?"))state.db.auth.signOut()}else showAuth();return}if(!state.user){showAuth();return}const id=sections[page];if(id){$("#"+id).classList.remove("hidden");$("#"+id).scrollIntoView({behavior:"smooth",block:"start"})}if(page==="orders")loadOrders().catch(e=>toast(e.message));if(page==="notifications")loadNotifications().catch(e=>toast(e.message));if(page==="favorites")renderFavorites()}

  async function login(e){e.preventDefault();const f=e.currentTarget,b=f.querySelector('button[type="submit"]');b.disabled=true;try{const {data,error}=await state.db.auth.signInWithPassword({email:String(f.elements.email.value||"").trim().toLowerCase(),password:String(f.elements.password.value||"")});if(error)throw error;state.user=data.user;await afterAuth();closeAuth();toast("Bem-vindo à Go-burger!")}catch(err){authMessage(/invalid login/i.test(err.message||"")?"E-mail ou senha incorretos.":err.message)}finally{b.disabled=false}}
  async function register(e){
    e.preventDefault();
    const f=e.currentTarget,b=f.querySelector('button[type="submit"]');
    const nome=String(f.elements.nome.value||"").trim();
    const email=String(f.elements.email.value||"").trim().toLowerCase();
    const telefone=normalizePhoneBR(f.elements.telefone.value);
    const password=String(f.elements.password.value||"");
    if(!nome||!email||!telefone)return authMessage("Preencha nome, e-mail e celular.");
    if(password.length<8)return authMessage("Use pelo menos 8 caracteres na senha.");
    if(!f.elements.termos?.checked)return authMessage("Aceite os Termos e a Política de Privacidade.");
    b.disabled=true;
    try{
      const {data:signupGate,error:signupGateError}=await state.db.rpc("go_burger_plataforma_publica_v1");
      if(signupGateError)throw new Error("Não foi possível validar a abertura de novos cadastros. Tente novamente mais tarde.");
      if(signupGate?.manutencao||signupGate?.user_signups_enabled===false)throw new Error(signupGate?.manutencao_mensagem||"Novos cadastros estão temporariamente indisponíveis enquanto a Go Burger finaliza o lançamento.");
      const {data,error}=await state.db.auth.signUp({
        email,password,
        options:{data:{nome,telefone,go_burger_terms_accepted:true,go_burger_terms_version:"1.2"}}
      });
      if(error)throw error;
      if(data.session?.user){
        state.user=data.session.user;
        await afterAuth();closeAuth();toast("Conta criada com sucesso.");
      }else{
        switchAuth("login");
        $("#marketLoginForm").elements.email.value=email;
        authMessage("Conta criada. Confirme seu e-mail e depois entre.","info");
      }
    }catch(err){authMessage(err.message||"Não foi possível criar a conta.");}
    finally{b.disabled=false;}
  }

  async function recover(){const email=String($("#marketLoginForm").elements.email.value||"").trim().toLowerCase();if(!email.includes("@"))return authMessage("Informe seu e-mail para recuperar a senha.","info");try{const redirectTo=["http:","https:"].includes(location.protocol)?`${location.origin}${location.pathname}`:undefined;const {error}=await state.db.auth.resetPasswordForEmail(email,redirectTo?{redirectTo}:undefined);if(error)throw error;authMessage("Se a conta existir, enviaremos as instruções para o seu e-mail.","info")}catch(e){authMessage(e.message)}}
  async function afterAuth(){await syncClientTerms();await loadProfile();renderAccount();await Promise.all([loadFavorites(),loadOrders(),loadNotifications()]);startRealtime();if(window.parent&&window.parent!==window)window.parent.postMessage({type:"go-burger-auth-refresh"},location.origin)}
  function startRealtime(){if(state.realtime){state.db.removeChannel(state.realtime).catch(()=>{});state.realtime=null}if(!state.user)return;state.realtime=state.db.channel(`go-burger-marketplace-${state.user.id}`).on("postgres_changes",{event:"*",schema:"public",table:"pedidos",filter:`user_id=eq.${state.user.id}`},()=>loadOrders().catch(()=>{})).on("postgres_changes",{event:"*",schema:"public",table:"notificacoes",filter:`user_id=eq.${state.user.id}`},()=>loadNotifications().catch(()=>{})).subscribe()}

  function bind(){
    $("#marketSearch").addEventListener("input",e=>{state.query=e.target.value.trim();$("#clearMarketSearch").classList.toggle("hidden",!state.query);clearTimeout(searchTimer);searchTimer=setTimeout(()=>loadStores(),260)});
    $("#clearMarketSearch").addEventListener("click",()=>{$("#marketSearch").value="";state.query="";$("#clearMarketSearch").classList.add("hidden");loadStores()});
    $("#cityFilter").addEventListener("change",e=>{state.city=e.target.value;loadStores()});$("#sortFilter").addEventListener("change",e=>{state.sort=e.target.value;loadStores()});$("#openOnly").addEventListener("change",e=>{state.openOnly=e.target.checked;loadStores()});
    $("#marketCategories").addEventListener("click",e=>{const b=e.target.closest("[data-category]");if(!b)return;state.category=b.dataset.category;renderCategories();loadStores()});
    document.addEventListener("click",e=>{const fav=e.target.closest("[data-store-favorite]");if(fav){e.preventDefault();e.stopPropagation();toggleFavorite(fav.dataset.storeFavorite);return}const open=e.target.closest("[data-store-open]");if(open){e.preventDefault();e.stopPropagation();openStore(open.dataset.storeOpen);return}const card=e.target.closest("[data-store]");if(card)openStore(card.dataset.store)});
    $("#btnClearFilters").addEventListener("click",()=>{state.query=state.category=state.city="";state.sort="recomendadas";state.openOnly=false;$("#marketSearch").value="";$("#cityFilter").value="";$("#sortFilter").value="recomendadas";$("#openOnly").checked=false;renderCategories();loadStores()});
    $$('[data-scroll-stores]').forEach(b=>b.addEventListener("click",()=>$("#storesAnchor").scrollIntoView({behavior:"smooth"})));[$("#btnBecomePartner"),$("#btnPartnerCta")].forEach(b=>b.addEventListener("click",partner));
    $("#btnAccount").addEventListener("click",()=>state.user?setPage("account"):showAuth());$("#btnNotificationsTop").addEventListener("click",()=>setPage("notifications"));$$('[data-market-page]').forEach(b=>b.addEventListener("click",()=>setPage(b.dataset.marketPage)));
    $$('[data-close-auth]').forEach(b=>b.addEventListener("click",closeAuth));$$('[data-market-auth]').forEach(b=>b.addEventListener("click",()=>switchAuth(b.dataset.marketAuth)));$("#marketLoginForm").addEventListener("submit",login);$("#marketRegisterForm").addEventListener("submit",register);$("#marketRecover").addEventListener("click",recover);
    $("#brandHome").addEventListener("click",()=>setPage("discover"));
    window.addEventListener("online",()=>$("#offlineBar").classList.add("hidden"));window.addEventListener("offline",()=>$("#offlineBar").classList.remove("hidden"));
  }

  async function boot(){try{window.GoBurgerTheme?.apply?.();bind();await initDb();if(state.user)syncClientTerms();track("marketplace_aberto",null,{autenticado:!!state.user});renderAccount();await Promise.all([loadCategories(),loadAllForCities()]);await Promise.all([loadStores(),loadFavorites(),loadOrders(),loadNotifications()]);startRealtime();state.db.auth.onAuthStateChange((event,session)=>{if(event==="INITIAL_SESSION")return;state.user=session?.user||null;if(event==="TOKEN_REFRESHED")return;setTimeout(()=>afterAuth().catch(()=>{}),0)});if(!navigator.onLine)$("#offlineBar").classList.remove("hidden")}catch(e){console.error(e);$("#storeGrid").innerHTML=empty("fa-triangle-exclamation","A Go-burger não iniciou",e.message||"Atualize a página para tentar novamente.");$("#marketLoading").classList.add("hidden")}}
  document.addEventListener("DOMContentLoaded",boot);
  if (window.parent===window && "serviceWorker" in navigator && ["http:","https:"].includes(location.protocol)) navigator.serviceWorker.register("../../sw.js").catch(()=>{});
})();  async function syncClientTerms(){
    if(!state.user||state.user.user_metadata?.go_burger_terms_accepted!==true)return;
    for(const tipo of ["cliente","privacidade"]){try{await state.db.rpc("go_burger_aceitar_termo_v1",{p_tipo:tipo,p_versao:"1.2",p_aceito:true,p_origem:"marketplace"});}catch{}}
  }
