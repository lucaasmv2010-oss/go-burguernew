"use strict";

(() => {
  const SUPABASE_URL = "https://ethlgaszdextwckdwgsf.supabase.co";
  const SUPABASE_KEY = "sb_publishable_qEhxWcCbekPjYFUW-EQ1ow_xccHG8aJ";
  const FINANCE_ENABLED = false; // P602: créditos/carteira da plataforma congelados no lançamento.
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = v => String(v ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  const money = v => Number(v || 0).toLocaleString("pt-BR", { style:"currency", currency:"BRL" });
  const num = (v, f = 0) => Number.isFinite(Number(v)) ? Number(v) : f;
  const dt = v => v ? new Date(v).toLocaleString("pt-BR", { dateStyle:"short", timeStyle:"short" }) : "—";

  let db;
  let user;
  let storeId = 0;
  let activeGroupId = null;
  let groupData = null;
  let products = [];
  let currentChatOrder = null;
  let interceptedJoinToken = null;
  let featureState = null;

  // Remove tokens compartilhados da barra de endereço o mais cedo possível.
  try {
    const u = new URL(location.href);
    const token = u.searchParams.get("grupo");
    if (token) {
      interceptedJoinToken = token;
      sessionStorage.setItem("gb_group_join_token", token);
      u.searchParams.delete("grupo");
      history.replaceState(null, "", u.pathname + (u.search ? u.search : "") + (u.hash || ""));
    } else {
      interceptedJoinToken = sessionStorage.getItem("gb_group_join_token");
    }
  } catch {}

  function toast(message, type = "success") {
    if (window.GoBurgerUI?.toast) return window.GoBurgerUI.toast(message, type);
    const wrap = $("#toastContainer") || document.body;
    const n = document.createElement("div"); n.className = `toast ${type}`; n.textContent = message; wrap.appendChild(n); setTimeout(() => n.remove(), 4200);
  }
  function empty(icon,title,text){return `<div class="gbp2-empty"><i class="fa-solid ${icon}"></i><strong>${esc(title)}</strong><p>${esc(text)}</p></div>`;}
  function badge(text,kind="orange"){return `<span class="gbp2-badge ${kind}">${esc(text)}</span>`;}

  async function ready(timeout = 16000) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      const bridge = window.GoBurgerClientBridge;
      const ctx = bridge?.getContext?.();
      if (window.supabase?.createClient && ctx?.storeId) {
        db ||= window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:"go-burger-auth-v1"} });
        const { data } = await db.auth.getSession();
        user = data.session?.user || null;
        storeId = Number(ctx.storeId || 0);
        return true;
      }
      await new Promise(r => setTimeout(r, 250));
    }
    return false;
  }
  async function rpc(name, params={}){const {data,error}=await db.rpc(name,params);if(error)throw error;return data;}
  async function features(){try{if(!featureState)featureState=await rpc("go_burger_features_v32",{p_loja_id:storeId});return featureState||{};}catch{return {}}}
  async function enabled(key){const f=await features();return f?.[key]?.ativo!==false;}

  function groupStorageKey(){return `go_burger_group_active_${storeId}`;}
  function getActiveGroup(){try{return localStorage.getItem(groupStorageKey())||null}catch{return null}}
  function setActiveGroup(id){activeGroupId=id||null;try{id?localStorage.setItem(groupStorageKey(),id):localStorage.removeItem(groupStorageKey())}catch{}}

  async function loadProducts(){const {data,error}=await db.from("produtos").select("id,nome,preco,imagem,estoque,ativo,status").eq("loja_id",storeId).eq("ativo",true).order("nome");if(error)throw error;products=data||[];}

  async function loadBenefits() {
    const root=$("#gbPhase2ClientRoot"); if(!root || !(await ready())) return;
    if(!user){root.innerHTML=empty("fa-lock","Entre para usar os benefícios","Pedidos em grupo e comandas são vinculados à sua conta.");return;}
    root.innerHTML=`<div class="gbp2-skeleton"></div><div class="gbp2-skeleton"></div>`;
    try {
      const [credits, featureMap] = await Promise.all([FINANCE_ENABLED ? rpc("go_burger_creditos_meus_v36") : Promise.resolve({saldo:0,movimentos:[],reservas:[]}), features(), loadProducts()]);
      activeGroupId = getActiveGroup();
      if(activeGroupId){try{groupData=await rpc("go_burger_grupo_detalhe_v35",{p_grupo_id:activeGroupId});}catch{setActiveGroup(null);groupData=null;}}
      renderBenefits(root, credits || {saldo:0,movimentos:[],reservas:[]}, featureMap || {});
    } catch(e){root.innerHTML=empty("fa-triangle-exclamation","Não foi possível carregar os benefícios",e.message||"Tente novamente.");}
  }

  function renderBenefits(root, credits, featureMap = {}) {
    const ctx=window.GoBurgerClientBridge?.getContext?.()||{};
    const groupOn=featureMap?.pedido_grupo_v35?.ativo!==false, creditOn=FINANCE_ENABLED&&featureMap?.creditos_v36?.ativo!==false, tableOn=featureMap?.mesas_comandas_v36?.ativo!==false;
    root.innerHTML=`<section class="gbp2-hero"><span class="gbp2-eyebrow"><i class="fa-solid fa-sparkles"></i> FASE 2 · BENEFÍCIOS</span><h2>Mais formas de pedir na Go-burger.</h2><p>Monte um pedido com amigos e, quando estiver no salão, mantenha os pedidos ligados à sua comanda.</p></section>
      <div class="gbp2-kpis"><div class="gbp2-kpi" hidden aria-hidden="true"><small>Créditos Go-burger</small><strong>${money(credits.saldo)}</strong><span>Separados do cashback da loja</span></div><div class="gbp2-kpi"><small>Pedido em grupo</small><strong>${groupData?.status?esc(String(groupData.status).replaceAll('_',' ')):'Livre'}</strong><span>${groupData?(groupData.participantes||[]).length+' participante(s)':'Crie ou entre por um link'}</span></div><div class="gbp2-kpi"><small>Consumo no local</small><strong>${ctx.tableContext?`Mesa ${esc(ctx.tableContext.mesa_numero||'')}`:'QR Code'}</strong><span>${ctx.tableContext?'Comanda ativa':'Leia o QR disponível na mesa'}</span></div></div>
      <div class="gbp2-grid wide-left">
        <article class="gbp2-card"><div class="gbp2-card-head"><div><span class="gbp2-eyebrow">PEDIDO EM GRUPO</span><h3>${groupData?esc(groupData.nome):'Todo mundo escolhe o seu'}</h3><p>Um organizador compartilha o link e cada pessoa adiciona seus próprios itens.</p></div><i class="fa-solid fa-people-group"></i></div>${groupOn?(groupData?renderGroup(groupData):renderGroupStart()):empty("fa-toggle-off","Pedido em grupo indisponível","Este recurso foi temporariamente desativado para esta hamburgueria.")}</article>
        <div class="gbp2-shell">
          <article class="gbp2-card" hidden aria-hidden="true"><div class="gbp2-card-head"><div><span class="gbp2-eyebrow">CRÉDITOS</span><h3>${money(credits.saldo)} disponíveis</h3><p>Transforme uma parte do saldo em cupom pessoal para esta hamburgueria.</p></div><i class="fa-solid fa-coins"></i></div>${creditOn?`<form class="gbp2-form-grid" id="gb36CreditForm"><label class="gbp2-field span-2"><span>Valor que deseja usar</span><input class="gbp2-input" type="number" min="1" max="500" step="0.01" name="valor" placeholder="10,00" required></label><button class="gbp2-btn primary span-2" type="submit" ${num(credits.saldo)<1?'disabled':''}><i class="fa-solid fa-ticket"></i> Gerar cupom com créditos</button></form>`:empty("fa-toggle-off","Créditos indisponíveis","Este recurso está desativado no momento.")}${(credits.reservas||[]).length&&creditOn?`<div class="gbp2-list" style="margin-top:14px">${credits.reservas.slice(0,3).map(r=>`<div class="gbp2-row"><div class="grow"><strong>${money(r.valor)} · ${esc(r.status)}</strong><small>${esc(r.codigo)} · expira ${dt(r.expira_em)}</small></div>${r.status==='reservada'?`<button class="gbp2-btn tiny soft" data-use-credit="${esc(r.codigo)}">Usar</button>`:''}</div>`).join('')}</div>`:''}</article>
          <article class="gbp2-card"><div class="gbp2-card-head"><div><span class="gbp2-eyebrow">MESA & COMANDA</span><h3>${ctx.tableContext?'Comanda conectada':'Está no salão?'}</h3></div><i class="fa-solid fa-qrcode"></i></div>${!tableOn?empty("fa-toggle-off","Mesa digital indisponível","Este recurso está desativado no momento."):ctx.tableContext?`<div class="gbp2-alert success"><i class="fa-solid fa-circle-check"></i><div><strong>Mesa ${esc(ctx.tableContext.mesa_numero||'')}</strong><br>Ao finalizar o carrinho, o pedido será registrado nesta comanda automaticamente.</div></div>`:`<p style="margin:0;color:var(--gbp2-muted);font-size:.82rem;line-height:1.55">Aponte a câmera para o QR Code da mesa. O link seguro conecta sua conta à comanda correta.</p>`}</article>
        </div>
      </div>`;

    $("#gb36CreditForm",root)?.addEventListener("submit",reserveCredit);
    $$('[data-use-credit]',root).forEach(b=>b.addEventListener('click',()=>window.GoBurgerClientBridge?.applyCouponCode?.(b.dataset.useCredit)));
    bindGroupEvents(root);
  }

  function renderGroupStart(){return `<div class="gbp2-grid"><div><button class="gbp2-btn primary" id="gb35CreateGroup" type="button"><i class="fa-solid fa-plus"></i> Criar pedido em grupo</button></div><form class="gbp2-form-grid" id="gb35JoinForm"><label class="gbp2-field span-2"><span>Recebeu um código/link?</span><input class="gbp2-input" name="token" placeholder="Cole o código do convite" autocomplete="off"></label><button class="gbp2-btn secondary span-2" type="submit">Entrar no grupo</button></form></div>`;}
  function groupItemDetails(item){
    const meta=window.GoBurgerClientBridge?.getProductCustomization?.(item.produto_id)||{groups:[],ingredients:[]};
    const opIds=(item.opcoes||[]).map(Number),remIds=(item.removidos||[]).map(Number);
    const optionNames=meta.groups.flatMap(g=>g.opcoes||[]).filter(o=>opIds.includes(Number(o.id))).map(o=>o.nome);
    const removed=meta.ingredients.filter(i=>remIds.includes(Number(i.id))).map(i=>`Sem ${i.nome}`);
    return [...optionNames,...removed,item.observacao?`Obs.: ${item.observacao}`:null].filter(Boolean).join(' · ');
  }

  function renderGroupCustomization(productId){
    const target=$("#gb35GroupCustomization");
    if(!target)return;
    const meta=window.GoBurgerClientBridge?.getProductCustomization?.(productId)||{groups:[],ingredients:[]};
    if(!(meta.groups?.length||meta.ingredients?.length)){target.innerHTML='<div class="gbp2-alert"><i class="fa-solid fa-circle-info"></i><div>Este produto não possui personalizações adicionais.</div></div>';return;}
    target.innerHTML=`<div class="gbp2-custom-stack">${(meta.groups||[]).map(g=>`<fieldset class="gbp2-choice-group" data-group-id="${g.id}" data-min="${num(g.minimo)}" data-max="${num(g.maximo,1)}"><legend>${esc(g.nome)}${g.obrigatorio?' *':''} <small>Escolha ${num(g.minimo)}–${num(g.maximo,1)}</small></legend>${(g.opcoes||[]).map(o=>`<label class="gbp2-choice"><input type="${num(g.maximo,1)===1?'radio':'checkbox'}" name="gb35_group_${g.id}" value="${o.id}" data-gb35-option><span>${esc(o.nome)}</span><b>${num(o.preco)>0?`+ ${money(o.preco)}`:'Grátis'}</b></label>`).join('')}</fieldset>`).join('')}${meta.ingredients?.length?`<fieldset class="gbp2-choice-group"><legend>Remover ingredientes <small>Opcional</small></legend>${meta.ingredients.map(i=>`<label class="gbp2-choice"><input type="checkbox" value="${i.id}" data-gb35-remove><span>Sem ${esc(i.nome)}</span></label>`).join('')}</fieldset>`:''}</div>`;
  }

  function renderGroup(g){
    const isOwner=String(g.criador_id)===String(user?.id);
    return `<div class="gbp2-alert success"><i class="fa-solid fa-users"></i><div><strong>${(g.participantes||[]).length} participante(s)</strong><br>Status: ${esc(String(g.status).replaceAll('_',' '))} · expira ${dt(g.expira_em)}</div></div><div class="gbp2-list" style="margin-top:14px">${(g.itens||[]).map(i=>{const details=groupItemDetails(i);return `<div class="gbp2-row"><span class="gbp2-row-icon"><i class="fa-solid fa-burger"></i></span><div class="grow"><strong>${esc(i.produto_nome)} × ${num(i.quantidade)}</strong><small>${esc(i.participante||'Participante')} · ${money(num(i.preco)*num(i.quantidade))}${details?`<br>${esc(details)}`:''}</small></div>${String(i.user_id)===String(user?.id)&&g.status==='aberto'?`<button class="gbp2-btn tiny danger" data-group-remove="${i.id}" aria-label="Remover item"><i class="fa-solid fa-trash"></i></button>`:''}</div>`}).join('')||empty('fa-basket-shopping','Grupo sem itens','Cada participante pode adicionar e personalizar os próprios produtos.')}</div>${g.status==='aberto'?`<form class="gbp2-form-grid" id="gb35GroupItemForm" style="margin-top:14px"><label class="gbp2-field span-2"><span>Adicionar produto</span><select class="gbp2-select" name="produto" required><option value="">Escolha...</option>${products.filter(p=>p.ativo!==false&&p.status!=='Indisponível'&&num(p.estoque)>0).map(p=>`<option value="${p.id}">${esc(p.nome)} · ${money(p.preco)}</option>`).join('')}</select></label><div class="span-2" id="gb35GroupCustomization"></div><label class="gbp2-field"><span>Quantidade</span><input class="gbp2-input" name="qtd" type="number" min="1" max="20" value="1"></label><label class="gbp2-field"><span>Observação</span><input class="gbp2-input" name="obs" maxlength="300" placeholder="Ex.: molho à parte"></label><button class="gbp2-btn primary span-2" type="submit"><i class="fa-solid fa-plus"></i> Adicionar ao grupo</button></form>`:''}<div class="gbp2-hero-actions">${isOwner&&g.status==='aberto'?`<button class="gbp2-btn primary" id="gb35ShareGroup"><i class="fa-solid fa-share-nodes"></i> Compartilhar convite</button><button class="gbp2-btn success" id="gb35FinalizeGroup"><i class="fa-solid fa-bag-shopping"></i> Levar tudo ao carrinho</button>`:''}<button class="gbp2-btn secondary" id="gb35LeaveView"><i class="fa-solid fa-xmark"></i> Sair desta tela</button></div>`;
  }

  function bindGroupEvents(root){
    $("#gb35CreateGroup",root)?.addEventListener('click',createGroup);
    $("#gb35JoinForm",root)?.addEventListener('submit',e=>{e.preventDefault();joinGroup(e.currentTarget.token.value.trim())});
    const groupForm=$("#gb35GroupItemForm",root);
    groupForm?.addEventListener('submit',saveGroupItem);
    groupForm?.produto?.addEventListener('change',()=>renderGroupCustomization(Number(groupForm.produto.value)));
    $$('[data-group-remove]',root).forEach(b=>b.addEventListener('click',()=>removeGroupItem(b.dataset.groupRemove)));
    $("#gb35ShareGroup",root)?.addEventListener('click',shareGroup);
    $("#gb35FinalizeGroup",root)?.addEventListener('click',finalizeGroup);
    $("#gb35LeaveView",root)?.addEventListener('click',()=>{setActiveGroup(null);groupData=null;loadBenefits();});
  }

  async function createGroup(){try{const r=await rpc('go_burger_grupo_criar_v35',{p_loja_id:storeId,p_nome:'Pedido em grupo'});setActiveGroup(r.grupo_id);sessionStorage.setItem(`gb_group_token_${r.grupo_id}`,r.token);groupData=await rpc('go_burger_grupo_detalhe_v35',{p_grupo_id:r.grupo_id});toast('Pedido em grupo criado.');loadBenefits();}catch(e){toast(e.message,'error');}}
  async function joinGroup(token){if(!token)return toast('Cole o código do convite.','info');try{const r=await rpc('go_burger_grupo_entrar_v35',{p_token:token});setActiveGroup(r.grupo_id);groupData=await rpc('go_burger_grupo_detalhe_v35',{p_grupo_id:r.grupo_id});sessionStorage.removeItem('gb_group_join_token');toast('Você entrou no pedido em grupo.');window.GoBurgerClientBridge?.navigate?.('beneficios');loadBenefits();}catch(e){toast(e.message,'error');}}
  async function saveGroupItem(e){
    e.preventDefault();
    const f=e.currentTarget, productId=Number(f.produto.value);
    if(!productId)return toast('Escolha um produto.','info');
    const options=[...f.querySelectorAll('[data-gb35-option]:checked')].map(x=>Number(x.value));
    const removed=[...f.querySelectorAll('[data-gb35-remove]:checked')].map(x=>Number(x.value));
    for(const fieldset of f.querySelectorAll('[data-group-id]')){
      const selected=fieldset.querySelectorAll('[data-gb35-option]:checked').length;
      const min=Number(fieldset.dataset.min||0),max=Number(fieldset.dataset.max||1);
      const label=fieldset.querySelector('legend')?.childNodes?.[0]?.textContent?.trim()||'grupo';
      if(selected<min)return toast(`Selecione pelo menos ${min} opção(ões) em ${label}.`,'info');
      if(selected>max)return toast(`Selecione no máximo ${max} opção(ões) em ${label}.`,'info');
    }
    try{
      await rpc('go_burger_grupo_item_salvar_v35',{p_grupo_id:activeGroupId,p_item_id:null,p_produto_id:productId,p_quantidade:Number(f.qtd.value||1),p_opcoes:options,p_removidos:removed,p_observacao:f.obs.value||null});
      groupData=await rpc('go_burger_grupo_detalhe_v35',{p_grupo_id:activeGroupId});
      toast('Item personalizado adicionado ao grupo.');loadBenefits();
    }catch(err){toast(err.message,'error');}
  }
  async function removeGroupItem(id){try{await rpc('go_burger_grupo_item_remover_v35',{p_grupo_id:activeGroupId,p_item_id:id});groupData=await rpc('go_burger_grupo_detalhe_v35',{p_grupo_id:activeGroupId});loadBenefits();}catch(e){toast(e.message,'error');}}
  async function shareGroup(){const token=sessionStorage.getItem(`gb_group_token_${activeGroupId}`);if(!token)return toast('Por segurança, o link original só fica disponível nesta sessão. Crie um novo grupo se precisar gerar outro convite.','info');const u=new URL(location.href);u.searchParams.set('loja_id',storeId);u.searchParams.set('grupo',token);u.hash='beneficios';const text=`Vamos pedir juntos na Go-burger: ${u.toString()}`;try{if(navigator.share)await navigator.share({title:'Pedido em grupo Go-burger',text,url:u.toString()});else await navigator.clipboard.writeText(u.toString());toast('Convite pronto para compartilhar.');}catch{}}
  async function finalizeGroup(){try{const r=await rpc('go_burger_grupo_finalizar_v35',{p_grupo_id:activeGroupId});const added=window.GoBurgerClientBridge?.importGroupItems?.(r.itens_payload||[])||0;if(!added)throw new Error('Nenhum item do grupo está disponível no cardápio agora.');toast(`${added} item(ns) do grupo foram para o carrinho.`);await rpc('go_burger_grupo_marcar_concluido_v35',{p_grupo_id:activeGroupId});setActiveGroup(null);groupData=null;}catch(e){toast(e.message,'error');}}

  async function reserveCredit(e){e.preventDefault();if(!FINANCE_ENABLED)return toast('Créditos Go-burger estão desativados nesta versão de lançamento.','info');const value=num(e.currentTarget.valor.value);try{const r=await rpc('go_burger_credito_cupom_v36',{p_loja_id:storeId,p_valor:value});toast(`Cupom ${r.codigo} gerado.`);await window.GoBurgerClientBridge?.applyCouponCode?.(r.codigo);loadBenefits();}catch(err){toast(err.message,'error');}}

  /* =====================================================
     CHAT DO PEDIDO + AVALIAÇÃO DO ENTREGADOR
     ===================================================== */
  function enhanceOrders(){const orders=window.GoBurgerClientBridge?.getOrders?.()||[];$$('[data-order-details]').forEach(btn=>{const id=Number(btn.dataset.orderDetails);const actions=btn.closest('.order-actions');if(!actions)return;if(!actions.querySelector(`[data-gb35-chat="${id}"]`)){const b=document.createElement('button');b.className='btn secondary small';b.type='button';b.dataset.gb35Chat=String(id);b.innerHTML='<i class="fa-solid fa-comments"></i> Chat';actions.appendChild(b);}const o=orders.find(x=>Number(x.id)===id);if(o?.status==='Concluído'&&!actions.querySelector(`[data-gb34-driver-rate="${id}"]`)){const b=document.createElement('button');b.className='btn secondary small';b.type='button';b.dataset.gb34DriverRate=String(id);b.innerHTML='<i class="fa-solid fa-motorcycle"></i> Entrega';actions.appendChild(b);}});}
  const observer=new MutationObserver(()=>enhanceOrders());

  function ensureClientModal(){let m=$("#gbp2ClientModal");if(m)return m;m=document.createElement('div');m.id='gbp2ClientModal';m.className='gbp2-modal';m.innerHTML='<div class="gbp2-modal-card"><button class="gbp2-modal-close" data-gbp2-client-close type="button"><i class="fa-solid fa-xmark"></i></button><div id="gbp2ClientModalBody"></div></div>';document.body.appendChild(m);m.addEventListener('click',e=>{if(e.target===m||e.target.closest('[data-gbp2-client-close]'))m.classList.remove('active');});return m;}
  async function openChat(orderId){if(!user)return toast('Entre para usar o chat.','info');currentChatOrder=orderId;const m=ensureClientModal();m.classList.add('active');$("#gbp2ClientModalBody",m).innerHTML=`<div class="gbp2-card-head"><div><span class="gbp2-eyebrow">CHAT DO PEDIDO</span><h3>Pedido #${orderId}</h3><p>Fale diretamente com a hamburgueria.</p></div><i class="fa-solid fa-comments"></i></div><div class="gbp2-chat"><div class="gbp2-chat-log" id="gbp2ClientChatLog"><div class="gbp2-skeleton"></div></div><form class="gbp2-chat-compose" id="gbp2ClientChatForm"><textarea class="gbp2-textarea" maxlength="1000" required placeholder="Escreva sua mensagem..."></textarea><button class="gbp2-btn primary"><i class="fa-solid fa-paper-plane"></i> Enviar</button></form></div>`;await refreshChat();$("#gbp2ClientChatForm",m).addEventListener('submit',async e=>{e.preventDefault();const ta=e.currentTarget.querySelector('textarea');try{await rpc('go_burger_chat_enviar_v35',{p_pedido_id:orderId,p_mensagem:ta.value.trim()});ta.value='';await refreshChat();}catch(err){toast(err.message,'error');}});}
  async function refreshChat(){const log=$("#gbp2ClientChatLog");if(!log)return;try{const rows=await rpc('go_burger_chat_listar_v35',{p_pedido_id:currentChatOrder,p_depois_id:0})||[];log.innerHTML=rows.map(x=>`<div class="gbp2-msg ${x.papel==='cliente'?'mine':''}"><strong>${x.papel==='cliente'?'Você':x.papel==='loja'?'Hamburgueria':'Go-burger'}</strong><p>${esc(x.mensagem)}</p><time>${dt(x.criado_em)}</time></div>`).join('')||empty('fa-comment-dots','Sem mensagens','Envie a primeira mensagem deste pedido.');log.scrollTop=log.scrollHeight;}catch(e){log.innerHTML=empty('fa-triangle-exclamation','Chat indisponível',e.message);}}
  function openDriverRating(orderId){const m=ensureClientModal();m.classList.add('active');$("#gbp2ClientModalBody",m).innerHTML=`<div class="gbp2-card-head"><div><span class="gbp2-eyebrow">AVALIE A ENTREGA</span><h3>Como foi o entregador?</h3></div><i class="fa-solid fa-motorcycle"></i></div><form id="gb34DriverRateForm" class="gbp2-form-grid"><label class="gbp2-field span-2"><span>Nota</span><select class="gbp2-select" name="nota"><option value="5">★★★★★ Excelente</option><option value="4">★★★★☆ Muito boa</option><option value="3">★★★☆☆ Boa</option><option value="2">★★☆☆☆ Regular</option><option value="1">★☆☆☆☆ Ruim</option></select></label><label class="gbp2-field span-2"><span>Comentário opcional</span><textarea class="gbp2-textarea" name="comentario" maxlength="800"></textarea></label><button class="gbp2-btn primary span-2">Enviar avaliação</button></form>`;$("#gb34DriverRateForm",m).addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget;try{await rpc('go_burger_avaliar_entregador_v34',{p_pedido_id:orderId,p_nota:Number(f.nota.value),p_comentario:f.comentario.value||null});toast('Avaliação do entregador enviada.');m.classList.remove('active');}catch(err){toast(err.message,'error');}});}

  /* =====================================================
     MESA / QR
     ===================================================== */
  async function connectTableFromUrl(){const u=new URL(location.href);const mesa=u.searchParams.get('mesa');if(!mesa||!user)return;try{const r=await rpc('go_burger_mesa_abrir_v36',{p_public_id:mesa});if(Number(r.loja_id)!==storeId){u.searchParams.set('loja_id',r.loja_id);location.replace(u.toString());return;}window.GoBurgerClientBridge?.setTableContext?.({public_id:mesa,comanda_id:r.comanda_id,mesa_id:r.mesa_id,mesa_numero:r.mesa_numero,mesa_nome:r.mesa_nome});showTableBanner(r);u.searchParams.delete('mesa');history.replaceState(null,'',u.pathname+(u.search?u.search:'')+(u.hash||''));toast(`Comanda da mesa ${r.mesa_numero} conectada.`);}catch(e){toast(e.message||'Não foi possível abrir a mesa.','error');}}
  function showTableBanner(r){let b=$("#gb36TableBanner");if(!b){b=document.createElement('div');b.id='gb36TableBanner';b.style.cssText='position:fixed;left:50%;transform:translateX(-50%);bottom:84px;z-index:3000;max-width:calc(100% - 28px);';document.body.appendChild(b);}b.innerHTML=`<div class="gbp2-alert success" style="box-shadow:0 14px 45px rgba(20,50,35,.18);background:#fff"><i class="fa-solid fa-chair"></i><div><strong>Mesa ${esc(r.mesa_numero||'')}</strong><br>Seus próximos pedidos serão vinculados à comanda.</div><button class="gbp2-btn tiny secondary" data-page="beneficios">Ver</button></div>`;b.querySelector('[data-page]')?.addEventListener('click',()=>window.GoBurgerClientBridge?.navigate?.('beneficios'));}

  async function boot(){if(!(await ready()))return;observer.observe(document.body,{childList:true,subtree:true});enhanceOrders();document.addEventListener('click',e=>{const c=e.target.closest('[data-gb35-chat]');if(c){e.preventDefault();openChat(Number(c.dataset.gb35Chat));return;}const r=e.target.closest('[data-gb34-driver-rate]');if(r){e.preventDefault();openDriverRating(Number(r.dataset.gb34DriverRate));return;}const p=e.target.closest('[data-page="beneficios"]');if(p)setTimeout(loadBenefits,80);});await connectTableFromUrl();if(interceptedJoinToken&&user){const token=interceptedJoinToken;interceptedJoinToken=null;sessionStorage.removeItem('gb_group_join_token');await joinGroup(token);}if(location.hash==='#beneficios')loadBenefits();window.addEventListener('hashchange',()=>{if(location.hash==='#beneficios')loadBenefits();});}

  document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,500));
})();
