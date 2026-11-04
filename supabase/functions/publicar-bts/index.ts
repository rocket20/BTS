// BTS Studio: Edge Function publicar-bts
// Configure GITHUB_TOKEN in Supabase Edge Functions > Secrets.
// Leave the platform Verify JWT option ENABLED.
const REPO = "rocket20/BTS";
const BRANCH = "main";
const ORIGINS = new Set([
  "https://btsstudio.net",
  "https://www.btsstudio.net",
  "https://rocket20.github.io",
  "http://localhost:8000",
  "http://127.0.0.1:8000",
]);
function response(status: number, data: Record<string, unknown>, origin: string | null) {
  const headers: Record<string,string> = {
    "Content-Type":"application/json; charset=utf-8",
    "Cache-Control":"no-store", "Vary":"Origin"
  };
  if(origin && ORIGINS.has(origin)){
    headers["Access-Control-Allow-Origin"]=origin;
    headers["Access-Control-Allow-Headers"]="authorization, apikey, content-type, x-client-info";
    headers["Access-Control-Allow-Methods"]="POST, OPTIONS";
  }
  return new Response(JSON.stringify(data),{status,headers});
}
async function github(path:string,method:string,token:string,payload?:unknown){
  const url="https://api.github.com/repos/"+REPO+"/"+path;
  const headers:Record<string,string>={
    Authorization:"Bearer "+token,
    Accept:"application/vnd.github+json",
    "X-GitHub-Api-Version":"2022-11-28"
  };
  if(payload!==undefined)headers["Content-Type"]="application/json";
  const res=await fetch(url,{method,headers,body:payload===undefined?undefined:JSON.stringify(payload)});
  const raw=await res.text();
  let json:Record<string,unknown>={};
  try{json=raw?JSON.parse(raw):{};}catch{}
  return {status:res.status,ok:res.ok,json};
}
Deno.serve(async(req:Request)=>{
  const origin=req.headers.get("origin");
  if(origin&&!ORIGINS.has(origin))return response(403,{error:"Origen no permitido"},origin);
  if(req.method==="OPTIONS"){
    return new Response(null,{status:204,headers:{
      "Access-Control-Allow-Origin":origin||"https://www.btsstudio.net",
      "Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info",
      "Access-Control-Allow-Methods":"POST, OPTIONS",Vary:"Origin"
    }});
  }
  if(req.method!=="POST")return response(405,{error:"Método no permitido"},origin);
  const base=Deno.env.get("SUPABASE_URL")||"";
  let named:Record<string,string>={};
  try{named=JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")||"{}");}catch{}
  const key=named.default||Deno.env.get("SUPABASE_ANON_KEY")||"";
  const auth=req.headers.get("Authorization")||"";
  const jwt=/^Bearer\s+([A-Za-z0-9._-]+)$/i.exec(auth)?.[1];
  if(!base||!key)return response(500,{error:"Supabase no configurado"},origin);
  if(!jwt)return response(401,{error:"Iniciá sesión para publicar"},origin);
  try{
    const who=await fetch(base+"/auth/v1/user",{
      headers:{apikey:key,Authorization:"Bearer "+jwt},cache:"no-store"
    });
    if(!who.ok)return response(401,{error:"Sesión caducada o no válida"},origin);
    const user=await who.json();
    if(typeof user.id!=="string"||!user.id)return response(401,{error:"Usuario inválido"},origin);
    const admins=await fetch(
      base+"/rest/v1/bts_admins?select=user_id&user_id=eq."+encodeURIComponent(user.id)+"&limit=1",
      {headers:{apikey:key,Authorization:"Bearer "+jwt},cache:"no-store"}
    );
    if(!admins.ok)return response(500,{error:"No se pudo comprobar bts_admins"},origin);
    const permitted=await admins.json();
    if(!Array.isArray(permitted)||!permitted.length){
      return response(403,{error:"Usuario sin permiso de publicación"},origin);
    }
    const secret=Deno.env.get("GITHUB_TOKEN");
    if(!secret)return response(503,{error:"Configurá GITHUB_TOKEN en Edge Functions > Secrets"},origin);
    if(Number(req.headers.get("content-length")||0)>4500000){
      return response(413,{error:"Archivo demasiado grande"},origin);
    }
    const raw=await req.text();
    if(raw.length>4500000)return response(413,{error:"Solicitud demasiado grande"},origin);
    let input:{action?:string,path?:string,content?:string,message?:string};
    try{input=JSON.parse(raw);}catch{
      return response(400,{error:"JSON inválido"},origin);
    }
    if(input.action==="status"){
      const g=await github("contents/data/bts-content.json?ref="+BRANCH,"GET",secret);
      if(!g.ok)return response(502,{error:"GitHub respondió HTTP "+g.status+". Revisá el token."},origin);
      return response(200,{ok:true,repo:REPO,branch:BRANCH},origin);
    }
    if(input.action!=="put_file")return response(400,{error:"Acción no permitida"},origin);
    const path=input.path||"";
    const jsonFile=path==="data/bts-content.json";
    const imageFile=/^assets\/uploads\/[A-Za-z0-9._-]{1,160}\.(webp|png|jpg|jpeg)$/i.test(path);
    if(!jsonFile&&!imageFile)return response(403,{error:"Ruta no permitida"},origin);
    const content=input.content||"";
    if(!content||content.length>(jsonFile?900000:3900000)||!/^[A-Za-z0-9+/]+={0,2}$/.test(content)){
      return response(400,{error:"Archivo base64 inválido o demasiado grande"},origin);
    }
    if(jsonFile){
      try{
        const bytes=Uint8Array.from(atob(content),(c)=>c.charCodeAt(0));
        const obj=JSON.parse(new TextDecoder().decode(bytes));
        if(!obj||typeof obj!=="object"||!Array.isArray(obj.events)||!Array.isArray(obj.packages)||
           !Array.isArray(obj.brands)||!Array.isArray(obj.services))throw Error("Estructura inválida");
      }catch{return response(400,{error:"JSON de contenido inválido"},origin);}
    }
    const fullPath=path.split("/").map(encodeURIComponent).join("/");
    const old=await github("contents/"+fullPath+"?ref="+BRANCH,"GET",secret);
    if(!old.ok&&old.status!==404){
      return response(502,{error:"GitHub no pudo leer el archivo (HTTP "+old.status+")"},origin);
    }
    const toWrite:Record<string,unknown>={
      message:String(input.message||"BTS Studio: actualizar contenido").slice(0,140),
      content,branch:BRANCH
    };
    if(old.ok&&typeof old.json.sha==="string")toWrite.sha=old.json.sha;
    const saved=await github("contents/"+fullPath,"PUT",secret,toWrite);
    if(!saved.ok){
      return response(502,{error:"GitHub rechazó la publicación (HTTP "+saved.status+"): "+
        String(saved.json.message||"error").slice(0,150)},origin);
    }
    return response(200,{ok:true,path},origin);
  }catch(err){
    console.error("publicar-bts:",err);
    return response(500,{error:"Error interno. Revisá los registros de la función."},origin);
  }
});
