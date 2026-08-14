"use strict";
(() => {
  const RELEASE = "600";
  const root = document.documentElement;
  const topLevel = window.top === window;
  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)");
  const prefersReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  const coarsePointer = window.matchMedia?.("(pointer: coarse)");
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const previousFocus = new WeakMap();
  let networkBanner = null;
  let onlineTimer = 0;
  let resizeFrame = 0;

  root.dataset.gbRelease = RELEASE;
  root.classList.add("gb600-runtime");

  function themeName() {
    const explicit = String(root.dataset.theme || "").toLowerCase();
    if (explicit === "dark" || explicit === "light") return explicit;
    return prefersDark?.matches ? "dark" : "light";
  }

  function syncThemeChrome() {
    const dark = themeName() === "dark";
    const color = dark ? "#101216" : "#f4f1eb";
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "theme-color";
      document.head.appendChild(meta);
    }
    meta.content = color;
    let scheme = document.querySelector('meta[name="color-scheme"]');
    if (!scheme) {
      scheme = document.createElement("meta");
      scheme.name = "color-scheme";
      document.head.appendChild(scheme);
    }
    scheme.content = "light dark";
    root.style.setProperty("--gb600-browser-chrome", color);
  }

  function viewportKind(width) {
    if (width <= 480) return "phone";
    if (width <= 900) return "tablet";
    return "desktop";
  }

  function syncViewport() {
    const vv = window.visualViewport;
    const width = Math.max(1, Math.round(vv?.width || window.innerWidth || root.clientWidth || 1));
    const height = Math.max(1, Math.round(vv?.height || window.innerHeight || root.clientHeight || 1));
    const fullHeight = Math.max(1, Math.round(window.innerHeight || root.clientHeight || height));
    const offsetTop = Math.max(0, Math.round(vv?.offsetTop || 0));
    const active = document.activeElement;
    const editableFocused = Boolean(active && (
      active.matches?.("input:not([type='button']):not([type='submit']):not([type='checkbox']):not([type='radio']), textarea, select, [contenteditable='true']")
    ));
    // HOTFIX 601: Safari/iOS pode alterar visualViewport.offsetTop quando as
    // barras do navegador aparecem/desaparecem. Isso não significa teclado aberto.
    // Só escondemos/desativamos o dock se um controle editável estiver focado.
    const keyboardOpen = Boolean(coarsePointer?.matches && editableFocused && (fullHeight - height > 110 || offsetTop > 20));

    root.dataset.gbDevice = viewportKind(width);
    root.dataset.gbKeyboard = keyboardOpen ? "open" : "closed";
    root.style.setProperty("--gb600-vw", `${width}px`);
    root.style.setProperty("--gb600-vh", `${height}px`);
    root.style.setProperty("--gb600-vv-top", `${offsetTop}px`);
    root.style.setProperty("--gb600-vv-bottom", `${Math.max(0, fullHeight - height - offsetTop)}px`);
  }

  function scheduleViewport() {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(syncViewport);
  }

  function ensureNetworkBanner() {
    if (!topLevel) return null;
    if (networkBanner?.isConnected) return networkBanner;
    networkBanner = document.createElement("div");
    networkBanner.className = "gb600-network-status";
    networkBanner.setAttribute("role", "status");
    networkBanner.setAttribute("aria-live", "polite");
    networkBanner.setAttribute("aria-atomic", "true");
    networkBanner.hidden = true;
    document.body.appendChild(networkBanner);
    return networkBanner;
  }

  function networkText(online) {
    return online
      ? '<i class="fa-solid fa-wifi" aria-hidden="true"></i><span>Conexão restabelecida</span>'
      : '<i class="fa-solid fa-cloud-arrow-down" aria-hidden="true"></i><span>Sem internet. A Go-burger mantém o que estiver disponível offline.</span>';
  }

  function syncNetwork({ announce = false } = {}) {
    const online = navigator.onLine !== false;
    root.dataset.gbNetwork = online ? "online" : "offline";
    root.classList.toggle("gb600-offline", !online);
    if (!topLevel) return;
    const banner = ensureNetworkBanner();
    if (!banner) return;
    clearTimeout(onlineTimer);
    if (!online) {
      banner.innerHTML = networkText(false);
      banner.dataset.kind = "offline";
      banner.hidden = false;
      requestAnimationFrame(() => banner.classList.add("show"));
      return;
    }
    if (announce && !banner.hidden) {
      banner.innerHTML = networkText(true);
      banner.dataset.kind = "online";
      banner.hidden = false;
      banner.classList.add("show");
      onlineTimer = window.setTimeout(() => {
        banner.classList.remove("show");
        window.setTimeout(() => { banner.hidden = true; }, 220);
      }, 2400);
    } else if (!announce) {
      banner.classList.remove("show");
      banner.hidden = true;
    }
  }

  function hasAccessibleName(element) {
    return Boolean(
      element.getAttribute("aria-label") ||
      element.getAttribute("aria-labelledby") ||
      element.getAttribute("title") ||
      String(element.textContent || "").trim()
    );
  }

  function inferredButtonLabel(button) {
    const map = {
      cliente: "Abrir área do cliente",
      admin: "Abrir painel da hamburgueria",
      superadmin: "Abrir Super Admin",
      entregador: "Abrir painel do entregador",
      explorar: "Explorar hamburguerias",
      pedidos: "Abrir meus pedidos",
      perfil: "Abrir minha conta"
    };
    const key = button.dataset.mode || button.dataset.route || button.dataset.shellRoute || "";
    return map[String(key).toLowerCase()] || button.getAttribute("title") || "";
  }

  function elementsWithin(scope, selector) {
    const found = [...(scope.querySelectorAll?.(selector) || [])];
    if (scope instanceof Element && scope.matches(selector)) found.unshift(scope);
    return found;
  }

  function enhanceControls(scope = document) {
    elementsWithin(scope, "button,[role='button']").forEach(button => {
      if (button.dataset.gb600Control === "1") return;
      button.dataset.gb600Control = "1";
      const inferred = inferredButtonLabel(button);
      if (!hasAccessibleName(button) && inferred) button.setAttribute("aria-label", inferred);
      if (button.classList.contains("gb-mode") && !button.hasAttribute("aria-label")) {
        const visible = String(button.textContent || "").trim().replace(/\s+/g, " ");
        if (visible) button.setAttribute("aria-label", visible);
      }
    });

    elementsWithin(scope, "a[target='_blank']").forEach(link => {
      const rel = new Set(String(link.rel || "").split(/\s+/).filter(Boolean));
      rel.add("noopener");
      rel.add("noreferrer");
      link.rel = [...rel].join(" ");
    });

    elementsWithin(scope, "input,select,textarea").forEach(control => {
      if (control.dataset.gb600Input === "1") return;
      control.dataset.gb600Input = "1";
      if (!control.hasAttribute("aria-describedby")) {
        const helper = control.closest("label,.field,.studio-field,.store-create-field,.driver-field")?.querySelector?.("small,.helper,.field-help");
        if (helper) {
          if (!helper.id) helper.id = `gb600_help_${globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)}`;
          control.setAttribute("aria-describedby", helper.id);
        }
      }
    });
  }

  function modalIsOpen(modal) {
    if (modal.hidden || modal.classList.contains("hidden")) return false;
    if (modal.matches("dialog")) return modal.open;
    const ariaHidden = modal.getAttribute("aria-hidden");
    if (ariaHidden === "true") return false;
    const style = getComputedStyle(modal);
    return style.display !== "none" && style.visibility !== "hidden";
  }

  function normalizeDialog(modal) {
    if (!(modal instanceof HTMLElement)) return;
    if (!modal.hasAttribute("role") && !modal.matches("dialog")) modal.setAttribute("role", "dialog");
    if (!modal.hasAttribute("aria-modal")) modal.setAttribute("aria-modal", "true");
  }

  function syncDialogs() {
    const selectors = ".modal,.sa-modal,.gb-choice-overlay,.gb-navigation-overlay,.store-create-overlay,.driver-modal,[role='dialog'],dialog";
    document.querySelectorAll(selectors).forEach(modal => {
      const open = modalIsOpen(modal);
      const wasOpen = modal.dataset.gb600Open === "1";
      if (open && !wasOpen) {
        normalizeDialog(modal);
        if (document.activeElement instanceof HTMLElement && !modal.contains(document.activeElement)) previousFocus.set(modal, document.activeElement);
        modal.dataset.gb600Open = "1";
      } else if (!open && wasOpen) {
        modal.dataset.gb600Open = "0";
        const trigger = previousFocus.get(modal);
        if (trigger?.isConnected) requestAnimationFrame(() => trigger.focus({ preventScroll:true }));
      }
    });
  }

  function syncActiveNavigation(scope = document) {
    scope.querySelectorAll?.("button.active,[role='tab'].active").forEach(button => {
      if (!button.hasAttribute("aria-pressed") && !button.hasAttribute("aria-selected")) button.setAttribute("aria-pressed", "true");
    });
    scope.querySelectorAll?.("button[data-gb600-control='1']:not(.active)[aria-pressed='true']").forEach(button => button.setAttribute("aria-pressed", "false"));
    scope.querySelectorAll?.("a.active").forEach(link => link.setAttribute("aria-current", "page"));
    scope.querySelectorAll?.("a:not(.active)[aria-current='page']").forEach(link => link.removeAttribute("aria-current"));
  }

  function enhanceMedia(scope = document) {
    const images = elementsWithin(scope, "img");
    images.forEach((image, index) => {
      if (!image.hasAttribute("decoding")) image.decoding = "async";
      if (!image.hasAttribute("loading") && index > 1 && !image.closest(".hero,.hero-art,.market-topbar,.driver-hero")) image.loading = "lazy";
      if (!image.hasAttribute("fetchpriority") && image.loading === "lazy") image.setAttribute("fetchpriority", "low");
    });
  }

  function syncDataSaver() {
    const enabled = Boolean(connection?.saveData) || ["slow-2g", "2g"].includes(String(connection?.effectiveType || ""));
    root.classList.toggle("gb600-save-data", enabled);
    root.dataset.gbConnection = String(connection?.effectiveType || "unknown");
  }

  function keyboardSearchShortcut(event) {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || target?.isContentEditable) return;
    if (event.key !== "/") return;
    const search = document.querySelector("input[type='search'],#marketSearch,#searchInput,.top-search input,.search-box input");
    if (!(search instanceof HTMLElement)) return;
    event.preventDefault();
    search.focus({ preventScroll:false });
  }

  function clearTransientBusyState() {
    document.querySelectorAll("form[aria-busy='true']").forEach(form => form.removeAttribute("aria-busy"));
    document.querySelectorAll("button[aria-busy='true']:not(:disabled)").forEach(button => button.removeAttribute("aria-busy"));
  }

  function enhance(scope = document) {
    enhanceControls(scope);
    enhanceMedia(scope);
    syncActiveNavigation(scope);
    syncDialogs();
  }

  function watchDom() {
    const observer = new MutationObserver(records => {
      const roots = new Set();
      let dialogChange = false;
      let navChange = false;
      for (const record of records) {
        if (record.type === "childList") {
          record.addedNodes.forEach(node => { if (node.nodeType === 1) roots.add(node); });
          dialogChange = true;
        }
        if (record.type === "attributes") {
          if (["class", "hidden", "open", "aria-hidden"].includes(record.attributeName)) dialogChange = true;
          if (record.attributeName === "class") navChange = true;
        }
      }
      roots.forEach(enhance);
      if (dialogChange) syncDialogs();
      if (navChange) syncActiveNavigation(document);
    });
    observer.observe(document.documentElement, {
      subtree:true,
      childList:true,
      attributes:true,
      attributeFilter:["class", "hidden", "open", "aria-hidden"]
    });
  }

  function boot() {
    syncThemeChrome();
    syncViewport();
    syncNetwork();
    syncDataSaver();
    enhance(document);
    watchDom();

    window.addEventListener("resize", scheduleViewport, { passive:true });
    window.visualViewport?.addEventListener("resize", scheduleViewport, { passive:true });
    window.visualViewport?.addEventListener("scroll", scheduleViewport, { passive:true });
    window.addEventListener("orientationchange", scheduleViewport, { passive:true });
    window.addEventListener("online", () => syncNetwork({ announce:true }));
    window.addEventListener("offline", () => syncNetwork({ announce:true }));
    window.addEventListener("pageshow", event => { if (event.persisted) clearTransientBusyState(); scheduleViewport(); });
    document.addEventListener("keydown", keyboardSearchShortcut);

    const themeObserver = new MutationObserver(syncThemeChrome);
    themeObserver.observe(root, { attributes:true, attributeFilter:["data-theme", "class"] });
    prefersDark?.addEventListener?.("change", syncThemeChrome);
    connection?.addEventListener?.("change", syncDataSaver);

    if (topLevel && "serviceWorker" in navigator && ["http:", "https:"].includes(location.protocol)) {
      window.addEventListener("load", () => {
        navigator.serviceWorker.getRegistration().then(reg => reg?.update?.()).catch(() => {});
      }, { once:true });
    }

    requestAnimationFrame(() => {
      root.classList.add("gb600-ready");
      root.classList.toggle("gb600-reduced-motion", Boolean(prefersReduced?.matches));
      window.dispatchEvent(new CustomEvent("gb600:ready", { detail:{ release:RELEASE } }));
    });
  }

  window.GoBurger600 = Object.freeze({
    release: RELEASE,
    syncThemeChrome,
    syncViewport,
    syncNetwork,
    enhance
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once:true });
  else boot();
})();
