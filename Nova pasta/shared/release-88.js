(() => {
  "use strict";

  const RELEASE = "88";
  const ROOT = document.documentElement;
  const ALLOWED_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);
  const SENSITIVE_KEYS = /(?:token|secret|password|senha|authorization|cookie|session|cpf|documento)/i;
  const EMAIL = /[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi;
  const JWT = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;
  const pendingForms = new WeakMap();
  let observer;

  ROOT.dataset.gbRelease = RELEASE;
  ROOT.classList.add("gb88-booting");

  function rootUrl() {
    try {
      const script = document.currentScript?.src;
      if (script) return new URL("../", script);
    } catch {}
    return new URL("./", location.href);
  }

  const APP_ROOT = rootUrl();

  function redact(value, depth = 0) {
    if (depth > 4) return "[limite]";
    if (typeof value === "string") {
      return value
        .replace(JWT, "[credencial]")
        .replace(EMAIL, "[email]")
        .replace(/\b\d{11,14}\b/g, "[documento]")
        .slice(0, 800);
    }
    if (Array.isArray(value)) return value.slice(0, 30).map(item => redact(item, depth + 1));
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.entries(value).slice(0, 40).map(([key, item]) => [
        key,
        SENSITIVE_KEYS.test(key) ? "[protegido]" : redact(item, depth + 1)
      ]));
    }
    return value;
  }

  function randomId(prefix = "gb") {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    const value = Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
    return `${prefix}_${value}`;
  }

  function safeUrl(input, base = location.href) {
    try {
      const url = new URL(input, base);
      if (url.origin === location.origin || ALLOWED_PROTOCOLS.has(url.protocol)) return url;
    } catch {}
    return null;
  }

  function appUrl(path = "") {
    return new URL(String(path).replace(/^\//, ""), APP_ROOT).href;
  }

  function sameAppNetworkTarget(input) {
    const url = safeUrl(input);
    if (!url) return false;
    return url.origin === location.origin || url.hostname === "ethlgaszdextwckdwgsf.supabase.co";
  }

  async function safeFetch(input, init = {}) {
    const raw = input instanceof Request ? input.url : String(input);
    if (!sameAppNetworkTarget(raw)) throw new TypeError("Destino de rede não permitido.");
    const controller = new AbortController();
    const timeout = Math.min(Math.max(Number(init.timeout || 12000), 1000), 30000);
    const timer = setTimeout(() => controller.abort(new DOMException("Tempo limite excedido", "TimeoutError")), timeout);
    const externalSignal = init.signal;
    const abort = () => controller.abort(externalSignal?.reason);
    externalSignal?.addEventListener("abort", abort, { once: true });
    try {
      return await fetch(input, {
        ...init,
        timeout: undefined,
        signal: controller.signal,
        credentials: init.credentials || "same-origin",
        referrerPolicy: init.referrerPolicy || "strict-origin-when-cross-origin"
      });
    } finally {
      clearTimeout(timer);
      externalSignal?.removeEventListener("abort", abort);
    }
  }

  function validateFile(file, options = {}) {
    const allowed = new Set(options.types || ["image/jpeg", "image/png", "image/webp", "application/pdf"]);
    const maxBytes = Math.min(Number(options.maxBytes || 5 * 1024 * 1024), 10 * 1024 * 1024);
    if (!(file instanceof File)) return { ok:false, error:"Arquivo inválido." };
    if (!allowed.has(file.type)) return { ok:false, error:"Formato de arquivo não permitido." };
    if (file.size <= 0 || file.size > maxBytes) return { ok:false, error:`O arquivo deve ter até ${Math.round(maxBytes / 1048576)} MB.` };
    if (/[\\/\0]/.test(file.name)) return { ok:false, error:"Nome de arquivo inválido." };
    return { ok:true, file };
  }

  function isVisible(element) {
    if (!(element instanceof HTMLElement)) return false;
    if (element.hidden || element.closest("[hidden],.hidden,[aria-hidden='true']")) return false;
    const style = getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden";
  }

  function focusables(container) {
    return [...container.querySelectorAll("a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex='-1'])")]
      .filter(isVisible);
  }

  function activeDialog() {
    const dialogs = [...document.querySelectorAll("[role='dialog'],dialog,.modal,.sa-modal,.gb-choice-overlay,.gb-navigation-overlay")];
    return dialogs.reverse().find(isVisible) || null;
  }

  function trapDialogFocus(event) {
    if (event.key !== "Tab") return;
    const dialog = activeDialog();
    if (!dialog) return;
    const items = focusables(dialog);
    if (!items.length) return;
    const first = items[0];
    const last = items.at(-1);
    if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function normalizeLinks(scope = document) {
    scope.querySelectorAll?.("a[href]").forEach(link => {
      const url = safeUrl(link.getAttribute("href"));
      if (!url) {
        link.removeAttribute("href");
        link.setAttribute("aria-disabled", "true");
        return;
      }
      if (url.origin !== location.origin && ["http:", "https:"].includes(url.protocol)) {
        link.rel = "noopener noreferrer";
        if (link.target === "_blank") link.referrerPolicy = "strict-origin-when-cross-origin";
      }
    });
  }

  function normalizeMedia(scope = document) {
    scope.querySelectorAll?.("img").forEach(image => {
      if (!image.hasAttribute("decoding")) image.decoding = "async";
      if (!image.hasAttribute("loading") && !image.closest(".hero,.auth-showcase,.market-topbar,.topbar")) image.loading = "lazy";
      if (!image.hasAttribute("alt")) image.alt = "";
    });
  }

  function normalizeBadges(scope = document) {
    scope.querySelectorAll?.(".badge,.notification-badge,.cart-button b,.notification-button b").forEach(badge => {
      const raw = String(badge.textContent || "").trim();
      const count = Number.parseInt(raw, 10);
      if (Number.isFinite(count)) {
        const display = count > 99 ? "99+" : String(Math.max(0, count));
        if (badge.textContent !== display) badge.textContent = display;
        badge.classList.toggle("zero", count <= 0);
        badge.setAttribute("aria-label", count === 1 ? "1 notificação" : `${Math.max(0, count)} notificações`);
      }
    });
  }

  function wrapTables(scope = document) {
    scope.querySelectorAll?.("table").forEach(table => {
      if (table.parentElement?.classList.contains("gb88-table-scroll")) return;
      const wrapper = document.createElement("div");
      wrapper.className = "gb88-table-scroll";
      wrapper.setAttribute("role", "region");
      wrapper.setAttribute("aria-label", table.getAttribute("aria-label") || "Tabela com rolagem horizontal");
      wrapper.tabIndex = 0;
      table.parentNode?.insertBefore(wrapper, table);
      wrapper.appendChild(table);
    });
  }

  function passwordScore(value) {
    const password = String(value || "");
    if (!password) return 0;
    let score = 0;
    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
    if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score += 1;
    return Math.min(score, 4);
  }

  function enhancePasswords(scope = document) {
    scope.querySelectorAll?.("input[type='password'][autocomplete='new-password']").forEach(input => {
      if (input.dataset.gb88Password === "1") return;
      input.dataset.gb88Password = "1";
      input.minLength = Math.max(input.minLength || 0, 8);
      const meter = document.createElement("span");
      meter.className = "gb88-password-meter";
      meter.dataset.score = "0";
      meter.setAttribute("aria-hidden", "true");
      meter.innerHTML = "<i></i><i></i><i></i><i></i>";
      input.insertAdjacentElement("afterend", meter);
      input.addEventListener("input", () => { meter.dataset.score = String(passwordScore(input.value)); });
    });
  }

  function clearFieldError(input) {
    input.classList.remove("gb88-field-error");
    input.removeAttribute("aria-invalid");
    const id = input.getAttribute("aria-errormessage");
    if (id) document.getElementById(id)?.remove();
    input.removeAttribute("aria-errormessage");
  }

  function showFieldError(input) {
    if (!(input instanceof HTMLElement) || input.validity?.valid !== false) return;
    clearFieldError(input);
    const message = document.createElement("small");
    message.id = randomId("field_error");
    message.className = "gb88-field-message";
    message.textContent = input.validationMessage || "Revise este campo.";
    input.classList.add("gb88-field-error");
    input.setAttribute("aria-invalid", "true");
    input.setAttribute("aria-errormessage", message.id);
    input.insertAdjacentElement("afterend", message);
  }

  function enhanceForms(scope = document) {
    scope.querySelectorAll?.("form").forEach(form => {
      if (form.dataset.gb88Form === "1") return;
      form.dataset.gb88Form = "1";
      form.addEventListener("invalid", event => showFieldError(event.target), true);
      form.addEventListener("input", event => {
        if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) clearFieldError(event.target);
      });
      form.addEventListener("submit", event => {
        const previous = pendingForms.get(form);
        if (previous) clearTimeout(previous);
        form.setAttribute("aria-busy", "true");
        const submitter = event.submitter;
        let stateObserver = null;
        let timer = 0;
        const done = () => {
          clearTimeout(timer);
          form.removeAttribute("aria-busy");
          stateObserver?.disconnect();
          pendingForms.delete(form);
        };
        if (submitter instanceof HTMLButtonElement || submitter instanceof HTMLInputElement) {
          stateObserver = new MutationObserver(() => { if (!submitter.disabled) done(); });
          stateObserver.observe(submitter, { attributes:true, attributeFilter:["disabled"] });
        }
        timer = setTimeout(done, 20000);
        pendingForms.set(form, timer);
      });
    });
  }

  function enhanceScope(scope = document) {
    normalizeLinks(scope);
    normalizeMedia(scope);
    normalizeBadges(scope);
    wrapTables(scope);
    enhancePasswords(scope);
    enhanceForms(scope);
  }

  function watchDom() {
    observer = new MutationObserver(records => {
      const roots = new Set();
      for (const record of records) {
        if (record.type === "characterData") {
          const badge = record.target.parentElement?.closest?.(".badge,.notification-badge,.cart-button b,.notification-button b");
          if (badge) normalizeBadges(badge.parentElement || document);
          continue;
        }
        record.addedNodes.forEach(node => { if (node instanceof Element) roots.add(node); });
      }
      roots.forEach(enhanceScope);
    });
    observer.observe(document.body, { childList:true, subtree:true, characterData:true });
  }

  function viewportState() {
    const update = () => {
      ROOT.dataset.gbViewport = innerWidth < 560 ? "compact" : innerWidth < 960 ? "medium" : "wide";
      ROOT.style.setProperty("--gb88-vh", `${innerHeight * .01}px`);
    };
    update();
    let frame = 0;
    addEventListener("resize", () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    }, { passive:true });
    window.visualViewport?.addEventListener("resize", update, { passive:true });
  }

  function connectionState() {
    const update = () => {
      ROOT.dataset.gbNetwork = navigator.onLine ? "online" : "offline";
      document.body.classList.toggle("gb88-offline", !navigator.onLine);
    };
    update();
    addEventListener("online", update);
    addEventListener("offline", update);
  }

  function securityTelemetry() {
    addEventListener("securitypolicyviolation", event => {
      const detail = {
        directive: String(event.effectiveDirective || "").slice(0, 80),
        source: (() => {
          try { return new URL(event.blockedURI).origin; } catch { return "inline"; }
        })()
      };
      dispatchEvent(new CustomEvent("gb88:security-policy", { detail }));
    });
  }

  function performanceTelemetry() {
    if (!("PerformanceObserver" in window)) return;
    const emit = (name, value) => dispatchEvent(new CustomEvent("gb88:web-vital", { detail:{ name, value:Math.round(value) } }));
    try {
      const paint = new PerformanceObserver(list => list.getEntries().forEach(entry => {
        if (entry.name === "first-contentful-paint") emit("FCP", entry.startTime);
      }));
      paint.observe({ type:"paint", buffered:true });
      const largest = new PerformanceObserver(list => {
        const entry = list.getEntries().at(-1);
        if (entry) emit("LCP", entry.startTime);
      });
      largest.observe({ type:"largest-contentful-paint", buffered:true });
    } catch {}
  }

  function boot() {
    enhanceScope(document);
    watchDom();
    viewportState();
    connectionState();
    securityTelemetry();
    performanceTelemetry();
    document.addEventListener("keydown", trapDialogFocus);
    requestAnimationFrame(() => {
      ROOT.classList.remove("gb88-booting");
      ROOT.classList.add("gb88-ready");
      dispatchEvent(new CustomEvent("gb88:ready", { detail:{ release:RELEASE } }));
    });
  }

  window.GoBurger88 = Object.freeze({
    release: RELEASE,
    appUrl,
    safeUrl,
    safeFetch,
    redact,
    randomId,
    createIdempotencyKey: () => randomId("idem"),
    validateFile,
    enhance: enhanceScope
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once:true });
  else boot();
})();
