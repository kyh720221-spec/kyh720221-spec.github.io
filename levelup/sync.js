'use strict';
// 원드라이브 동기화 (MSAL.js + Microsoft Graph, 앱 폴더 전용)
(function(){
const CFG=window.LEVELUP_CONFIG||{};
const SCOPES=['Files.ReadWrite.AppFolder','offline_access'];
const GRAPH='https://graph.microsoft.com/v1.0';
const DATA='/me/drive/special/approot:/levelup-data.json:/content';
const SK='levelup-sync',SNAPK='levelup-local-snapshots';
const configured=()=>!!CFG.msClientId&&CFG.msClientId!=='REPLACE_ME';
let st;try{st=JSON.parse(localStorage.getItem(SK))}catch(e){}
st=Object.assign({interval:'60',dailyTime:'21:00',lastSync:0,lastRemoteMod:0,pending:false,email:'',status:'idle',msg:'',lastSnapDate:''},st||{});
let dev=localStorage.getItem('levelup-device');if(!dev){dev='dev-'+Math.random().toString(36).slice(2,10);localStorage.setItem('levelup-device',dev)}
const persist=()=>localStorage.setItem(SK,JSON.stringify(st));
const $=s=>document.querySelector(s);
const pad=n=>String(n).padStart(2,'0');
const fmt=t=>{if(!t)return '없음';const d=new Date(t);return `${d.getMonth()+1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`};
function setStatus(s,msg=''){st.status=s;st.msg=msg;persist();renderIcon();renderCard()}

// ---- 인증 어댑터 (테스트에서 교체 가능) ----
let pca=null,account=null;
const realAuth={
 async init(){
  if(!configured()||!window.msal)return null;
  pca=new msal.PublicClientApplication({auth:{clientId:CFG.msClientId,authority:CFG.authority||'https://login.microsoftonline.com/consumers',redirectUri:CFG.redirectUri||location.origin+location.pathname.replace(/[^/]*$/,'')},cache:{cacheLocation:'localStorage'}});
  await pca.initialize();
  const r=await pca.handleRedirectPromise(); // 리디렉션 로그인 복귀 처리
  account=(r&&r.account)||pca.getAllAccounts()[0]||null;
  if(account)pca.setActiveAccount(account);
  return account?{email:account.username}:null;
 },
 async login(){await pca.loginRedirect({scopes:SCOPES,prompt:'select_account'})},
 async logout(){if(account)await pca.logoutRedirect({account,onRedirectNavigate:()=>false});account=null},
 async token(interactive){
  try{return (await pca.acquireTokenSilent({scopes:SCOPES,account})).accessToken}
  catch(e){if(interactive){await pca.acquireTokenRedirect({scopes:SCOPES,account});}const x=new Error('needLogin');x.code='needLogin';throw x}
 }
};
let auth=realAuth,net=(...a)=>fetch(...a),signedIn=false;

async function graph(method,path,body,interactive){
 const tk=await auth.token(interactive);
 const r=await net(path.startsWith('http')?path:GRAPH+path,{method,headers:Object.assign({Authorization:'Bearer '+tk},body!==undefined?{'Content-Type':'application/json'}:{}),body:body!==undefined?JSON.stringify(body):undefined});
 if(r.status===404)return null;
 if(r.status===401){const x=new Error('needLogin');x.code='needLogin';throw x}
 if(!r.ok)throw new Error('Graph '+r.status);
 return r.status===204?true:r.json();
}
const putFile=(name,obj)=>graph('PUT','/me/drive/special/approot:/'+name+':/content',obj);
function localSnapshot(obj,why){let a=[];try{a=JSON.parse(localStorage.getItem(SNAPK))||[]}catch(e){}a.unshift({at:Date.now(),why,data:obj});localStorage.setItem(SNAPK,JSON.stringify(a.slice(0,10)))}
async function prune(){
 const l=await graph('GET','/me/drive/special/approot:/backups:/children?$select=id,name&$top=500');if(!l||!l.value)return;
 const daily=l.value.filter(f=>/^levelup-\d{4}-\d{2}-\d{2}\.json$/.test(f.name)).sort((a,b)=>b.name.localeCompare(a.name));
 for(const f of daily.slice(30))await graph('DELETE','/me/drive/items/'+f.id);
}

let running=null;
async function sync(reason='manual',interactive=false){
 if(!configured()||!signedIn)return 'skip';
 if(!navigator.onLine){st.pending=true;setStatus('offline','오프라인 · 연결되면 자동 동기화');return 'offline'}
 if(running)return running;
 running=(async()=>{
  setStatus('syncing','동기화 중…');
  try{
   const S=LU.S,ts=Date.now(),stamp=new Date(ts).toISOString().replace(/[:.]/g,'-');
   const remote=await graph('GET',DATA,undefined,interactive);
   const L=(S.meta&&S.meta.lastModified)||0,R=(remote&&remote.meta&&remote.meta.lastModified)||0;
   let action='same';
   if(!remote||L>R){
    if(remote&&R>st.lastRemoteMod&&st.lastRemoteMod)await putFile('backups/conflict-remote-'+stamp+'.json',remote); // 양쪽 모두 바뀐 경우 원격본 보존
    S.meta.deviceId=dev;await putFile('levelup-data.json',S);st.lastRemoteMod=L;action='upload';
   }else if(R>L){
    localSnapshot(S,'원격 데이터로 덮어쓰기 전');
    if(L)await putFile('backups/conflict-local-'+dev+'-'+stamp+'.json',S);
    LU.replaceState(remote);st.lastRemoteMod=R;action='download';LU.toast('☁️ 원드라이브의 최신 기록을 불러왔어요');
   }else st.lastRemoteMod=R;
   const day=LU.today();
   if(st.lastSnapDate!==day){await putFile('backups/levelup-'+day+'.json',LU.S);await prune();st.lastSnapDate=day}
   st.lastSync=Date.now();st.pending=false;setStatus('ok','동기화 완료');return action;
  }catch(e){
   if(e.code==='needLogin'){setStatus('login','다시 로그인이 필요해요');return 'login'}
   st.pending=true;
   if(!navigator.onLine||e instanceof TypeError){setStatus('offline','네트워크 오류 · 나중에 다시 시도');return 'offline'}
   setStatus('error','오류: '+e.message);return 'error';
  }finally{running=null}
 })();
 return running;
}
async function restore(){
 if(!navigator.onLine){LU.toast('오프라인이에요');return}
 if(!confirm('원드라이브의 기록으로 이 기기 데이터를 바꿀까요? (현재 데이터는 스냅샷으로 보관돼요)'))return;
 try{setStatus('syncing','불러오는 중…');const r=await graph('GET',DATA,undefined,true);
  if(!r){setStatus('ok','원드라이브에 저장된 기록이 없어요');return}
  localSnapshot(LU.S,'원드라이브에서 불러오기 전');LU.replaceState(r);st.lastRemoteMod=(r.meta&&r.meta.lastModified)||0;st.lastSync=Date.now();st.pending=false;setStatus('ok','불러오기 완료');LU.toast('☁️ 불러오기 완료!');
 }catch(e){setStatus(e.code==='needLogin'?'login':'error',e.code==='needLogin'?'다시 로그인이 필요해요':'오류: '+e.message)}
}

// ---- 주기 판단 (순수 함수) ----
function dueNow(cfg,last,now){
 if(!cfg||cfg.interval==='off')return false;
 if(cfg.interval==='daily'){const [h,m]=(cfg.dailyTime||'21:00').split(':').map(Number);const t=new Date(now);t.setHours(h,m,0,0);return now>=t.getTime()&&last<t.getTime()}
 return now-last>=(+cfg.interval)*60000;
}
function tick(){if(signedIn&&navigator.onLine&&dueNow(st,st.lastSync,Date.now()))sync('interval')}

// ---- UI ----
const ICON={idle:'☁️',ok:'☁️',syncing:'<span class="spin">🔄</span>',offline:'📴',error:'⚠️',login:'🔑',none:'',ready:'⏳'};
function renderIcon(){const el=$('#syncIcon');if(!el)return;if(!configured()){el.innerHTML='';return}const s=!signedIn?'none':st.status;el.innerHTML=(ICON[s]||'')+(signedIn&&st.pending&&s==='ok'?'·':'');el.title=st.msg||'';el.onclick=()=>document.querySelector('[data-tab=settings]').click()}
function renderCard(){const c=$('#syncCard');if(!c)return;
 if(!configured()){c.style.display='none';c.innerHTML='';return}c.style.display='';
 if(!signedIn){c.innerHTML='<h2>☁️ 원드라이브 동기화</h2><p class="mut">원드라이브 앱 폴더에 자동 백업·동기화해요. 기록은 오프라인에서도 계속 돼요.</p><button class="btn" id="sLogin">원드라이브 연결</button>';$('#sLogin').onclick=()=>auth.login();return}
 const opts=[['off','끄기'],['30','30분'],['60','1시간'],['180','3시간'],['daily','하루 1번']];
 c.innerHTML=`<h2>☁️ 원드라이브 동기화</h2><div class="mut">계정: ${st.email||'-'}<br>마지막 동기화: ${fmt(st.lastSync)}<br>상태: <span id="sMsg">${st.msg||'대기'}</span>${st.pending?' · 보낼 변경 있음':''}</div>
 <div class="row" style="margin:10px 0"><div><label>자동 동기화</label><select id="sInt">${opts.map(([v,n])=>`<option value="${v}" ${st.interval===v?'selected':''}>${n}</option>`).join('')}</select></div>${st.interval==='daily'?`<div><label>시각</label><input type="time" id="sTime" value="${st.dailyTime}"></div>`:''}</div>
 <div class="row"><button class="btn" id="sNow">지금 동기화</button><button class="btn sec" id="sRest">원드라이브에서 불러오기</button></div>
 <button class="btn sec sm" id="sOut" style="margin-top:10px">연결 해제</button>`;
 $('#sInt').onchange=e=>{st.interval=e.target.value;persist();renderCard()};
 if($('#sTime'))$('#sTime').onchange=e=>{st.dailyTime=e.target.value;persist()};
 $('#sNow').onclick=()=>sync('manual',true);$('#sRest').onclick=restore;
 $('#sOut').onclick=async()=>{if(!confirm('원드라이브 연결을 해제할까요? (기기 데이터는 그대로예요)'))return;await auth.logout();signedIn=false;st.email='';persist();renderCard();renderIcon()};
}

async function start(){
 renderIcon();renderCard();
 window.addEventListener('online',()=>sync('online'));
 window.addEventListener('offline',()=>{if(signedIn)setStatus('offline','오프라인 · 기록은 기기에 저장돼요')});
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')sync('background')});
 setInterval(tick,60000);
 try{const a=await auth.init();if(a){signedIn=true;st.email=a.email;persist();renderCard();renderIcon();await sync('open')}}
 catch(e){setStatus('error','로그인 초기화 오류: '+e.message)}
}
window.LUSync={start,sync,restore,dueNow,tick,renderIcon,renderCard,markDirty(){st.pending=true;persist();renderIcon()},
 get state(){return st},configured,
 async __test(a,n,cfg){if(a)auth=a;if(n)net=n;if(cfg)Object.assign(CFG,cfg);const x=await auth.init();signedIn=!!x;if(x){st.email=x.email;persist()}renderCard();renderIcon();return x}};
})();
