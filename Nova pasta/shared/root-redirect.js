"use strict";
(() => {
  const destination = new URL("../burger/index.html", document.currentScript?.src || location.href);
  destination.search = location.search;
  destination.hash = location.hash;
  location.replace(destination.href);
})();
