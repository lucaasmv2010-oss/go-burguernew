"use strict";
(() => {
  const root = document.documentElement;
  root.classList.add("gb108-ready");

  // P103: converte cabeçalhos de tabelas em rótulos para o layout-card mobile.
  const labelTables = scope => {
    (scope || document).querySelectorAll?.("table").forEach(table => {
      const headers = [...table.querySelectorAll("thead th")].map(th => (th.textContent || "").trim());
      if (!headers.length) return;
      table.querySelectorAll("tbody tr").forEach(row => {
        [...row.children].forEach((cell, index) => {
          if (cell.tagName === "TD" && !cell.dataset.label) cell.dataset.label = headers[index] || "Detalhe";
        });
      });
    });
  };

  // P96: classes de estado para campos sem alterar a regra de negócio dos formulários.
  const enhanceFields = scope => {
    (scope || document).querySelectorAll?.("input,select,textarea").forEach(control => {
      if (control.dataset.gb108Field) return;
      control.dataset.gb108Field = "1";
      const parent = control.closest(".field,.studio-field,.store-create-field,.driver-fields,label");
      const sync = () => {
        if (!parent) return;
        const value = control.type === "checkbox" || control.type === "radio" ? control.checked : String(control.value || "").trim().length > 0;
        parent.classList.toggle("gb108-has-value", Boolean(value));
        parent.classList.toggle("gb108-disabled", Boolean(control.disabled));
      };
      control.addEventListener("input", sync, { passive:true });
      control.addEventListener("change", sync, { passive:true });
      sync();
    });
  };

  const run = scope => { labelTables(scope); enhanceFields(scope); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => run(document), { once:true });
  else run(document);

  const observer = new MutationObserver(records => {
    const roots = new Set();
    records.forEach(record => record.addedNodes.forEach(node => { if (node.nodeType === 1) roots.add(node); }));
    roots.forEach(run);
  });
  const start = () => document.body && observer.observe(document.body, { childList:true, subtree:true });
  if (document.body) start(); else document.addEventListener("DOMContentLoaded", start, { once:true });
})();
