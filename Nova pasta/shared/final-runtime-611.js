/* Go Burger Web 2.0 · P611 · Final runtime stability layer */
(() => {
  'use strict';
  const RELEASE = 'P611';
  const root = document.documentElement;
  root.dataset.gbRelease = RELEASE;

  const normalizeStaticDom = () => {
    document.querySelectorAll('a[target="_blank"]').forEach((link) => {
      const rel = new Set(String(link.getAttribute('rel') || '').split(/\s+/).filter(Boolean));
      rel.add('noopener');
      link.setAttribute('rel', [...rel].join(' '));
    });

    document.querySelectorAll('img:not([decoding])').forEach((img) => {
      img.decoding = 'async';
    });

    document.querySelectorAll('[aria-disabled="true"]').forEach((node) => {
      if (node instanceof HTMLButtonElement || node instanceof HTMLInputElement || node instanceof HTMLSelectElement) {
        node.disabled = true;
      }
    });
  };

  const markReady = () => {
    normalizeStaticDom();
    root.classList.add('gb-p611-ready');
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', markReady, { once: true });
  } else {
    markReady();
  }

  window.addEventListener('pageshow', () => root.classList.add('gb-p611-ready'));
})();
