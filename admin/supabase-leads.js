/* BTS Studio · solicitudes reales desde Supabase
   La clave aquí es PUBLICABLE; jamás usar service_role/secret.
   Los datos del cliente están protegidos por Supabase Auth + RLS. */
(()=>{
"use strict";
const BASE="https://xwehejgwufwhpkpzjzyt.supabase.co";
const KEY="sb_publishable_0LR-LUDY7NjJaK5K3qtxPg_1aLupDVz";
const STORAGE="bts-admin-sb-session-v1";
const BUSINESS_PREFILL="bts-business-login-prefill-v1";
function isBusinessLogin(value){
 const v=String(value||"").trim().toLowerCase();
 return /^bts-[a-z0-9-]{5,}$/.test(v) || /^[^@\s]+@acceso\.btsstudio\.net$/.test(v);
}
function goToBusinessLogin(value){
 const v=String(value||"").trim().toLowerCase();
 if(isBusinessLogin(v)){
  try{sessionStorage.setItem(BUSINESS_PREFILL,v.endsWith("@acceso.btsstudio.net")?v.slice(0,-"@acceso.btsstudio.net".length):v);}catch(_){}
 }
 location.assign("../negocios/");
}

let session=null;
let onReady=null;
let gate=null;
let timer=null;
function saveSession(){try{if(session)sessionStorage.setItem(STORAGE,JSON.stringify(session));else sessionStorage.removeItem(STORAGE);}catch(_){}}
function setError(message){const el=document.getElementById("btsLoginError");if(el)el.textContent=message||"";}
function lock(){document.body.classList.remove("bts-authenticated");if(gate)gate.hidden=false;}
function unlock(){document.body.classList.add("bts-authenticated");if(gate)gate.hidden=true;}
function reset(){session=null;saveSession();clearInterval(timer);timer=null;lock();}
function interfaceUI(){
 const css=document.createElement("style");
 css.textContent=".bts-auth-gate{position:fixed;inset:0;z-index:9999;background:#090b11;display:grid;place-items:center;padding:24px;font-family:Inter,system-ui,sans-serif;color:#fff}.bts-auth-gate[hidden]{display:none}.bts-auth-card{width:min(420px,100%);padding:36px;border:1px solid #333641;background:#15161f;border-radius:18px;box-shadow:0 25px 100px #0008}.bts-auth-card h1{font-size:28px;letter-spacing:-1px;margin:0 0 8px}.bts-auth-card p{color:#a2a4b2;line-height:1.55;font-size:13px;margin:0 0 25px}.bts-auth-card label{display:block;font-size:12px;margin:16px 0 7px}.bts-auth-card input{display:block;width:100%;padding:13px 14px;background:#0e1017;border:1px solid #363946;color:#fff;border-radius:9px;font:inherit}.bts-auth-card button{width:100%;margin-top:22px;padding:14px;border:0;border-radius:9px;background:#ff0037;color:white;font-weight:700;cursor:pointer}.bts-auth-card button:disabled{opacity:.65;cursor:wait}.bts-auth-error{min-height:20px;margin-top:14px;color:#ff8ea5;font-size:12px}.bts-auth-card a{color:#afb0bd;font-size:12px;display:inline-block;margin-top:18px}.bts-auth-business{margin-top:12px;color:#e8c6d0;font-size:12px;line-height:1.45}.bts-auth-business[hidden]{display:none}.bts-admin-logout{background:transparent;color:#e1e2e7;border:1px solid #3b3c49;border-radius:8px;padding:9px 11px;font-size:11px;cursor:pointer}";
 document.head.appendChild(css);
 gate=document.createElement("div");
 gate.className="bts-auth-gate";
 gate.id="btsAdminGate";
 gate.innerHTML='<div class="bts-auth-card"><div style="color:#ff0037;font-weight:900;letter-spacing:.12em;margin-bottom:18px">BTS STUDIO / ADMINISTRACIÓN</div><h1>Acceso administrativo</h1><p>Ingreso exclusivo de los administradores de BTS Studio. Las empresas utilizan su propio mini panel.</p><form id="btsAuthForm" novalidate><label for="btsAuthEmail">Correo administrativo</label><input id="btsAuthEmail" name="email" type="email" inputmode="email" autocomplete="section-btsadmin username" required><label for="btsAuthPassword">Contraseña</label><input id="btsAuthPassword" name="password" type="password" autocomplete="section-btsadmin current-password" required><button id="btsAuthSubmit" type="submit">Entrar al dashboard BTS</button></form><div id="btsBusinessHint" class="bts-auth-business" hidden>Esta parece una cuenta de empresa. Su acceso es al mini panel, no a la administración de BTS.</div><div id="btsLoginError" class="bts-auth-error" role="status" aria-live="polite"></div><a id="btsBusinessLink" href="../negocios/">Ingresar al mini panel de mi empresa</a><div style="margin-top:6px"><a href="../index.html">Volver a BTS Studio</a></div></div>';
 document.body.appendChild(gate);
 const adminEmail=gate.querySelector("#btsAuthEmail");
 const adminPassword=gate.querySelector("#btsAuthPassword");
 const adminSubmit=gate.querySelector("#btsAuthSubmit");
 const businessHint=gate.querySelector("#btsBusinessHint");
 function updateLoginType(){
  const business=isBusinessLogin(adminEmail.value);
  adminSubmit.textContent=business?"Ir al mini panel empresarial":"Entrar al dashboard BTS";
  businessHint.hidden=!business;
 }
 adminEmail.addEventListener("input",updateLoginType);
 adminEmail.addEventListener("change",updateLoginType);
 gate.querySelector("#btsBusinessLink").addEventListener("click",e=>{
  if(isBusinessLogin(adminEmail.value)){e.preventDefault();goToBusinessLogin(adminEmail.value);}
 });
 gate.querySelector("form").addEventListener("submit",async e=>{
  e.preventDefault();setError("");
  const email=adminEmail.value.trim();
  if(isBusinessLogin(email)){goToBusinessLogin(email);return;}
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
   setError("Ingresá el correo de tu cuenta administradora BTS. Si sos una empresa, usá el enlace al mini panel.");return;
  }
  if(!adminPassword.value){setError("Ingresá tu contraseña administrativa.");return;}
  adminSubmit.disabled=true;adminSubmit.textContent="Verificando acceso...";
  try{await signIn(email,adminPassword.value);await activate();}
  catch(err){reset();setError(err.message||"No se pudo iniciar sesión");}
  finally{adminSubmit.disabled=false;adminPassword.value="";updateLoginType();}
 });
 updateLoginType();
 const logout=document.createElement("button");logout.type="button";logout.className="bts-admin-logout";logout.textContent="Salir";logout.title="Cerrar sesión de Supabase";logout.addEventListener("click",reset);
 document.querySelector(".top-actions")?.appendChild(logout);
}
async function decode(res){
 if(res.status===204)return null;
 const raw=await res.text();let value=null;
 try{value=raw?JSON.parse(raw):null;}catch(_){}
 if(!res.ok){const err=value?.msg||value?.message||value?.error_description||value?.error||("HTTP "+res.status);throw Error(String(err));}
 return value;
}
async function refresh(){
 if(!session)throw Error("Iniciá sesión para continuar");
 if(session.expires_at && Date.now()<Number(session.expires_at)*1000-60000)return;
 if(!session.refresh_token)throw Error("La sesión caducó. Volvé a iniciar sesión");
 const r=await fetch(BASE+"/auth/v1/token?grant_type=refresh_token",{method:"POST",headers:{"apikey":KEY,"Content-Type":"application/json"},body:JSON.stringify({refresh_token:session.refresh_token}),cache:"no-store"});
 const x=await decode(r);
 session={...x,user:x.user||session.user,expires_at:x.expires_at||(Math.floor(Date.now()/1000)+(x.expires_in||3600))};saveSession();
}
async function api(path,method="GET",body){
 await refresh();
 const r=await fetch(BASE+path,{method,headers:{"apikey":KEY,"Authorization":"Bearer "+session.access_token,"Content-Type":"application/json","Accept":"application/json",...(method==="POST"?{"Prefer":"return=minimal"}:{})},body:body===undefined?undefined:JSON.stringify(body),cache:"no-store"});
 return await decode(r);
}
async function signIn(email,password){
 const r=await fetch(BASE+"/auth/v1/token?grant_type=password",{method:"POST",headers:{"apikey":KEY,"Content-Type":"application/json"},body:JSON.stringify({email,password}),cache:"no-store"});
 const x=await decode(r);
 session={...x,expires_at:x.expires_at||(Math.floor(Date.now()/1000)+(x.expires_in||3600))};saveSession();
}
async function verifyAdmin(){
 const uid=session?.user?.id;
 if(!uid)throw Error("No se pudo verificar la identidad");
 const rows=await api("/rest/v1/bts_admins?select=user_id&user_id=eq."+encodeURIComponent(uid));
 if(!Array.isArray(rows)||rows.length===0)throw Error("Este usuario no tiene acceso administrativo. Verificá bts_admins en Supabase.");
}
async function activate(){
 await verifyAdmin();
 if(onReady)await onReady();
 unlock();
 if(timer)clearInterval(timer);
 timer=setInterval(async()=>{
   if(document.hidden||!session)return;
   try{if(onReady)await onReady();}catch(e){console.warn("BTS Studio: no se pudieron actualizar las cotizaciones",e);}
 },60000);
}
async function bootstrap(ready){
 onReady=ready;
 interfaceUI();lock();
 try{
  const saved=sessionStorage.getItem(STORAGE);
  if(saved){session=JSON.parse(saved);await activate();}
 }catch(err){reset();setError("Tu sesión anterior venció. Volvé a ingresar.");}
}
function mapLead(x){
 return {id:x.id,name:x.name,company:x.company||"",service:x.service||"",email:x.email||"",phone:x.phone||"",date:x.event_date||((x.created_at||"").slice(0,10)),status:x.status||"Pendiente",notes:x.notes||"",source:x.source||"",details:x.details||{},created_at:x.created_at||""};
}
async function load(){
 const rows=await api("/rest/v1/bts_leads?select=*&order=created_at.desc&limit=1000");
 return Array.isArray(rows)?rows.map(mapLead):[];
}
async function save(x,id){
 const payload={name:(x.name||"").trim(),company:x.company||"",service:x.service||"",email:x.email||"",phone:x.phone||"",event_date:x.date||null,status:x.status||"Pendiente",notes:x.notes||""};
 if(!payload.name||(!payload.email&&!payload.phone))throw Error("Completá nombre y correo o teléfono.");
 if(id){await api("/rest/v1/bts_leads?id=eq."+encodeURIComponent(id),"PATCH",payload);}
 else{payload.source="manual";payload.details={};await api("/rest/v1/bts_leads","POST",payload);}
}
async function remove(id){await api("/rest/v1/bts_leads?id=eq."+encodeURIComponent(id),"DELETE");}
async function importRows(rows){
 const payload=rows.map(x=>({name:x.name,company:x.company||"",service:x.service||"",email:x.email||"",phone:x.phone||"",event_date:x.date||null,status:x.status||"Pendiente",notes:x.notes||"",source:"manual",details:{}}));
 if(payload.some(x=>!x.name||(!x.email&&!x.phone)))throw Error("Cada fila importada necesita nombre y correo o teléfono.");
 for(let i=0;i<payload.length;i+=100)await api("/rest/v1/bts_leads","POST",payload.slice(i,i+100));
}
async function invokePublisher(payload){
 await refresh();
 const r=await fetch(BASE+"/functions/v1/publicar-bts",{
  method:"POST",
  headers:{"apikey":KEY,"Authorization":"Bearer "+session.access_token,"Content-Type":"application/json"},
  body:JSON.stringify(payload),
  cache:"no-store"
 });
 let data={};
 try{data=await r.json();}catch{}
 if(!r.ok||!data.ok)throw Error(data.error||("Error HTTP "+r.status));
 return data;
}
window.BTSLeads={bootstrap,load,save,remove,importRows,invokePublisher};
})();