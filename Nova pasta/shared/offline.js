"use strict";
(() => {
  const retry=document.querySelector("#offlineRetry");
  retry?.addEventListener("click",()=>{
    if(navigator.onLine) location.replace("./burger/index.html");
    else location.reload();
  });
  window.addEventListener("online",()=>{if(retry){retry.textContent="Conexão restaurada · voltar";}});
})();
