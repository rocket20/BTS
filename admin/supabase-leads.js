/* BTS Studio · solicitudes reales desde Supabase
   La clave aquí es PUBLICABLE; jamás usar service_role/secret.
   Los datos del cliente están protegidos por Supabase Auth + RLS. */
(()=>{
"use strict";
const BASE="https://xwehejgwufwhpkpzjzyt.supabase.co";
const KEY="sb_publishable_0LR-LUDY7NjJaK5K3qtxPg_1aLupDVz";
const STORAGE="bts-admin-sb-session-v1";
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
 css.textContent=".bts-auth-gate{position:fixed;inset:0;z-index:9999;background:#090b11;display:grid;place-items:center;padding:24px;font-family:Inter,system-ui,sans-serif;color:#fff}.bts-auth-gate[hidden]{display:none}.bts-auth-card{width:min(420px,100%);padding:36px;border:1px solid #333641;background:#15161f;border-radius:18px;box-shadow:0 25px 100px #0008}.bts-auth-card h1{font-size:28px;letter-spacing:-1px;margin:0 0 8px}.bts-auth-card p{color:#a2a4b2;line-height:1.55;font-size:13px;margin:0 0 25px}.bts-auth-card label{display:block;font-size:12px;margin:16px 0 7px}.bts-auth-card input{display:block;width:100%;padding:13px 14px;background:#0e1017;border:1px solid #363946;color:#fff;border-radius:9px;font:inherit}.bts-auth-card button{width:100%;margin-top:22px;padding:14px;border:0;border-radius:9px;background:#ff0037;color:white;font-weight:700;cursor:pointer}.bts-auth-card button:disabled{opacity:.65;cursor:wait}.bts-auth-error{min-height:20px;margin-top:14px;color:#ff8ea5;font-size:12px}.bts-auth-card a{color:#afb0bd;font-size:12px;display:inline-block;margin-top:18px}.bts-admin-logout{background:transparent;color:#e1e2e7;border:1px solid #3b3c49;border-radius:8px;padding:9px 11px;font-size:11px;cursor:pointer}";
 document.head.appendChild(css);
 gate=document.createElement("div");
 gate.className="bts-auth-gate";
 gate.id="btsAdminGate";
 gate.innerHTML='<div class="bts-auth-card"><div style="color:#ff0037;font-weight:900;letter-spacing:.12em;margin-bottom:18px">BTS STUDIO / ADMIN</div><h1>Acceso al panel</h1><p>Iniciá sesión con tu usuario administrador de Supabase para gestionar cotizaciones.</p><form id="btsAuthForm"><label for="btsAuthEmail">Correo</label><input id="btsAuthEmail" name="email" type="email" autocomplete="username" required><label for="btsAuthPassword">Contraseña</label><input id="btsAuthPassword" name="password" type="password" autocomplete="current-password" required><button id="btsAuthSubmit" type="submit">Entrar al dashboard</button></form><div id="btsLoginError" class="bts-auth-error" role="status"></div><a href="../index.html">Volver a BTS Studio</a></div>';
 document.body.appendChild(gate);
 gate.querySelector("form").addEventListener("submit",async e=>{
  e.preventDefault();const btn=gate.querySelector("button");btn.disabled=true;btn.textContent="Verificando acceso...";setError("");
  try{await signIn(gate.querySelector("#btsAuthEmail").value.trim(),gate.querySelector("#btsAuthPassword").value);await activate();}
  catch(err){reset();setError(err.message||"No se pudo iniciar sesión");}
  finally{btn.disabled=false;btn.textContent="Entrar al dashboard";gate.querySelector("#btsAuthPassword").value="";}
 });
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
window.BTSLeads={bootstrap,load,save,remove,importRows};
})();