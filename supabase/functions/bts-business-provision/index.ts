// BTS Studio — creación de mini paneles y cuentas empresariales.
// El secreto de Supabase nunca sale de esta función.
const URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ALLOWED = new Set(["https://www.btsstudio.net","https://btsstudio.net","https://rocket20.github.io"]);
const DOMAIN = "acceso.btsstudio.net";
const RESERVED = new Set(["admin","assets","nfc","api","dashboard","inicio","index","contacto","servicios","paquetes","proyectos","robots","sitemap","favicon","404","login","auth","panel","bts"]);
const allowedRole = new Set(["owner","admin"]);
type Obj = Record<string,unknown>;
function json(value:unknown,status=200,origin=""){return new Response(JSON.stringify(value),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store","Access-Control-Allow-Origin":origin||"https://www.btsstudio.net","Vary":"Origin","Access-Control-Allow-Headers":"authorization, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"}});}
function randomHex(bytes:number){const b=crypto.getRandomValues(new Uint8Array(bytes));return Array.from(b,x=>x.toString(16).padStart(2,"0")).join("");}
function makePassword(){const alphabet="ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!#$%&*-_";const b=crypto.getRandomValues(new Uint8Array(26));return Array.from(b,x=>alphabet[x%alphabet.length]).join("");}
function errMessage(x:unknown){return x instanceof Error?x.message:String(x);}
async function doRequest(path:string,{method="GET",body,auth=SERVICE,prefer="return=representation"}:{method?:string,body?:unknown,auth?:string,prefer?:string}={}):Promise<any>{
 const headers:Record<string,string>={"apikey":SERVICE,"Authorization":"Bearer "+auth,"Accept":"application/json"};
 if(body!==undefined){headers["Content-Type"]="application/json";headers["Prefer"]=prefer;}
 const r=await fetch(URL+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),cache:"no-store"});
 const raw=await r.text();let data:any;try{data=raw?JSON.parse(raw):null}catch{data={message:raw.slice(0,150)}}
 if(!r.ok)throw new Error(String(data?.msg||data?.message||data?.error_description||data?.error||"Error "+r.status));
 return data;
}
function validSlug(slug:string){return slug.length>=3&&slug.length<=48&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)&&!RESERVED.has(slug);}
function panelUrl(slug:string){return "https://www.btsstudio.net/negocios/?empresa="+encodeURIComponent(slug);}
Deno.serve(async(req:Request)=>{
 const requestOrigin=req.headers.get("origin")||"";
 const origin=ALLOWED.has(requestOrigin)?requestOrigin:"https://www.btsstudio.net";
 if(req.method==="OPTIONS")return ALLOWED.has(requestOrigin)?new Response(null,{status:204,headers:{"Access-Control-Allow-Origin":origin,"Vary":"Origin","Access-Control-Allow-Headers":"authorization, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"}}):new Response(null,{status:403});
 if(req.method!=="POST")return json({error:"Método no permitido"},405,origin);
 if(requestOrigin&&!ALLOWED.has(requestOrigin))return json({error:"Origen no permitido"},403,origin);
 if(!URL||!SERVICE)return json({error:"Configuración interna pendiente"},503,origin);
 const bearer=req.headers.get("authorization")||"";
 if(!bearer.startsWith("Bearer "))return json({error:"Iniciá sesión en BTS Studio"},401,origin);
 let user:any;
 try{
   const r=await fetch(URL+"/auth/v1/user",{headers:{"apikey":SERVICE,"Authorization":bearer},cache:"no-store"});
   if(!r.ok)throw new Error("Sesión no válida");user=await r.json();
   if(!user?.id)throw new Error("Identidad no válida");
   const admins=await doRequest("/rest/v1/bts_admins?user_id=eq."+encodeURIComponent(user.id)+"&select=user_id,role&limit=1");
   if(!Array.isArray(admins)||admins.length!==1||!allowedRole.has(admins[0].role))return json({error:"Solo BTS propietario o administrador puede crear accesos"},403,origin);
 }catch{return json({error:"No se pudo verificar tu sesión administrativa"},401,origin);}
 let body:Obj;
 try{body=await req.json();if(!body||typeof body!=="object"||Array.isArray(body))throw Error("JSON inválido");}
 catch{return json({error:"Datos de solicitud inválidos"},400,origin);}
 const action=String(body.action||"");
 try{
  if(action==="reset_password"){
   const uid=String(body.user_id||"");
   if(!/^[a-f0-9-]{36}$/i.test(uid))return json({error:"Usuario inválido"},400,origin);
   const [membership,adminTarget]=await Promise.all([
     doRequest("/rest/v1/bts_business_users?user_id=eq."+encodeURIComponent(uid)+"&select=user_id&limit=1"),
     doRequest("/rest/v1/bts_admins?user_id=eq."+encodeURIComponent(uid)+"&select=user_id&limit=1")
   ]);
   if(!membership.length||adminTarget.length)return json({error:"Solo se pueden restablecer contraseñas empresariales"},403,origin);
   const password=makePassword();
   await doRequest("/auth/v1/admin/users/"+encodeURIComponent(uid),{method:"PUT",body:{password}});
   return json({ok:true,password,message:"Contraseña nueva creada. Compartila mediante un canal seguro y solicitá cambiarla después."},200,origin);
  }
  if(action!=="create_company"&&action!=="create_access")return json({error:"Acción no reconocida"},400,origin);
  let businessId="",slug="",companyCreated=false,programCreatedId="",newAuthId="";
  const name=String(body.business_name||"").trim();
  try{
   if(action==="create_company"){
    slug=String(body.slug||"").trim().toLowerCase();
    if(!validSlug(slug))return json({error:"El enlace debe tener un identificador válido de 3–48 caracteres, sin espacios."},400,origin);
    if(name.length<2||name.length>90)return json({error:"Ingresá el nombre del negocio (2–90 caracteres)"},400,origin);
    const created=await doRequest("/rest/v1/bts_nfc_cards",{method:"POST",body:{slug,business_name:name,is_active:true,nfc_category:"normal",links:[]}});
    businessId=created?.[0]?.id||"";if(!businessId)throw Error("No se pudo crear la empresa");
    companyCreated=true;
   }else{
    businessId=String(body.business_id||"");
    if(!/^[a-f0-9-]{36}$/i.test(businessId))return json({error:"Seleccioná un negocio existente"},400,origin);
    const found=await doRequest("/rest/v1/bts_nfc_cards?id=eq."+encodeURIComponent(businessId)+"&select=id,slug,business_name,is_active&limit=1");
    if(!found?.[0]?.is_active)return json({error:"Empresa no encontrada o suspendida"},404,origin);
    slug=found[0].slug;
   }
   // Cada panel obtiene un usuario propio, no una cuenta de la plataforma Supabase.
   const username=("bts-"+slug.slice(0,16)+"-"+randomHex(3)).toLowerCase();
   const email=username+"@"+DOMAIN;
   const password=makePassword();
   const createdUser=await doRequest("/auth/v1/admin/users",{method:"POST",body:{email,password,email_confirm:true,app_metadata:{account_type:"bts_business"}}});
   newAuthId=createdUser?.id||createdUser?.user?.id||"";
   if(!newAuthId)throw Error("No se recibió confirmación de la cuenta creada");
   await doRequest("/rest/v1/bts_business_users",{method:"POST",body:{business_id:businessId,user_id:newAuthId,role:"owner",is_active:true,display_email:email}});
   if(action==="create_company"){
    // Programa inicial de seis compras, editable desde BTS.
    const program=await doRequest("/rest/v1/bts_reward_programs",{method:"POST",body:{business_id:businessId,kind:"loyalty",title:"Fidelización · "+name.slice(0,50),goal_units:6,unit_name:"compras",reward_label:"Regalo",units_per_visit:1,is_active:true}});
    programCreatedId=program?.[0]?.id||"";
   }
   return json({ok:true,business_id:businessId,slug,panel_url:panelUrl(slug),username,password,program_created:!!programCreatedId},200,origin);
  }catch(error){
   // Evitar cuentas huérfanas durante errores parciales en el alta.
   if(newAuthId){try{await doRequest("/auth/v1/admin/users/"+encodeURIComponent(newAuthId),{method:"DELETE"})}catch(e){console.error("Auth rollback:",errMessage(e))}}
   if(companyCreated&&businessId){
    try{await doRequest("/rest/v1/bts_nfc_cards?id=eq."+encodeURIComponent(businessId),{method:"DELETE"})}catch(e){console.error("Business rollback:",errMessage(e))}
   }
   throw error;
  }
 }catch(e){console.error("BTS provisioning error:",errMessage(e));return json({error:"No se pudo completar la operación. Verificá si la empresa o el usuario ya existe. Detalle: "+errMessage(e)},400,origin)}
});
