"use strict";
(() => {
  const root = document.documentElement;
  root.classList.add("gb89-ready");

  const interactive = "button, .btn, .sa-btn, .driver-btn, .driver-primary-btn, .primary-action, .secondary-action, .auth-submit, .store-open-btn";
  document.addEventListener("pointerdown", event => {
    const target = event.target.closest?.(interactive);
    if (!target || target.disabled || target.matches("input,select,textarea")) return;
    const rect = target.getBoundingClientRect();
    const ripple = document.createElement("span");
    ripple.className = "gb89-ripple";
    ripple.style.left = `${event.clientX - rect.left}px`;
    ripple.style.top = `${event.clientY - rect.top}px`;
    target.appendChild(ripple);
    window.setTimeout(() => ripple.remove(), 700);
  }, { passive: true });

  const revealSelectors = [
    ".store-card", ".market-store-card", ".restaurant-card", ".section", ".content-section",
    ".card", ".chart-panel", ".entity-card", ".approval-card", ".sa-panel", ".sa-stat-card",
    ".driver-section", ".driver-form-card", ".legal-card", ".help-card", ".quick a", ".history"
  ].join(",");

  const reveal = () => {
    const items = [...document.querySelectorAll(revealSelectors)].filter(el => !el.dataset.gb89Reveal);
    if (!items.length) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
      items.forEach(el => { el.dataset.gb89Reveal = "1"; el.classList.add("gb89-in"); });
      return;
    }
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("gb89-in");
        observer.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -6% 0px", threshold: .04 });
    items.forEach((el, index) => {
      el.dataset.gb89Reveal = "1";
      el.classList.add("gb89-reveal");
      el.style.animationDelay = `${Math.min(index % 6, 5) * 45}ms`;
      observer.observe(el);
    });
  };

  const updateScrolled = () => root.classList.toggle("gb89-scrolled", window.scrollY > 10);
  window.addEventListener("scroll", updateScrolled, { passive: true });
  updateScrolled();

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", reveal, { once: true });
  else reveal();

  const mo = new MutationObserver(() => reveal());
  if (document.body) mo.observe(document.body, { childList: true, subtree: true });
  else document.addEventListener("DOMContentLoaded", () => mo.observe(document.body, { childList: true, subtree: true }), { once: true });
})();
