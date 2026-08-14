(() => {
  "use strict";

  const SUPABASE_URL = "https://ethlgaszdextwckdwgsf.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_qEhxWcCbekPjYFUW-EQ1ow_xccHG8aJ";
  const COMMON_AUTH_KEY = "go-burger-auth-v1";
  const LEGACY_AUTH_KEYS = ["burger-client-auth-v4", "burger-admin-auth-v4"];
  const APP_VERSION = "608";

  const $ = selector => document.querySelector(selector);
  const frame = $("#appFrame");
  const loader = $("#gbLoader");
  const btnExplorar = $("#btnExplorar");
  const btnCliente = $("#btnCliente");
  const btnAdmin = $("#btnAdmin");
  const btnEntregador = $("#btnEntregador");
  const btnSuperAdmin = $("#btnSuperAdmin");
  const btnAdminLabel = $("#btnAdminLabel");
  const sessionDot = $("#sessionDot");
  const sessionLabel = $("#sessionLabel");
  const storeLabel = $("#storeLabel");
  const brandSubtitle = $("#brandSubtitle");

  let db = null;
  let currentMode = "cliente";
  let currentUserId = null;
  let adminStores = [];
  let isSuperAdmin = false;
  let isSuperAdminMember = false;
  let accountStatus = "ativo";
  let platformMaintenance = false;
  let platformMaintenanceMessage = "A Go-burger está em manutenção programada. Voltamos em breve.";
  let newPartnerRegistrations = true;
  let lastFrameUrl = "";
  let toastTimer = null;
  let accessRefreshPromise = null;
  let forceAccessRefreshQueued = false;
  let frameLoadTimer = null;

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

  function requestedMode() {
    const params = new URLSearchParams(location.search);
    const value = String(params.get("modo") || localStorage.getItem("go_burger_modo") || "cliente").toLowerCase();
    return ["cliente","admin","entregador","superadmin"].includes(value) ? value : "cliente";
  }

  function migrateLegacySession() {
    if (localStorage.getItem(COMMON_AUTH_KEY)) return;

    const mode = requestedMode();
    const preferred = ["admin","superadmin"].includes(mode)
      ? ["burger-admin-auth-v4", "burger-client-auth-v4"]
      : ["burger-client-auth-v4", "burger-admin-auth-v4"];

    const source = preferred.find(key => localStorage.getItem(key));
    if (!source) return;

    localStorage.setItem(COMMON_AUTH_KEY, localStorage.getItem(source));

    const verifier = localStorage.getItem(`${source}-code-verifier`);
    if (verifier) localStorage.setItem(`${COMMON_AUTH_KEY}-code-verifier`, verifier);

    LEGACY_AUTH_KEYS.forEach(key => {
      localStorage.removeItem(key);
      localStorage.removeItem(`${key}-code-verifier`);
    });
  }

  function toast(message) {
    const el = $("#gbToast");
    if (!el) return;
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2800);
  }

  function activeStoreSlug() {
    const params = new URLSearchParams(location.search);
    return String(params.get("loja") || localStorage.getItem("go_burger_loja_slug") || "").trim().toLowerCase();
  }

  function clientUrl() {
    const slug = activeStoreSlug();
    return slug
      ? `../cliente/cliente.html?loja=${encodeURIComponent(slug)}&v=${APP_VERSION}`
      : `../cliente/marketplace/market.html?v=${APP_VERSION}`;
  }

  function setUrlMode(mode) {
    const url = new URL(location.href);
    url.searchParams.set("modo", mode);
    history.replaceState(null, "", url);
  }

  function markMode(mode) {
    currentMode = mode;
    localStorage.setItem("go_burger_modo", mode);
    setUrlMode(mode);
    btnExplorar?.classList.toggle("active", mode === "cliente" && !activeStoreSlug());
    btnCliente?.classList.toggle("active", mode === "cliente" && !!activeStoreSlug());
    btnAdmin?.classList.toggle("active", mode === "admin");
    btnEntregador?.classList.toggle("active", mode === "entregador");
    btnSuperAdmin?.classList.toggle("active", mode === "superadmin");
    if (brandSubtitle) brandSubtitle.textContent = mode === "superadmin" ? "COMMAND CENTER · PLATAFORMA" : mode === "admin" ? "PARCEIROS · GESTÃO DA HAMBURGUERIA" : mode === "entregador" ? "ENTREGAS · ROTA E OPERAÇÃO" : "HAMBURGUERIAS EM UM SÓ APP";
    document.title = mode === "superadmin" ? "Go-burger | Super Admin" : mode === "admin" ? "Go-burger | Parceiros" : mode === "entregador" ? "Go-burger | Entregador" : "Go-burger";
  }

  function loadFrame(mode, { force = false } = {}) {
    if (mode === "superadmin" && !isSuperAdminMember) {
      toast("Acesso exclusivo da equipe Super Admin da Go-burger.");
      mode = "cliente";
    }
    // Admin também funciona como onboarding para quem ainda não tem loja.
    if (mode === "admin" && !currentUserId) {
      toast("Faça login para acessar o Go-burger Parceiros.");
      mode = "cliente";
    }
    if (mode === "entregador" && !currentUserId) {
      toast("Faça login para acessar o painel do entregador.");
      mode = "cliente";
    }

    markMode(mode);
    let next = mode === "superadmin"
      ? `../superadmin/superadmin.html?v=${APP_VERSION}`
      : mode === "entregador"
        ? `../entregador/entregador.html?v=${APP_VERSION}`
        : mode === "admin"
          ? `../admin/admin.html?v=${APP_VERSION}`
          : clientUrl();
    if(mode==="admin"){
      const source=new URLSearchParams(location.search);
      const forwarded=new URLSearchParams();
      ["mp","motivo","loja_id","assinatura"].forEach(key=>{const value=source.get(key);if(value)forwarded.set(key,value);});
      if([...forwarded.keys()].length)next+=`${next.includes("?")?"&":"?"}${forwarded.toString()}`;
    }
    if (!force && next === lastFrameUrl) return;

    lastFrameUrl = next;
    loader?.classList.remove("hidden");
    frame?.classList.remove("ready");

    clearTimeout(frameLoadTimer);

    if (frame) {
      frame.src = next;

      frameLoadTimer = setTimeout(() => {
        if (!frame.classList.contains("ready")) {
          loader?.classList.add("hidden");
          frame.classList.add("ready");
          toast("A tela demorou para responder. Tente atualizar se necessário.");
        }
      }, 10000);
    }
  }

  async function loadPublicPlatformConfig() {
    try {
      const { data, error } = await withTimeout(
        db.rpc("go_burger_plataforma_publica_v1"),
        5000,
        "configuração pública"
      );

      if (error) throw error;

      platformMaintenance = data?.manutencao === true;
      platformMaintenanceMessage = String(
        data?.manutencao_mensagem || platformMaintenanceMessage
      );
      newPartnerRegistrations = data?.partner_applications_enabled !== false;
    } catch (error) {
      platformMaintenance = false;
      console.warn("Go-burger: configuração pública", error.message);
    }
  }

  function showMaintenance() {
    lastFrameUrl = "";
    if (frame) { frame.src = "about:blank"; frame.classList.remove("ready"); }
    if (!loader) return;
    loader.classList.remove("hidden");
    loader.innerHTML = `<div class="gb-loader-mark">🍔</div><strong>Go-burger em manutenção</strong><span>${platformMaintenanceMessage.replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}</span><button type="button" class="gb-maintenance-logout" id="gbMaintenanceLogout">Sair da conta</button>`;
    $("#gbMaintenanceLogout")?.addEventListener("click", async () => {
      await db.auth.signOut();
      location.reload();
    }, { once: true });
  }

  async function loadPlatformAccess() {
    isSuperAdmin = false;
    isSuperAdminMember = false;
    accountStatus = "ativo";
    if (!currentUserId) return;
    try {
      const [{ data: access }, { data: superFlag }, { data: memberFlag }] = await withTimeout(
        Promise.all([
          db.rpc("go_burger_status_usuario"),
          db.rpc("go_burger_e_super_admin"),
          db.rpc("go_burger_e_super_admin_membro_v605")
        ]),
        6000,
        "validação de acesso"
      );
      accountStatus = String(access?.status || "ativo").toLowerCase();
      isSuperAdmin = superFlag === true || access?.super_admin === true;
      isSuperAdminMember = memberFlag === true || isSuperAdmin;
    } catch (e) {
      console.warn("Go-burger: validação de acesso", e.message);
    }
    btnSuperAdmin?.classList.toggle("hidden", !isSuperAdminMember);
  }

  async function loadAdminStores() {
    adminStores = [];
    try {
      const { data, error } = await withTimeout(db.rpc("minhas_lojas"), 6000, "lojas do usuário");
      if (error) throw error;
      adminStores = Array.isArray(data) ? data.filter(row => ["dono", "admin", "gerente", "cozinha", "atendente", "entregador"].includes(String(row.papel || "").toLowerCase())) : [];
    } catch {
      adminStores = [];
    }

    // Usuário autenticado sempre pode abrir Parceiros: sem loja, vira onboarding.
    btnAdmin?.classList.toggle("hidden", !currentUserId);
    const canDeliver = adminStores.some(row => String(row.papel||"").toLowerCase() === "entregador");
    btnEntregador?.classList.toggle("hidden", !currentUserId || !canDeliver);
    if (btnAdminLabel) btnAdminLabel.textContent = adminStores.length ? "Painel da loja" : newPartnerRegistrations ? "Seja parceiro" : "Cadastros pausados";
    if (adminStores.length) {
      const loja = adminStores.find(x => x.principal) || adminStores[0];
      storeLabel.textContent = adminStores.length > 1 ? `${loja.nome} + ${adminStores.length - 1} loja(s)` : loja.nome;
    } else if (currentUserId) {
      storeLabel.textContent = isSuperAdminMember ? "Equipe Go-burger" : "Conta de cliente · seja parceiro";
    }
  }

  async function refreshAccess({ forceFrame = false } = {}) {
    if (!db) return;

    await loadPublicPlatformConfig();

    let user = null;

    try {
      const { data } = await withTimeout(
        db.auth.getSession(),
        5000,
        "sessão"
      );

      user = data?.session?.user || null;
    } catch (error) {
      console.warn("Go-burger: sessão", error.message);
    }
    const nextUserId = user?.id || null;
    const userChanged = nextUserId !== currentUserId;

    if (userChanged) {
      currentUserId = nextUserId;
      adminStores = [];
      isSuperAdmin = false;
      isSuperAdminMember = false;
      accountStatus = "ativo";
    }

    sessionDot?.classList.toggle("online", !!user);
    if (sessionLabel) sessionLabel.textContent = user?.email || "Visitante";

    if (!user) {
      isSuperAdmin = false;
      isSuperAdminMember = false;
      btnAdmin?.classList.add("hidden");
      btnEntregador?.classList.add("hidden");
      btnSuperAdmin?.classList.add("hidden");
      if (storeLabel) storeLabel.textContent = "Faça login para continuar";
      if (["admin","entregador","superadmin"].includes(currentMode)) loadFrame("cliente", { force: true });
      return;
    }

    await loadPlatformAccess();
    if (platformMaintenance && !isSuperAdminMember) {
      btnAdmin?.classList.add("hidden");
      btnEntregador?.classList.add("hidden");
      btnSuperAdmin?.classList.add("hidden");
      if (storeLabel) storeLabel.textContent = "Manutenção programada";
      showMaintenance();
      return;
    }
    if (accountStatus !== "ativo" && !isSuperAdminMember) {
      toast(`Sua conta está ${accountStatus} na Go-burger. Fale com o suporte.`);
      if (currentMode !== "cliente") loadFrame("cliente", { force:true });
      return;
    }
    if (userChanged || adminStores.length === 0) await loadAdminStores();

    const desired = requestedMode();
    if ((forceFrame || userChanged) && desired === "superadmin" && isSuperAdminMember) {
      loadFrame("superadmin", { force: forceFrame || userChanged });
    } else if ((forceFrame || userChanged) && desired === "admin") {
      loadFrame("admin", { force: forceFrame || userChanged });
    } else if (desired === "superadmin" && !isSuperAdminMember) {
      loadFrame("cliente", { force: forceFrame });
    }
  }

  function requestAccessRefresh({ forceFrame = false } = {}) {
    forceAccessRefreshQueued = forceAccessRefreshQueued || forceFrame;
    if (accessRefreshPromise) return accessRefreshPromise;

    accessRefreshPromise = (async () => {
      const runWithForce = forceAccessRefreshQueued;
      forceAccessRefreshQueued = false;
      await refreshAccess({ forceFrame: runWithForce });
    })().finally(() => {
      accessRefreshPromise = null;
      if (forceAccessRefreshQueued) {
        requestAccessRefresh({ forceFrame: true }).catch(() => {});
      }
    });

    return accessRefreshPromise;
  }

  async function openRequestedMode(mode) {
    if (!["admin", "entregador", "superadmin"].includes(mode)) {
      loadFrame(mode);
      return;
    }

    if (!db) {
      toast("A conexão da Go-burger ainda está sendo preparada. Tente novamente em instantes.");
      return;
    }

    // Os botões já refletem o último acesso validado e cada painel possui seu
    // próprio gate de segurança. Navegar primeiro evita travar a interface à
    // espera de RPC; a revalidação ocorre em segundo plano e corrige o modo se
    // a permissão tiver mudado.
    loadFrame(mode);
    requestAccessRefresh().catch(error => {
      console.warn("Go-burger: troca de painel", error.message);
      toast("Não foi possível atualizar as permissões agora, mas o painel continua protegido.");
    });
  }

  function bindEvents() {
    btnExplorar?.addEventListener("click", () => {
      localStorage.removeItem("go_burger_loja_slug");
      loadFrame("cliente", { force:true });
    });
    btnCliente?.addEventListener("click", () => loadFrame("cliente"));
    btnAdmin?.addEventListener("click", () => { void openRequestedMode("admin"); });
    btnEntregador?.addEventListener("click", () => { void openRequestedMode("entregador"); });
    btnSuperAdmin?.addEventListener("click", () => { void openRequestedMode("superadmin"); });
    $("#brandHome")?.addEventListener("click", () => { localStorage.removeItem("go_burger_loja_slug"); loadFrame("cliente", { force:true }); });

    const moreBtn=$("#btnMore"),moreMenu=$("#gbMoreMenu");
    moreBtn?.addEventListener("click",()=>{
      const open=moreMenu?.classList.toggle("hidden")===false;
      moreBtn.setAttribute("aria-expanded",String(open));
    });
    document.addEventListener("click",event=>{
      if(!event.target.closest?.("#btnMore,#gbMoreMenu")){
        moreMenu?.classList.add("hidden");
        moreBtn?.setAttribute("aria-expanded","false");
      }
      const route=event.target.closest?.("[data-shell-route]")?.dataset.shellRoute;
      if(!route)return;
      moreMenu?.classList.add("hidden");
      if(route==="explorar"){
        localStorage.removeItem("go_burger_loja_slug");
        return loadFrame("cliente",{force:true});
      }
      if(route==="pedidos"||route==="perfil"){
        if(!currentUserId)return toast("Faça login para abrir esta área.");
        markMode("cliente");
        const slug=activeStoreSlug();
        if(!slug)return toast("Abra uma hamburgueria primeiro para acessar essa área.");
        lastFrameUrl="";
        frame.src=`../cliente/cliente.html?loja=${encodeURIComponent(slug)}#${route}`;
        return;
      }
      if(route==="admin"){ void openRequestedMode("admin"); return; }
      if(route==="entregador"){ void openRequestedMode("entregador"); return; }
      if(route==="cadastro-entregador"){lastFrameUrl="";loader?.classList.remove("hidden");frame?.classList.remove("ready");frame.src="../entregador/cadastro.html";return;}
      if(route==="ajuda"){
        lastFrameUrl="";loader?.classList.remove("hidden");frame?.classList.remove("ready");
        frame.src="../ajuda/index.html";
      }
    });

    frame?.addEventListener("load", () => {
      clearTimeout(frameLoadTimer);
      loader?.classList.add("hidden");
      frame.classList.add("ready");
    });

    frame?.addEventListener("error", () => {
      clearTimeout(frameLoadTimer);
      loader?.classList.add("hidden");
      frame.classList.add("ready");
      toast("Não foi possível carregar esta tela da Go-burger.");
    });

    window.addEventListener("storage", event => {
      if (event.key === COMMON_AUTH_KEY) {
        requestAccessRefresh().catch(() => {});
      }
    });

    window.addEventListener("message", event => {
      if (event.origin !== location.origin || !event.data) return;
      if (event.data.type === "go-burger-auth-refresh") requestAccessRefresh().catch(() => {});
      if (event.data.type === "go-burger-open-store" && event.data.slug) {
        localStorage.setItem("go_burger_loja_slug", String(event.data.slug).trim().toLowerCase());
        loadFrame("cliente", { force:true });
      }
      if (event.data.type === "go-burger-home") {
        localStorage.removeItem("go_burger_loja_slug");
        loadFrame("cliente", { force:true });
      }
      if (event.data.type === "go-burger-mode" && ["cliente", "admin", "entregador", "superadmin"].includes(event.data.mode)) {
        void openRequestedMode(event.data.mode);
      }
    });
  }

  async function boot() {
    migrateLegacySession();

    // HOTFIX 601: a navegação do shell deve funcionar mesmo quando o SDK do
    // Supabase estiver lento, bloqueado ou temporariamente indisponível.
    // Registrar os eventos antes da dependência de rede evita botões "mortos"
    // em celular e em conexões instáveis.
    bindEvents();

    const desired = requestedMode();
    markMode("cliente");
    loadFrame("cliente", { force: true });

    if (!window.supabase?.createClient) {
      console.warn("Go-burger: SDK do Supabase indisponível no shell; navegação pública mantida ativa.");
      loader?.classList.add("hidden");
      frame?.classList.add("ready");

      if (sessionLabel) sessionLabel.textContent = "Visitante";
      if (storeLabel) storeLabel.textContent = "Modo público · conexão limitada";

      // Recurso público continua navegável; áreas autenticadas exibem feedback.
      return;
    }

    db = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: COMMON_AUTH_KEY
      }
    });

    // A área pública já foi aberta antes da inicialização do Supabase.

    try {
      await withTimeout(
        refreshAccess(),
        8000,
        "inicialização da conta"
      );
    } catch (error) {
      console.warn(
        "Go-burger: inicialização continuou em modo público",
        error.message
      );
    }

    const firstMode =
      desired === "superadmin" && isSuperAdminMember
        ? "superadmin"
        : desired === "entregador" && currentUserId
          ? "entregador"
          : desired === "admin" && currentUserId
            ? "admin"
            : "cliente";

    if (firstMode !== "cliente") {
      loadFrame(firstMode, { force: true });
    }

    db.auth.onAuthStateChange(event => {
      // INITIAL_SESSION e TOKEN_REFRESHED também são emitidos pelos clientes
      // Supabase dos iframes. Forçar a rota nesses eventos criava um ciclo:
      // iframe inicia -> auth avisa -> shell recarrega -> iframe inicia.
      if (event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED") return;
      setTimeout(() => requestAccessRefresh().catch(() => {}), 0);
    });

    setInterval(() => withTimeout(requestAccessRefresh(), 8000, "atualização de acesso").catch(() => {}), 60000);

    if ("serviceWorker" in navigator && ["http:", "https:"].includes(location.protocol)) {
      navigator.serviceWorker.register("../sw.js").then(registration => {
        registration.update().catch(() => {});
        if (registration.waiting) registration.waiting.postMessage({ type: "SKIP_WAITING" });
        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          worker?.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              worker.postMessage({ type: "SKIP_WAITING" });
            }
          });
        });
      }).catch(() => {});

      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (sessionStorage.getItem("go-burger-sw-reloaded") === "1") return;
        sessionStorage.setItem("go-burger-sw-reloaded", "1");
        location.reload();
      });
      setTimeout(() => sessionStorage.removeItem("go-burger-sw-reloaded"), 5000);
    }
  }

  boot().catch(error => {
    console.error("Go-burger shell:", error);
    loader?.classList.add("hidden");
    frame?.classList.add("ready");
    toast("A conta não pôde ser validada agora, mas o modo público continua disponível.");
  });
})();
