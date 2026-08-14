"use strict";
(() => {
  try {
    const current = new URL(location.href);
    const mesa = current.searchParams.get("mesa") || "";
    if (!/^[0-9a-f-]{36}$/i.test(mesa)) throw new Error("QR de mesa inválido.");
    const target = new URL("../cliente/cliente.html", location.href);
    target.searchParams.set("mesa", mesa);
    const link = document.getElementById("manualLink");
    if (link) link.href = target.toString();
    setTimeout(() => location.replace(target.toString()), 450);
  } catch (error) {
    document.querySelector("h1").textContent = "QR de mesa inválido";
    document.querySelector("p").textContent = "Peça à hamburgueria um novo QR Code da mesa.";
    document.querySelector(".loader")?.remove();
  }
})();
