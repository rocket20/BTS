// BTS Studio GA4 reporting proxy. Only signed-in BTS administrators can read reports.
// Secret GA_SERVICE_ACCOUNT_JSON is configured in Supabase Edge Function Secrets.
// Never send this Google service account credential to the browser or GitHub.
const PROJECT_URL = Deno.env.get("SUPABASE_URL") || "https://xwehejgwufwhpkpzjzyt.supabase.co";
const PUBLISHABLE_KEY = "sb_publishable_0LR-LUDY7NjJaK5K3qtxPg_1aLupDVz";
const GA_PROPERTY_ID = "562792478";
const GOOGLE_SCOPE = "https://www.googleapis.com/auth/analytics.readonly";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const ALLOWED_ORIGINS = new Set(["https://www.btsstudio.net", "https://btsstudio.net"]);
let cachedGoogleToken: { token: string; until: number } | null = null;

function cors(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://www.btsstudio.net";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Vary": "Origin",
    "Cache-Control": "private, no-store",
  };
}
function answer(body: Record<string, unknown>, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {...cors(origin), "Content-Type": "application/json; charset=utf-8"},
  });
}
function base64url(data: Uint8Array) {
  return btoa(String.fromCharCode(...data)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
async function googleToken(credentials: { client_email: string; private_key: string }) {
  if (cachedGoogleToken && cachedGoogleToken.until > Date.now()) return cachedGoogleToken.token;
  const now = Math.floor(Date.now() / 1000);
  const enc = new TextEncoder();
  const h = base64url(enc.encode(JSON.stringify({alg:"RS256",typ:"JWT"})));
  const p = base64url(enc.encode(JSON.stringify({
    iss:credentials.client_email,scope:GOOGLE_SCOPE,aud:GOOGLE_TOKEN_URL,iat:now,exp:now+3300,
  })));
  const unsigned = h+"."+p;
  const raw = atob(credentials.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, ""));
  const bytes = Uint8Array.from(raw, c=>c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8",bytes,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5",key,enc.encode(unsigned)));
  const assertion = unsigned+"."+base64url(sig);
  const response = await fetch(GOOGLE_TOKEN_URL,{
    method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},
    body:new URLSearchParams({grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",assertion}),
    signal:AbortSignal.timeout(9000),
  });
  if (!response.ok) throw Error("Google rechazó las credenciales de la cuenta de servicio ("+response.status+").");
  const token = await response.json();
  if(!token.access_token)throw Error("Google no entregó un token de acceso.");
  cachedGoogleToken={token:token.access_token,until:Date.now()+Math.max(60,Number(token.expires_in||3300)-120)*1000};
  return token.access_token as string;
}
async function report(googleAccessToken: string, body: Record<string, unknown>) {
  const response=await fetch("https://analyticsdata.googleapis.com/v1beta/properties/"+GA_PROPERTY_ID+":runReport",{
    method:"POST",
    headers:{"Authorization":"Bearer "+googleAccessToken,"Content-Type":"application/json"},
    body:JSON.stringify(body),
    signal:AbortSignal.timeout(12000),
  });
  if(!response.ok) {
    if(response.status===403)throw Error("La cuenta de servicio necesita acceso de Lector a la propiedad GA4 y la API habilitada.");
    if(response.status===404)throw Error("La propiedad de Analytics no está disponible para esta cuenta de servicio.");
    throw Error("Google Analytics Data API respondió "+response.status+".");
  }
  return await response.json();
}
function numberCell(row: any,index=0){return Number(row?.metricValues?.[index]?.value||0)||0;}
async function verifyBtsAdmin(bearer: string){
  if(!/^Bearer\s+\S+$/i.test(bearer))return false;
  const headers={"Authorization":bearer,"apikey":PUBLISHABLE_KEY,"Accept":"application/json"};
  const userResp=await fetch(PROJECT_URL+"/auth/v1/user",{headers,signal:AbortSignal.timeout(7000)});
  if(!userResp.ok)return false;
  const user=await userResp.json();
  if(!user?.id)return false;
  const adminResp=await fetch(PROJECT_URL+"/rest/v1/bts_admins?select=user_id&user_id=eq."+encodeURIComponent(user.id)+"&limit=1",{headers,signal:AbortSignal.timeout(7000)});
  if(!adminResp.ok)return false;
  const records=await adminResp.json();
  return Array.isArray(records)&&records.length>0;
}

Deno.serve(async req=>{
  const origin=req.headers.get("origin");
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors(origin)});
  if(req.method!=="GET")return answer({error:"Método no permitido."},405,origin);
  try{
    const ok=await verifyBtsAdmin(req.headers.get("authorization")||"");
    if(!ok)return answer({error:"Acceso reservado para administradores autenticados de BTS Studio."},403,origin);
    const secret=Deno.env.get("GA_SERVICE_ACCOUNT_JSON");
    if(!secret)return answer({
      configured:false,code:"GOOGLE_SETUP_REQUIRED",
      error:"Falta autorizar Google Analytics: agregá GA_SERVICE_ACCOUNT_JSON en Supabase Edge Function Secrets.",
      propertyId:GA_PROPERTY_ID
    },503,origin);
    let credentials:{client_email:string;private_key:string};
    try{credentials=JSON.parse(secret);}catch{return answer({error:"El secreto GA_SERVICE_ACCOUNT_JSON no contiene un JSON válido."},503,origin);}
    if(!credentials.client_email||!credentials.private_key)return answer({error:"La cuenta de servicio no contiene client_email o private_key."},503,origin);
    const googleAccessToken=await googleToken(credentials);
    const last30=[{startDate:"29daysAgo",endDate:"today"}], last7=[{startDate:"6daysAgo",endDate:"today"}];
    const [summary,daily,sources,events]=await Promise.all([
      report(googleAccessToken,{dateRanges:last30,metrics:[{name:"screenPageViews"},{name:"totalUsers"},{name:"sessions"}]}),
      report(googleAccessToken,{dateRanges:last7,dimensions:[{name:"date"}],metrics:[{name:"screenPageViews"}],limit:"10",orderBys:[{dimension:{dimensionName:"date"}}]}),
      report(googleAccessToken,{dateRanges:last30,dimensions:[{name:"sessionDefaultChannelGroup"}],metrics:[{name:"sessions"}],limit:"15",orderBys:[{metric:{metricName:"sessions"},desc:true}]}),
      report(googleAccessToken,{dateRanges:last30,dimensions:[{name:"eventName"}],metrics:[{name:"eventCount"}],dimensionFilter:{filter:{fieldName:"eventName",inListFilter:{values:["bts_whatsapp_click","bts_quote_submitted"]}}},limit:"10"}),
    ]);
    const metrics=summary.rows?.[0];
    const eventCounts:Record<string,number>={};
    for(const row of events.rows||[])eventCounts[row.dimensionValues?.[0]?.value||""]=numberCell(row);
    const result={
      configured:true,propertyId:GA_PROPERTY_ID,measurementId:"G-LY7K0LHLTC",
      source:"Google Analytics 4",period:"Últimos 30 días",updatedAt:new Date().toISOString(),
      pageViews:numberCell(metrics,0),users:numberCell(metrics,1),sessions:numberCell(metrics,2),
      whatsappClicks:eventCounts.bts_whatsapp_click||0,quoteSubmissions:eventCounts.bts_quote_submitted||0,
      daily:(daily.rows||[]).map((r:any)=>({date:String(r.dimensionValues?.[0]?.value||""),views:numberCell(r)})),
      channels:(sources.rows||[]).map((r:any)=>({name:String(r.dimensionValues?.[0]?.value||"Otros"),sessions:numberCell(r)})),
    };
    return answer(result,200,origin);
  }catch(e){
    const msg=e instanceof Error?e.message:"No se pudo consultar Google Analytics.";
    console.error("BTS GA4 reporting failed:",msg);
    return answer({configured:false,error:msg},502,origin);
  }
});
