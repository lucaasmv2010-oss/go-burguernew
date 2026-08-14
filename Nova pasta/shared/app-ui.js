(() => {
  "use strict";

  const CONSENT_KEY = "go_burger_consent_v2";
  const APP_ROOT_URL = (() => {
    try {
      const script = document.currentScript?.src;
      if (script) return new URL("../", script);
    } catch {}
    const path = location.pathname.replace(/\\/g, "/");
    if (path.includes("/cliente/marketplace/")) return new URL("../../", location.href);
    if (/\/(cliente|admin|superadmin|entregador|legal|burger|ajuda)\//.test(path)) return new URL("../", location.href);
    return new URL("./", location.href);
  })();
  let installPrompt = null;

  function rootPrefix() {
    return APP_ROOT_URL.href;
  }

  function appUrl(path = "") {
    return new URL(String(path).replace(/^\//, ""), APP_ROOT_URL).href;
  }

  function svg(path) {
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"></path></svg>`;
  }

  function addSkipLink() {
    if (document.querySelector(".gb-skip-link")) return;
    const main = document.querySelector("main") || document.querySelector("[role=main]");
    if (!main) return;
    if (!main.id) main.id = "gbMainContent";
    const a = document.createElement("a");
    a.className = "gb-skip-link";
    a.href = `#${main.id}`;
    a.textContent = "Pular para o conteúdo";
    document.body.prepend(a);
  }

  let choiceSheet = null;
  let activeChoiceSelect = null;

  function selectFieldTitle(select) {
    const label = select.closest("label");
    const explicit = label?.querySelector(":scope > span")?.textContent?.trim();
    return explicit || select.getAttribute("aria-label") || select.dataset.gbTitle || "Selecione uma opção";
  }

  function choiceIcon(text = "") {
    const value = text.toLowerCase();
    if (value.includes("bairro") || value.includes("região") || value.includes("endereço")) return "fa-location-dot";
    if (value.includes("retirada")) return "fa-store";
    if (value.includes("entrega")) return "fa-motorcycle";
    if (value.includes("pix")) return "fa-qrcode";
    if (value.includes("cartão") || value.includes("crédito") || value.includes("débito")) return "fa-credit-card";
    if (value.includes("dinheiro")) return "fa-money-bill-wave";
    if (value.includes("plano")) return "fa-gem";
    if (value.includes("outro") || value.includes("novo")) return "fa-plus";
    if (value.includes("mais") || value.includes("maior")) return "fa-arrow-up";
    return "fa-check";
  }

  function ensureChoiceSheet() {
    if (choiceSheet) return choiceSheet;
    const overlay = document.createElement("div");
    overlay.className = "gb-choice-overlay";
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = `
      <section class="gb-choice-sheet" role="dialog" aria-modal="true" aria-labelledby="gbChoiceTitle">
        <div class="gb-choice-grabber" aria-hidden="true"></div>
        <header class="gb-choice-head">
          <div>
            <small>GO-BURGER</small>
            <h2 id="gbChoiceTitle">Selecione</h2>
          </div>
          <button class="gb-choice-close" type="button" aria-label="Fechar opções">×</button>
        </header>
        <div class="gb-choice-list" id="gbChoiceList"></div>
      </section>`;
    document.body.appendChild(overlay);
    choiceSheet = overlay;

    const close = () => closeChoiceSheet();
    overlay.addEventListener("click", event => {
      if (event.target === overlay || event.target.closest(".gb-choice-close")) close();
      const option = event.target.closest("[data-gb-choice-value]");
      if (!option || !activeChoiceSelect) return;
      activeChoiceSelect.value = option.dataset.gbChoiceValue;
      activeChoiceSelect.dispatchEvent(new Event("input", { bubbles:true }));
      activeChoiceSelect.dispatchEvent(new Event("change", { bubbles:true }));
      refreshSelectProxy(activeChoiceSelect);
      close();
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && overlay.classList.contains("open")) close();
    });
    return overlay;
  }

  function closeChoiceSheet() {
    if (!choiceSheet) return;
    choiceSheet.classList.remove("open");
    choiceSheet.setAttribute("aria-hidden", "true");
    document.documentElement.classList.remove("gb-choice-lock");
    const trigger = activeChoiceSelect?.closest(".gb-select-shell")?.querySelector(".gb-smart-select-trigger");
    activeChoiceSelect = null;
    trigger?.focus({ preventScroll:true });
  }

  function refreshSelectProxy(select) {
    const trigger = select.closest(".gb-select-shell")?.querySelector(".gb-smart-select-trigger");
    if (!trigger) return;
    const option = select.selectedOptions?.[0] || select.options?.[select.selectedIndex];
    const text = option?.textContent?.trim() || select.dataset.placeholder || "Selecione";
    const empty = !select.value;
    trigger.disabled = select.disabled;
    trigger.classList.toggle("placeholder", empty);
    trigger.innerHTML = `
      <span class="gb-smart-select-main">
        <i class="fa-solid ${choiceIcon(text)}" aria-hidden="true"></i>
        <span>${text.replace(/[&<>]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]))}</span>
      </span>
      <i class="fa-solid fa-chevron-down gb-smart-select-chevron" aria-hidden="true"></i>`;
  }

  function openSelectSheet(select) {
    if (select.disabled) return;
    const overlay = ensureChoiceSheet();
    activeChoiceSelect = select;
    overlay.querySelector("#gbChoiceTitle").textContent = selectFieldTitle(select);
    const list = overlay.querySelector("#gbChoiceList");
    list.innerHTML = Array.from(select.options)
      .filter(option => !option.hidden)
      .map(option => {
        const text = option.textContent?.trim() || "Opção";
        const selected = option.value === select.value;
        return `<button type="button" class="gb-choice-option ${selected ? "selected" : ""}" data-gb-choice-value="${String(option.value).replace(/&/g,"&amp;").replace(/\"/g,"&quot;")}" ${option.disabled ? "disabled" : ""}>
          <span class="gb-choice-option-icon"><i class="fa-solid ${choiceIcon(text)}" aria-hidden="true"></i></span>
          <span class="gb-choice-option-copy"><strong>${text.replace(/[&<>]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]))}</strong>${option.dataset.description ? `<small>${option.dataset.description}</small>` : ""}</span>
          <span class="gb-choice-option-check"><i class="fa-solid fa-check" aria-hidden="true"></i></span>
        </button>`;
      }).join("");
    overlay.classList.add("open");
    overlay.setAttribute("aria-hidden", "false");
    document.documentElement.classList.add("gb-choice-lock");
    requestAnimationFrame(() => overlay.querySelector(".gb-choice-option.selected, .gb-choice-option:not(:disabled)")?.focus({ preventScroll:true }));
  }

  function enhanceSelect(select) {
    if (!select || select.dataset.gbEnhanced === "1") return;
    const nativeSelectContexts = ".select-control,.store-context,.filter-controls,.filters,.filter-row,.toolbar-actions,.header-actions,.market-toolbar,.page-toolbar,.table-actions,.panel-head,.sa-panel-head,.sa-filterbar,.menu-tools,.team-form,.page-actions";
    if (select.multiple || Number(select.size || 0) > 1 || select.hasAttribute("data-no-enhance")) {
      select.dataset.gbEnhanced = "1";
      return;
    }
    // Barras compactas já possuem composição, ícone e medidas próprias.
    // Mantê-las nativas evita um segundo botão visual dentro do controle.
    if (select.closest(nativeSelectContexts)) {
      select.dataset.gbEnhanced = "1";
      return;
    }
    if (select.closest(".gb-select-shell")) {
      select.dataset.gbEnhanced = "1";
      return;
    }

    const wrapper = document.createElement("div");
    wrapper.className = "gb-select-shell";
    const compact = select.classList.contains("status-select") || select.classList.contains("priority-select") || select.hasAttribute("data-compact-select");
    if (compact) wrapper.classList.add("gb-select-compact");
    select.parentNode.insertBefore(wrapper, select);
    wrapper.appendChild(select);
    select.dataset.gbEnhanced = "1";

    if (compact) return;

    wrapper.classList.add("gb-select-smart");
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "gb-smart-select-trigger";
    trigger.setAttribute("aria-haspopup", "dialog");
    trigger.setAttribute("aria-label", selectFieldTitle(select));
    wrapper.appendChild(trigger);

    select.classList.add("gb-native-select-hidden");
    select.tabIndex = -1;
    select.addEventListener("change", () => refreshSelectProxy(select));
    trigger.addEventListener("click", () => openSelectSheet(select));
    refreshSelectProxy(select);

    const observer = new MutationObserver(() => refreshSelectProxy(select));
    observer.observe(select, { childList:true, subtree:true, attributes:true });
  }

  function enhanceSelects(scope = document) {
    scope.querySelectorAll("select:not([data-no-enhance])").forEach(enhanceSelect);
  }

  function currentSection() {
    const p = location.pathname.replace(/\\/g, "/");
    if (p.includes("/admin/")) return "admin";
    if (p.includes("/superadmin/")) return "superadmin";
    if (p.includes("/entregador/")) return "entregador";
    if (p.includes("/marketplace/")) return "explorar";
    if (p.includes("/cliente/")) return location.hash === "#perfil" ? "perfil" : "pedidos";
    if (p.includes("/ajuda/")) return "ajuda";
    if (p.endsWith("/legal/privacidade.html")) return "privacidade";
    if (p.endsWith("/legal/termos-cliente.html")) return "termos-cliente";
    if (p.endsWith("/legal/termos-parceiros.html")) return "termos-parceiro";
    if (p.endsWith("/legal/cookies.html")) return "cookies";
    if (p.includes("/legal/")) return "legal";
    if (p.endsWith("/status.html")) return "status";
    if (p.endsWith("/offline.html")) return "offline";
    return "inicio";
  }

  function navigationGroups() {
    return [
      {
        title: "Go-burger",
        items: [
          ["inicio", "burger/index.html?modo=cliente", "Início", "Abrir o aplicativo principal", "fa-house"],
          ["explorar", "cliente/marketplace/market.html", "Explorar hamburguerias", "Marketplace, busca e lojas", "fa-compass"],
          ["pedidos", "cliente/cliente.html#pedidos", "Meus pedidos", "Acompanhar pedidos e histórico", "fa-receipt"],
          ["perfil", "cliente/cliente.html#perfil", "Minha conta", "Perfil, endereços e privacidade", "fa-user"],
        ]
      },
      {
        title: "Operação",
        items: [
          ["admin", "burger/index.html?modo=admin", "Painel do parceiro", "Gerenciar hamburgueria", "fa-store"],
          ["entregador", "entregador/entregador.html", "Entregador", "Entregas, rota e localização", "fa-motorcycle"],
          ["superadmin", "burger/index.html?modo=superadmin", "Super Admin", "Gestão da plataforma", "fa-shield-halved"],
        ]
      },
      {
        title: "Suporte e confiança",
        items: [
          ["ajuda", "ajuda/index.html", "Central de ajuda", "Ajuda rápida e atalhos", "fa-circle-question"],
          ["status", "status.html", "Status da plataforma", "Saúde e disponibilidade", "fa-signal"],
          ["legal", "legal/index.html", "Central jurídica", "Privacidade, termos e cookies", "fa-scale-balanced"],
          ["privacidade", "legal/privacidade.html", "Privacidade", "Política de Privacidade", "fa-user-shield"],
          ["termos-cliente", "legal/termos-cliente.html", "Termos do cliente", "Regras para clientes", "fa-file-signature"],
          ["termos-parceiro", "legal/termos-parceiros.html", "Termos dos parceiros", "Regras para hamburguerias", "fa-handshake"],
          ["cookies", "legal/cookies.html", "Cookies e preferências", "Armazenamento e consentimento", "fa-cookie-bite"],
        ]
      }
    ];
  }

  let navigationOverlay = null;

  function closeNavigationHub() {
    if (!navigationOverlay) return;
    navigationOverlay.classList.remove("open");
    navigationOverlay.setAttribute("aria-hidden", "true");
    document.documentElement.classList.remove("gb-navigation-lock");
    document.querySelector(".gb-navigation-launcher, .gb-more-nav-trigger")?.focus({ preventScroll:true });
  }

  function openNavigationHub() {
    document.querySelector("#gbMoreMenu")?.classList.add("hidden");
    document.querySelector("#btnMore")?.setAttribute("aria-expanded", "false");
    const overlay = ensureNavigationHub();
    overlay.classList.add("open");
    overlay.setAttribute("aria-hidden", "false");
    document.documentElement.classList.add("gb-navigation-lock");
    requestAnimationFrame(() => overlay.querySelector("a.active, a")?.focus({ preventScroll:true }));
  }

  function ensureNavigationHub() {
    if (navigationOverlay) return navigationOverlay;
    const active = currentSection();
    const overlay = document.createElement("div");
    overlay.className = "gb-navigation-overlay";
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = `
      <section class="gb-navigation-panel" role="dialog" aria-modal="true" aria-labelledby="gbNavigationTitle">
        <header class="gb-navigation-head">
          <div class="gb-navigation-brand"><span>🍔</span><div><small>GO-BURGER</small><h2 id="gbNavigationTitle">Ir para</h2></div></div>
          <button class="gb-navigation-close" type="button" aria-label="Fechar navegação"><i class="fa-solid fa-xmark"></i></button>
        </header>
        <div class="gb-navigation-groups">
          ${navigationGroups().map(group => `
            <section class="gb-navigation-group">
              <h3>${group.title}</h3>
              <div class="gb-navigation-grid">
                ${group.items.map(([key,path,label,description,icon]) => `
                  <a href="${appUrl(path)}" class="${active === key ? "active" : ""}" data-gb-nav-key="${key}">
                    <span class="gb-navigation-icon"><i class="fa-solid ${icon}" aria-hidden="true"></i></span>
                    <span class="gb-navigation-copy"><strong>${label}</strong><small>${description}</small></span>
                    <i class="fa-solid fa-chevron-right gb-navigation-arrow" aria-hidden="true"></i>
                  </a>`).join("")}
              </div>
            </section>`).join("")}
        </div>
      </section>`;
    document.body.appendChild(overlay);
    navigationOverlay = overlay;
    overlay.addEventListener("click", event => {
      if (event.target === overlay || event.target.closest(".gb-navigation-close")) closeNavigationHub();
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && overlay.classList.contains("open")) closeNavigationHub();
    });
    return overlay;
  }

  function buildStandaloneDock() {
    if (window.self !== window.top) return;
    if (document.querySelector(".gb-shell")) return;
    if (document.querySelector(".gb-standalone-dock")) return;

    const active = currentSection();
    const items = [
      ["explorar", "cliente/marketplace/market.html", "Explorar", "fa-compass"],
      ["pedidos", "cliente/cliente.html#pedidos", "Pedidos", "fa-receipt"],
      ["admin", "burger/index.html?modo=admin", "Parceiros", "fa-store"],
      ["entregador", "entregador/entregador.html", "Entregador", "fa-motorcycle"],
    ];

    const nav = document.createElement("nav");
    nav.className = "gb-standalone-dock";
    nav.setAttribute("aria-label", "Navegação principal Go-burger");
    nav.innerHTML = items.map(([key, path, label, icon]) =>
      `<a href="${appUrl(path)}" class="${active === key ? "active" : ""}"><i class="fa-solid ${icon}" aria-hidden="true"></i><span>${label}</span></a>`
    ).join("") + `<button class="gb-more-nav-trigger ${["ajuda","legal","status","superadmin","perfil"].includes(active) ? "active" : ""}" type="button" aria-haspopup="dialog" aria-label="Abrir todas as páginas"><i class="fa-solid fa-table-cells-large" aria-hidden="true"></i><span>Mais</span></button>`;
    document.body.appendChild(nav);
    document.body.classList.add("gb-has-standalone-dock");
    nav.querySelector(".gb-more-nav-trigger")?.addEventListener("click", openNavigationHub);
  }

  function wireShellNavigation() {
    const menu = document.querySelector("#gbMoreMenu");
    if (!menu || menu.querySelector("[data-shell-global-nav]")) return;

    const separator = document.createElement("div");
    separator.className = "gb-shell-menu-separator";
    separator.setAttribute("aria-hidden", "true");
    menu.appendChild(separator);

    const links = [
      ["ajuda/index.html", "fa-circle-question", "Central de ajuda", "Dúvidas e atalhos"],
      ["status.html", "fa-signal", "Status da plataforma", "Ver disponibilidade"],
      ["legal/index.html", "fa-scale-balanced", "Central jurídica", "Privacidade e termos"],
    ];
    for (const [path, icon, label, description] of links) {
      const a = document.createElement("a");
      a.href = appUrl(path);
      a.className = "gb-shell-menu-link";
      a.setAttribute("role", "menuitem");
      a.innerHTML = `<i class="fa-solid ${icon}" aria-hidden="true"></i><span><strong>${label}</strong><small>${description}</small></span>`;
      menu.appendChild(a);
    }

    const all = document.createElement("button");
    all.type = "button";
    all.dataset.shellGlobalNav = "1";
    all.className = "gb-shell-global-nav";
    all.innerHTML = '<i class="fa-solid fa-table-cells-large" aria-hidden="true"></i><span><strong>Todas as páginas</strong><small>Abrir mapa completo da Go-burger</small></span>';
    all.addEventListener("click", openNavigationHub);
    menu.appendChild(all);
  }

  function statusBanner() {
    let el = document.querySelector(".gb-global-status");
    if (!el) {
      el = document.createElement("div");
      el.className = "gb-global-status";
      el.setAttribute("role", "status");
      el.setAttribute("aria-live", "polite");
      document.body.appendChild(el);
    }
    const update = () => {
      if (navigator.onLine) {
        el.textContent = "Conexão restaurada · Go-burger online";
        el.className = "gb-global-status show";
        setTimeout(() => el.classList.remove("show"), 2200);
      } else {
        el.textContent = "Você está offline · algumas ações ficarão disponíveis quando a internet voltar";
        el.className = "gb-global-status show offline";
      }
    };
    window.addEventListener("offline", update);
    window.addEventListener("online", update);
    if (!navigator.onLine) update();
  }

  function consentValue() {
    try { return JSON.parse(localStorage.getItem(CONSENT_KEY) || "null"); } catch { return null; }
  }

  function saveConsent(value) {
    const payload = {
      version: "1.1",
      necessary: true,
      analytics: !!value.analytics,
      marketing: !!value.marketing,
      accepted_at: new Date().toISOString()
    };
    localStorage.setItem(CONSENT_KEY, JSON.stringify(payload));
    document.querySelector(".gb-consent")?.remove();
    window.dispatchEvent(new CustomEvent("gb-consent-changed", { detail: payload }));
  }

  function showConsentPreferences() {
    const box = document.querySelector(".gb-consent");
    if (!box) return;
    let details = box.querySelector(".gb-consent-details");
    if (details) {
      details.hidden = !details.hidden;
      return;
    }
    details = document.createElement("div");
    details.className = "gb-consent-details";
    details.innerHTML = `
      <label class="gb-consent-row"><span><strong>Necessários</strong><small>Login, carrinho, segurança e funcionamento.</small></span><input type="checkbox" checked disabled></label>
      <label class="gb-consent-row"><span><strong>Analytics</strong><small>Métricas para melhorar a experiência e estabilidade.</small></span><input id="gbConsentAnalytics" type="checkbox"></label>
      <label class="gb-consent-row"><span><strong>Marketing</strong><small>Campanhas, benefícios e personalização promocional permitida.</small></span><input id="gbConsentMarketing" type="checkbox"></label>
      <button class="primary" type="button" id="gbConsentSave">Salvar preferências</button>`;
    box.insertBefore(details, box.querySelector(".gb-consent-actions"));
    box.querySelector("#gbConsentSave")?.addEventListener("click", () => saveConsent({
      analytics: box.querySelector("#gbConsentAnalytics")?.checked,
      marketing: box.querySelector("#gbConsentMarketing")?.checked
    }));
  }

  function buildConsent() {
    if (consentValue() || document.querySelector(".gb-consent")) return;
    const root = rootPrefix();
    const box = document.createElement("section");
    box.className = "gb-consent";
    box.setAttribute("aria-label", "Preferências de privacidade");
    box.innerHTML = `
      <h3>Sua privacidade na Go-burger</h3>
      <p>Usamos armazenamento necessário para login, carrinho e segurança. Você escolhe se permite métricas e recursos de marketing. <a href="${root}legal/privacidade.html" target="_blank" rel="noopener">Saiba mais</a>.</p>
      <div class="gb-consent-actions">
        <button type="button" id="gbConsentNecessary">Somente necessários</button>
        <button type="button" id="gbConsentPreferences">Personalizar</button>
        <button class="primary" type="button" id="gbConsentAll">Aceitar todos</button>
      </div>`;
    document.body.appendChild(box);
    box.querySelector("#gbConsentNecessary")?.addEventListener("click", () => saveConsent({ analytics:false, marketing:false }));
    box.querySelector("#gbConsentAll")?.addEventListener("click", () => saveConsent({ analytics:true, marketing:true }));
    box.querySelector("#gbConsentPreferences")?.addEventListener("click", showConsentPreferences);
  }

  function pwaInstall() {
    if (window.parent !== window) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "gb-install-chip";
    button.innerHTML = "＋ Instalar Go-burger";
    document.body.appendChild(button);

    window.addEventListener("beforeinstallprompt", event => {
      event.preventDefault();
      installPrompt = event;
      button.classList.add("show");
    });
    window.addEventListener("appinstalled", () => {
      installPrompt = null;
      button.classList.remove("show");
    });
    button.addEventListener("click", async () => {
      if (!installPrompt) return;
      await installPrompt.prompt();
      await installPrompt.userChoice.catch(() => null);
      installPrompt = null;
      button.classList.remove("show");
    });
  }

  function pwaUpdates() {
    // O shell burger/go-burger.js é o único responsável pela atualização
    // quando a aplicação está integrada. Registrar e reagir ao Service Worker
    // dentro de cada iframe fazia vários documentos recarregarem em cascata.
    if (window.parent !== window || document.getElementById("gbShell")) return;
    if (!("serviceWorker" in navigator) || !["http:","https:"].includes(location.protocol)) return;

    let refreshing = false;
    let registration = null;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "gb-update-chip";
    button.innerHTML = '<i class="fa-solid fa-cloud-arrow-down" aria-hidden="true"></i> Atualização disponível';
    document.body.appendChild(button);

    const showUpdate = worker => {
      if (!worker) return;
      button.classList.add("show");
      button.onclick = () => {
        button.disabled = true;
        button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Atualizando...';
        worker.postMessage({ type:"SKIP_WAITING" });
      };
    };

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      location.reload();
    });

    navigator.serviceWorker.register(`${rootPrefix()}sw.js`, { updateViaCache:"none" })
      .then(reg => {
        registration = reg;
        if (reg.waiting) showUpdate(reg.waiting);
        reg.addEventListener("updatefound", () => {
          const worker = reg.installing;
          worker?.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) showUpdate(worker);
          });
        });
        setInterval(() => reg.update().catch(() => null), 30 * 60 * 1000);
        reg.sync?.register?.("go-burger-refresh-shell").catch(() => null);
        reg.periodicSync?.register?.("go-burger-refresh-shell", { minInterval: 12 * 60 * 60 * 1000 }).catch(() => null);
      })
      .catch(() => null);

    window.addEventListener("online", () => registration?.update().catch(() => null));
  }

  function errorBoundary() {
    const keep = entry => {
      try {
        const key = "go_burger_local_errors";
        const rows = JSON.parse(localStorage.getItem(key) || "[]");
        rows.unshift({ ...entry, at: new Date().toISOString(), page: location.pathname });
        localStorage.setItem(key, JSON.stringify(rows.slice(0, 20)));
      } catch {}
    };
    window.addEventListener("error", e => keep({ type:"error", message:e.message, source:e.filename, line:e.lineno }));
    window.addEventListener("unhandledrejection", e => keep({ type:"promise", message:String(e.reason?.message || e.reason || "Promise rejeitada") }));
  }

  function observeDynamicSelects() {
    const observer = new MutationObserver(records => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (!(node instanceof Element)) continue;
          if (node.matches?.("select")) enhanceSelect(node);
          enhanceSelects(node);
        }
      }
    });
    observer.observe(document.documentElement, { childList:true, subtree:true });
  }



  /* =======================================================
     GO-BURGER 2026 — MOTION EXPERIENCE / PACOTE 44
  ======================================================= */
  function motionExperience() {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const root = document.documentElement;
    if (reduced) return;
    root.classList.add('gb-motion-js');

    const selector = [
      '.hero','.hero-section','.driver-hero','.partner-cta',
      '.panel','.sa-panel','.sa-metric','.metric-card','.stat-card',
      '.store-card','.product-card','.order-card','.profile-card','.delivery-card',
      '.page-toolbar','.sa-page-intro','.filters-shell','.section-head',
      '.driver-location-card','.driver-section','.card','.glass-card',
      '.driver-auth-card','.driver-form-card','.driver-status-banner','.driver-progress-wrap',
      '.legal-card','.legal-notice','.help-card','.case-card','.case-ticket','.case-summary',
      '.gb-growth-card','.gb-growth-panel','.gb-cashback-card','.gb-referral-card','.gbp2-card','.gbp2-kpi'
    ].join(',');
    const targets = [...document.querySelectorAll(selector)]
      .filter((el, index, arr) => arr.indexOf(el) === index && !el.classList.contains('hidden'))
      .slice(0, 220);

    targets.forEach((el, index) => {
      el.classList.add('gb-reveal');
      el.style.setProperty('--gb-reveal-delay', `${Math.min((index % 8) * 42, 210)}ms`);
    });

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('gb-inview');
          observer.unobserve(entry.target);
        });
      }, { rootMargin:'40px 0px -4% 0px', threshold:.04 });
      targets.forEach(el => observer.observe(el));
    } else {
      targets.forEach(el => el.classList.add('gb-inview'));
    }

    let raf = 0;
    const trackPointer = event => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        root.style.setProperty('--gb-pointer-x', `${event.clientX}px`);
        root.style.setProperty('--gb-pointer-y', `${event.clientY}px`);
        raf = 0;
      });
    };
    if (matchMedia('(pointer:fine)').matches) window.addEventListener('pointermove', trackPointer, { passive:true });

    document.addEventListener('pointerdown', event => {
      const target = event.target.closest?.('button,a,[role="button"]');
      if (!target || target.matches(':disabled')) return;
      target.classList.remove('gb-press');
      void target.offsetWidth;
      target.classList.add('gb-press');
      setTimeout(() => target.classList.remove('gb-press'), 320);
    }, { passive:true });

    document.querySelectorAll('.brand-mark,.gb-mark,.driver-brand>span,.sa-logo-mark,.auth-logo').forEach(el => el.classList.add('gb-brand-pulse'));
    document.querySelectorAll('.btn,.sa-btn,.primary-action,.secondary-action,.driver-btn,.auth-submit,.gb-mode,.circle-btn').forEach(el => {
      const hasFloatingBadge = el.matches('.notification-trigger,.notification-button,.cart-button') || el.querySelector('.badge,.notification-badge');
      if (!hasFloatingBadge) el.classList.add('gb-motion-accent');
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    addSkipLink();
    enhanceSelects();
    observeDynamicSelects();
    buildStandaloneDock();
    wireShellNavigation();
    ensureNavigationHub();
    statusBanner();
    buildConsent();
    pwaInstall();
    pwaUpdates();
    errorBoundary();
    motionExperience();
  });

  window.GoBurgerUI = {
    enhanceSelects,
    rootPrefix,
    appUrl,
    consentValue,
    openConsentPreferences: showConsentPreferences,
    openNavigation: openNavigationHub
  };
})();
