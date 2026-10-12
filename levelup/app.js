'use strict';
const KEY='levelup-life-v1';
const $=s=>document.querySelector(s);
const uid=()=>Math.random().toString(36).slice(2,9);
const pad=n=>String(n).padStart(2,'0');
const dkey=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const today=()=>dkey(new Date());
const addDays=(k,n)=>{const d=new Date(k+'T12:00:00');d.setDate(d.getDate()+n);return dkey(d)};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function defaults(){
  const st=[['str','체력','💪'],['int','지식','📚'],['mnd','정신','🧘'],['life','생활','🏠'],['rel','관계','🤝']].map(([id,name,icon])=>({id,name,icon}));
  const it=[['물 2L 마시기','str',10],['30분 운동','str',20],['독서 20쪽','int',15],['명상 5분','mnd',10],['방 정리','life',10],['가족·친구에게 연락','rel',15]].map(([title,stat,xp])=>({id:uid(),title,stat,xp,type:'habit'}));
  it.push({id:uid(),title:'이번 주 장보기',stat:'life',xp:15,type:'todo',done:null});
  return {v:1,stats:st,items:it,log:{},rewards:[],quests:[{id:uid(),title:'이번 달 운동 10회',stat:'str',item:null,period:'month',target:10,reward:100,claimed:{}}],ach:{},theme:'dark'};
}
let S;try{S=JSON.parse(localStorage.getItem(KEY))}catch(e){}
if(!S||!S.stats)S=defaults();
if(!S.meta)S.meta={lastModified:0};
const body=o=>{const c=Object.assign({},o);delete c.meta;return JSON.stringify(c)};
let lastBody=body(S);
// 데이터가 실제로 바뀐 경우에만 lastModified 갱신
function save(){const b=body(S);if(b!==lastBody){S.meta.lastModified=Date.now();lastBody=b;window.LUSync&&LUSync.markDirty()}localStorage.setItem(KEY,JSON.stringify(S))}
function replaceState(n){S=n;if(!S.meta)S.meta={lastModified:0};lastBody=body(S);localStorage.setItem(KEY,JSON.stringify(S));render()}

// 레벨 곡선: 초반 빠르게, 후반 점점 느리게
const need=l=>Math.round(40+20*Math.pow(l-1,1.45));
function lvl(xp){let l=1;while(xp>=need(l)){xp-=need(l);l++}return {l,cur:xp,need:need(l)}}
const statLvl=xp=>lvl(xp*2); // 능력치 레벨은 단일 스탯 xp 기준으로 조금 빠르게

function dayLog(k){return S.log[k]||(S.log[k]={checks:[],memo:''})}
function totals(){
  const st={};S.stats.forEach(s=>st[s.id]=0);let total=0,checks=0;
  for(const k in S.log)for(const c of S.log[k].checks){st[c.stat]=(st[c.stat]||0)+c.xp;total+=c.xp;checks++}
  for(const r of S.rewards){total+=r.xp;if(r.stat)st[r.stat]=(st[r.stat]||0)+r.xp}
  return {st,total,checks};
}
function isChecked(id,k=today()){return (S.log[k]?.checks||[]).some(c=>c.id===id)}
function streak(id){let k=today();if(!isChecked(id,k))k=addDays(k,-1);let n=0;while(isChecked(id,k)){n++;k=addDays(k,-1)}return n}
function bestStreak(){return Math.max(0,...S.items.filter(i=>i.type==='habit').map(i=>streak(i.id)))}
function anyStreakDays(){let k=today();if(!(S.log[k]?.checks.length))k=addDays(k,-1);let n=0;while(S.log[k]?.checks.length){n++;k=addDays(k,-1)}return n}

const ACH=[
 ['first','🌱','첫 체크',()=>totals().checks>=1],
 ['c50','✅','체크 50회',()=>totals().checks>=50],
 ['c200','💯','체크 200회',()=>totals().checks>=200],
 ['s3','🔥','3일 연속',()=>bestStreak()>=3],
 ['s7','⚡','7일 연속',()=>bestStreak()>=7],
 ['s30','👑','30일 연속',()=>bestStreak()>=30],
 ['l5','⭐','레벨 5',()=>lvl(totals().total).l>=5],
 ['l10','🌟','레벨 10',()=>lvl(totals().total).l>=10],
 ['l20','💫','레벨 20',()=>lvl(totals().total).l>=20],
 ['all','🎯','하루 올클리어',()=>{const h=S.items.filter(i=>i.type==='habit');return h.length>0&&h.every(i=>isChecked(i.id))}],
 ['quest','🏅','첫 퀘스트 완료',()=>S.rewards.some(r=>r.src==='quest')],
 ['memo','✏️','한 줄 메모 7일',()=>Object.values(S.log).filter(l=>l.memo).length>=7],
];
function periodKey(p,k=today()){if(p==='month')return k.slice(0,7);if(p==='week'){const d=new Date(k+'T12:00:00');const m=addDays(k,-((d.getDay()+6)%7));return 'W'+m}return 'all'}
function inPeriod(p,k){return p==='all'||periodKey(p,k)===periodKey(p)}
function questProg(q){let n=0;for(const k in S.log){if(!inPeriod(q.period,k))continue;for(const c of S.log[k].checks)if(q.item?c.id===q.item:(!q.stat||c.stat===q.stat))n++}return n}

function toast(msg,cls=''){const t=document.createElement('div');t.className='toast '+cls;t.textContent=msg;$('#toasts').appendChild(t);setTimeout(()=>t.remove(),2600)}
function floatXP(el,txt){const r=el.getBoundingClientRect();const f=document.createElement('div');f.className='xpf';f.textContent=txt;f.style.left=r.left+'px';f.style.top=r.top+'px';document.body.appendChild(f);setTimeout(()=>f.remove(),1000)}

function evaluate(before){
  // 퀘스트 보상
  for(const q of S.quests){const pk=periodKey(q.period);if(!q.claimed[pk]&&questProg(q)>=q.target){q.claimed[pk]=today();S.rewards.push({date:today(),xp:q.reward,stat:q.stat||null,src:'quest',id:q.id});toast('🏅 퀘스트 완료! '+q.title+' +'+q.reward+'XP')}}
  for(const [id,e,name,fn] of ACH){if(!S.ach[id]&&fn()){S.ach[id]=today();S.rewards.push({date:today(),xp:20,stat:null,src:'ach',id});toast(e+' 업적 달성: '+name+' (+20XP)')}}
  const after=totals();
  const L0=lvl(before.total).l,L1=lvl(after.total).l;
  if(L1>L0){toast('🎉 LEVEL UP! Lv.'+L1,'lv');setTimeout(()=>$('.lvbadge')?.classList.add('flash'),50)}
  for(const s of S.stats){const a=statLvl(before.st[s.id]||0).l,b=statLvl(after.st[s.id]||0).l;if(b>a)toast(s.icon+' '+s.name+' Lv.'+b+' 달성!')}
  save();render();
}
function toggle(id,el){
  const it=S.items.find(i=>i.id===id);const before=totals();const L=dayLog(today());
  const ix=L.checks.findIndex(c=>c.id===id);
  if(ix>=0){L.checks.splice(ix,1);if(it.type==='todo')it.done=null}
  else{L.checks.push({id,stat:it.stat,xp:it.xp});if(it.type==='todo')it.done=today();floatXP(el,'+'+it.xp+' XP')}
  evaluate(before);
}
const statOf=id=>S.stats.find(s=>s.id===id)||{name:'?',icon:'❔'};

function renderHero(){const t=totals(),L=lvl(t.total);
 $('#hero').innerHTML=`<div class="hrow"><div class="lvbadge"><small>LV</small><b>${L.l}</b></div><div style="flex:1"><div style="font-weight:800">용현의 모험 <span class="mut" style="color:#ddd">· 총 ${t.total} XP</span></div><div class="bar"><i style="width:${L.cur/L.need*100}%"></i></div><div class="mut" style="color:#ccc">다음 레벨까지 ${L.need-L.cur} XP · 🔥 ${anyStreakDays()}일 연속</div></div><span id="syncIcon"></span></div>`;window.LUSync&&LUSync.renderIcon()}
function itemRow(i){const d=i.type==='habit'?isChecked(i.id):!!i.done;const s=statOf(i.stat);const sk=i.type==='habit'?streak(i.id):0;
 return `<div class="item ${d?'done':''}" data-id="${i.id}"><button class="chk" data-act="chk">${d?'✓':''}</button><div class="t"><div>${esc(i.title)}</div><div><span class="tag">${s.icon} ${esc(s.name)}</span><span class="mut">+${i.xp}XP</span> ${sk?`<span class="streak">🔥${sk}</span>`:''}</div></div><button class="x" data-act="edit">✎</button></div>`}
function renderToday(){const k=today(),L=S.log[k]||{memo:''};
 const hab=S.items.filter(i=>i.type==='habit'),todo=S.items.filter(i=>i.type==='todo'&&(!i.done||i.done===k));
 const dn=hab.filter(i=>isChecked(i.id)).length;
 $('#tab-today').innerHTML=`<div class="card"><h2>🗓 매일 습관 <span class="mut">${dn}/${hab.length}</span></h2>${hab.map(itemRow).join('')||'<div class="empty">습관을 추가해 보세요</div>'}</div>
 <div class="card"><h2>📜 할 일</h2>${todo.map(itemRow).join('')||'<div class="empty">할 일이 없어요</div>'}</div>
 <button class="btn" style="width:100%;margin-bottom:12px" id="addItem">＋ 습관 / 할 일 추가</button>
 <div class="memo"><span class="mut">✏️</span><input id="memo" maxlength="80" placeholder="오늘 한 줄 (선택)" value="${esc(L.memo||'')}"></div>`;
 $('#addItem').onclick=()=>editItem();
 $('#memo').onchange=e=>{const before=totals();dayLog(k).memo=e.target.value.trim();evaluate(before);toast('메모 저장됨')};
}
function renderStats(){const t=totals();
 $('#tab-stats').innerHTML=`<div class="card"><h2>🧬 능력치 <button class="btn sm sec" id="addStat">＋ 추가</button></h2>${S.stats.map(s=>{const L=statLvl(t.st[s.id]||0);return `<div class="stat"><div class="ic">${s.icon}</div><div class="s"><b>${esc(s.name)}</b> <span class="mut">Lv.${L.l} · ${t.st[s.id]||0}XP</span><div class="bar"><i style="width:${L.cur/L.need*100}%"></i></div></div><button class="x" data-stat="${s.id}">✎</button></div>`}).join('')}</div>
 <div class="card"><h2>📋 기록</h2><div class="mut">총 체크 ${t.checks}회 · 최고 연속 ${bestStreak()}일 · 업적 ${Object.keys(S.ach).length}/${ACH.length}</div></div>`;
 $('#addStat').onclick=()=>editStat();
 document.querySelectorAll('[data-stat]').forEach(b=>b.onclick=()=>editStat(b.dataset.stat));
}
function renderQuests(){const pn={week:'이번 주',month:'이번 달',all:'누적'};
 $('#tab-quests').innerHTML=`<div class="card"><h2>⚔️ 퀘스트 <button class="btn sm" id="addQ">＋ 새 퀘스트</button></h2>${S.quests.map(q=>{const p=questProg(q),c=q.claimed[periodKey(q.period)];return `<div class="item ${c?'done':''}"><div class="t"><div>${c?'🏅 ':''}${esc(q.title)}</div><div class="prog">${pn[q.period]} ${Math.min(p,q.target)}/${q.target} · 보상 ${q.reward}XP</div><div class="bar"><i style="width:${Math.min(1,p/q.target)*100}%"></i></div></div><button class="x" data-q="${q.id}">🗑</button></div>`}).join('')||'<div class="empty">퀘스트를 만들어 보세요</div>'}</div>
 <div class="card"><h2>🏆 업적</h2><div class="grid">${ACH.map(([id,e,n])=>`<div class="ach ${S.ach[id]?'':'lock'}"><span class="e">${e}</span>${n}${S.ach[id]?`<div class="mut">${S.ach[id].slice(5)}</div>`:''}</div>`).join('')}</div></div>`;
 $('#addQ').onclick=editQuest;
 document.querySelectorAll('[data-q]').forEach(b=>b.onclick=()=>{if(confirm('이 퀘스트를 삭제할까요?')){S.quests=S.quests.filter(q=>q.id!==b.dataset.q);save();render()}});
}
let chartMode='week';
function dayXP(k){let x=0,n=0;for(const c of S.log[k]?.checks||[]){x+=c.xp;n++}for(const r of S.rewards)if(r.date===k)x+=r.xp;return {x,n}}
function renderCharts(){
 $('#tab-charts').innerHTML=`<div class="seg"><button class="btn ${chartMode==='week'?'':'sec'}" data-m="week">주간 (7일)</button><button class="btn ${chartMode==='month'?'':'sec'}" data-m="month">월간 (30일)</button></div>
 <div class="card"><h2>⚡ 획득 XP</h2><canvas id="c1"></canvas></div><div class="card"><h2>✅ 완료 수</h2><canvas id="c2"></canvas></div><div class="card"><h2>🧬 능력치별 XP (기간)</h2><canvas id="c3"></canvas></div>`;
 document.querySelectorAll('[data-m]').forEach(b=>b.onclick=()=>{chartMode=b.dataset.m;renderCharts()});
 const n=chartMode==='week'?7:30,days=[];for(let i=n-1;i>=0;i--)days.push(addDays(today(),-i));
 const lab=days.map(k=>chartMode==='week'?['일','월','화','수','목','금','토'][new Date(k+'T12:00:00').getDay()]:(+k.slice(8)));
 bar('c1',lab,days.map(k=>dayXP(k).x),'#a78bfa');bar('c2',lab,days.map(k=>dayXP(k).n),'#22c55e');
 const ss={};S.stats.forEach(s=>ss[s.id]=0);for(const k of days)for(const c of S.log[k]?.checks||[])ss[c.stat]=(ss[c.stat]||0)+c.xp;
 bar('c3',S.stats.map(s=>s.name),S.stats.map(s=>ss[s.id]),'#f472b6');
}
function bar(id,labels,vals,color){const cv=document.getElementById(id);const dpr=window.devicePixelRatio||1,W=cv.clientWidth,H=cv.clientHeight;cv.width=W*dpr;cv.height=H*dpr;const g=cv.getContext('2d');g.scale(dpr,dpr);
 const cs=getComputedStyle(document.body),mut=cs.getPropertyValue('--mut');const max=Math.max(1,...vals),pl=26,pb=20,cw=(W-pl)/vals.length;
 g.font='10px sans-serif';g.fillStyle=mut;g.strokeStyle=mut+'44';
 for(let i=0;i<=2;i++){const y=8+(H-pb-8)*i/2;g.globalAlpha=.3;g.beginPath();g.moveTo(pl,y);g.lineTo(W,y);g.stroke();g.globalAlpha=1;g.fillText(Math.round(max*(1-i/2)),0,y+3)}
 vals.forEach((v,i)=>{const h=(H-pb-8)*v/max,x=pl+i*cw+cw*.18,w=cw*.64;const gr=g.createLinearGradient(0,H-pb-h,0,H-pb);gr.addColorStop(0,color);gr.addColorStop(1,color+'55');g.fillStyle=gr;g.beginPath();(g.roundRect?g.roundRect(x,H-pb-h,w,h,3):g.rect(x,H-pb-h,w,h));g.fill();
  g.fillStyle=mut;g.textAlign='center';if(vals.length<=10||i%5===4)g.fillText(labels[i],x+w/2,H-6);g.textAlign='left'});
}
function renderSettings(){
 $('#tab-settings').innerHTML=`<div class="card"><h2>🎨 화면</h2><button class="btn sec" id="theme">${S.theme==='dark'?'☀️ 라이트 모드':'🌙 다크 모드'}</button></div>
 <div class="card" id="syncCard"></div><div class="card"><h2>💾 백업</h2><div class="row"><button class="btn" id="exp">⬇ 내보내기(JSON)</button><button class="btn sec" id="imp">⬆ 가져오기</button></div><input type="file" id="file" accept=".json,application/json" style="display:none"><p class="mut">데이터는 이 기기 브라우저에만 저장돼요. 가끔 내보내기로 백업해 두세요.</p></div>
 <div class="card"><h2>⚠️ 초기화</h2><button class="btn sec" id="reset" style="color:var(--bad)">모든 데이터 삭제</button></div><p class="mut" style="text-align:center">레벨업 라이프 v1.0 · 오프라인 지원</p>`;
 window.LUSync&&LUSync.renderCard();$('#theme').onclick=()=>{S.theme=S.theme==='dark'?'light':'dark';save();render()};
 $('#exp').onclick=exportData;$('#imp').onclick=()=>$('#file').click();
 $('#file').onchange=e=>{const f=e.target.files[0];if(!f)return;f.text().then(t=>importData(t))};
 $('#reset').onclick=()=>{if(confirm('정말 모든 기록을 지울까요? 되돌릴 수 없어요.')){S=Object.assign(defaults(),{meta:S.meta});save();render();toast('초기화했어요')}};
}
function exportData(){const b=new Blob([JSON.stringify(S,null,1)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='levelup-backup-'+today()+'.json';document.body.appendChild(a);a.click();a.remove();toast('백업 파일을 저장했어요')}
function importData(t){try{const d=JSON.parse(t);if(!d.stats||!d.items||!d.log)throw 0;S=Object.assign(defaults(),d,{meta:S.meta});lastBody='';save();render();toast('불러오기 완료!')}catch(e){alert('올바른 백업 파일이 아니에요')}}
window.LU={exportData,importData,get S(){return S},totals,lvl,replaceState,save,render:()=>render(),toast,today};

function sheet(html,onok){const m=$('#modal');m.innerHTML=`<div class="sheet">${html}<div class="row"><button class="btn sec" id="mc">취소</button><button class="btn" id="mo">저장</button></div></div>`;m.classList.remove('hidden');
 const close=()=>m.classList.add('hidden');$('#mc').onclick=close;m.onclick=e=>{if(e.target===m)close()};$('#mo').onclick=()=>{if(onok()!==false)close()};}
const statOpts=sel=>S.stats.map(s=>`<option value="${s.id}" ${s.id===sel?'selected':''}>${s.icon} ${esc(s.name)}</option>`).join('');
function editItem(id){const it=S.items.find(i=>i.id===id)||{title:'',stat:S.stats[0]?.id,xp:10,type:'habit'};
 sheet(`<h2>${id?'수정':'새 항목'}</h2><label>이름</label><input id="fT" value="${esc(it.title)}" placeholder="예: 스트레칭 10분"><div class="row"><div><label>종류</label><select id="fY"><option value="habit">매일 습관</option><option value="todo" ${it.type==='todo'?'selected':''}>한 번 할 일</option></select></div><div><label>능력치</label><select id="fS">${statOpts(it.stat)}</select></div><div><label>XP</label><select id="fX">${[5,10,15,20,30,50].map(v=>`<option ${v==it.xp?'selected':''}>${v}</option>`).join('')}</select></div></div>${id?'<button class="btn sec" id="fD" style="color:var(--bad)">🗑 삭제</button>':''}`,()=>{
  const t=$('#fT').value.trim();if(!t)return false;Object.assign(it,{title:t,type:$('#fY').value,stat:$('#fS').value,xp:+$('#fX').value});
  if(!id){it.id=uid();if(it.type==='todo')it.done=null;S.items.push(it)}save();render()});
 if(id)$('#fD').onclick=()=>{if(confirm('삭제할까요? (이미 얻은 XP는 유지)')){S.items=S.items.filter(i=>i.id!==id);save();render();$('#modal').classList.add('hidden')}};
}
function editStat(id){const s=S.stats.find(x=>x.id===id)||{name:'',icon:'✨'};
 sheet(`<h2>${id?'능력치 수정':'새 능력치'}</h2><div class="row"><div style="flex:0 0 70px"><label>아이콘</label><input id="sI" value="${esc(s.icon)}" maxlength="4"></div><div><label>이름</label><input id="sN" value="${esc(s.name)}"></div></div>${id&&S.stats.length>1?'<button class="btn sec" id="sD" style="color:var(--bad)">🗑 삭제</button>':''}`,()=>{
  const n=$('#sN').value.trim();if(!n)return false;s.name=n;s.icon=$('#sI').value.trim()||'✨';if(!id){s.id=uid();S.stats.push(s)}save();render()});
 if(id&&S.stats.length>1)$('#sD').onclick=()=>{if(confirm('능력치를 삭제할까요?')){S.stats=S.stats.filter(x=>x.id!==id);const f=S.stats[0].id;S.items.forEach(i=>{if(i.stat===id)i.stat=f});save();render();$('#modal').classList.add('hidden')}};
}
function editQuest(){
 sheet(`<h2>새 퀘스트</h2><label>이름</label><input id="qT" placeholder="예: 이번 달 달리기 10번"><label>대상</label><select id="qW"><optgroup label="능력치 전체">${statOpts()}</optgroup><optgroup label="특정 항목">${S.items.map(i=>`<option value="i:${i.id}">${esc(i.title)}</option>`).join('')}</optgroup></select><div class="row"><div><label>기간</label><select id="qP"><option value="week">매주</option><option value="month" selected>매월</option><option value="all">누적</option></select></div><div><label>목표 횟수</label><input id="qN" type="number" value="10" min="1"></div><div><label>보상 XP</label><input id="qR" type="number" value="100" min="0"></div></div>`,()=>{
  const t=$('#qT').value.trim(),w=$('#qW').value;if(!t)return false;const isI=w.startsWith('i:');const it=isI?S.items.find(i=>i.id===w.slice(2)):null;
  S.quests.push({id:uid(),title:t,item:it?it.id:null,stat:it?it.stat:w,period:$('#qP').value,target:Math.max(1,+$('#qN').value||1),reward:Math.max(0,+$('#qR').value||0),claimed:{}});
  const b=totals();evaluate(b)});
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-act]');if(!b)return;const id=b.closest('.item').dataset.id;if(b.dataset.act==='chk')toggle(id,b);else editItem(id)});
document.querySelectorAll('#nav button').forEach(b=>b.onclick=()=>{document.querySelectorAll('#nav button').forEach(x=>x.classList.toggle('on',x===b));document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t.id==='tab-'+b.dataset.tab));if(b.dataset.tab==='charts')renderCharts();scrollTo(0,0)});
function render(){document.body.classList.toggle('light',S.theme==='light');renderHero();renderToday();renderStats();renderQuests();if($('#tab-charts').classList.contains('active'))renderCharts();renderSettings()}
render();save();
window.LUSync&&LUSync.start();
if('serviceWorker'in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('sw.js').catch(()=>{});
