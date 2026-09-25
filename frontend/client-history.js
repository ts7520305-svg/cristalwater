(function(){
 'use strict';
 const R=window.CWClientTechnicalRules,copy=window.CWClientTechnicalCopy,$=id=>document.getElementById(id),panel=$('technicalHistory');
 const keys=['cristalwater_jwt','token','adminToken','cristalwater_user','user','cw_client_id','clientId'],fingerprint=()=>JSON.stringify(keys.map(k=>localStorage.getItem(k)));
 const filterIds={poolId:'historyPoolId',from:'historyFrom',to:'historyTo'};
 let session=null,invalid=false,suspended=false,sequence=0,request=null,data=null,state='loading',page=1,selection=null,urlInvalid=false;
 const urlLanguage=()=>{const values=new URLSearchParams(location.search).getAll('lang');return values.length===1&&Object.hasOwn(copy,values[0])?values[0]:'pt';};let language=urlLanguage();
 const t=key=>copy[language][key==='title'&&document.body.dataset.historyView==='technical'?'technicalTitle':key],node=(tag,content,className)=>{const el=document.createElement(tag);el.textContent=content;if(className)el.className=className;return el;};
 try{
  const token=keys.slice(0,3).map(k=>localStorage.getItem(k)).find(Boolean),claims=JSON.parse(decodeURIComponent(Array.from(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')),c=>'%'+c.charCodeAt(0).toString(16).padStart(2,'0')).join(''))),id=Number(claims.clientId||claims.id),users=keys.slice(3,5).map(k=>localStorage.getItem(k)).filter(Boolean).map(JSON.parse);
  if(claims.role!=='CLIENT'||claims.principalType&&claims.principalType!=='CLIENT'||!R.positive(id)||!Number.isFinite(claims.exp)||claims.exp*1000<=Date.now()||!users.length||users.some(u=>u.role!=='CLIENT'||Number(u.clientId||u.id)!==id)||keys.slice(0,3).some(k=>localStorage.getItem(k)&&localStorage.getItem(k)!==token)||keys.slice(5).some(k=>localStorage.getItem(k)&&localStorage.getItem(k)!==String(id)))throw Error();
  session={token,clientId:id,identity:fingerprint(),expires:claims.exp*1000};
 }catch(_){invalid=true;state='session';}
 function abort(){sequence++;if(request){request.controller.abort();clearTimeout(request.timer);request=null;}}
 function active(){try{if(!invalid&&session.identity===fingerprint()&&session.expires>Date.now())return true;}catch(_){}invalid=true;abort();data=null;selection=null;page=1;for(const id of Object.values(filterIds))$(id).value='';state='session';render();return false;}
 function current(requestedPage=page){return R.filters({...Object.fromEntries(Object.entries(filterIds).map(([key,id])=>[key,$(id).value])),page:String(requestedPage)});}
 function writeUrl(){const url=new URL(location.href);url.search='';for(const [key,id] of Object.entries(filterIds))if($(id).value)url.searchParams.set(key,$(id).value);url.searchParams.set('page',String(page));url.searchParams.set('lang',language);history.replaceState(null,'',url);}
 function fromUrl(){const url=new URL(location.href);for(const [key,id] of Object.entries(filterIds))$(id).value=url.searchParams.get(key)||'';const rawPage=url.searchParams.get('page')||'1';page=/^[1-9]\d*$/.test(rawPage)?Number(rawPage):NaN;urlInvalid=[...Object.keys(filterIds),'page'].some(key=>url.searchParams.getAll(key).length>1);language=urlLanguage();}
 const locale=()=>({pt:'pt-PT',en:'en-GB',fr:'fr-FR',es:'es-ES',de:'de-DE'})[language],date=value=>new Intl.DateTimeFormat(locale(),{dateStyle:'medium',timeStyle:'medium',timeZone:'UTC'}).format(new Date(value));
 function fact(parent,label,value){const part=node('div','');part.append(node('dt',label),node('dd',value));parent.append(part);}
 function render(){
  document.documentElement.lang=language;document.title=t('title')+' · Cristal Water';$('historyLanguage').value=language;
  for(const el of panel.querySelectorAll('[data-history-copy]'))el.textContent=t(el.dataset.historyCopy);$('historyPoolId').placeholder=t('allPools');
  $('portalLink').href='/client-portal?lang='+language;$('documentsLink').href='/client-portal?lang='+language+'#documentsPanel';
  panel.dataset.state=state;panel.setAttribute('aria-busy',String(state==='loading'));$('historyStatus').dataset.state=state;
  $('historyStatus').textContent=state==='ready'?t('range').replace('{page}',page).replace('{pages}',data.pages).replace('{total}',data.total):t(state)||'';$('historyStatus').setAttribute('role',['error','invalid','session'].includes(state)?'alert':'status');$('historyChecked').textContent=data?t('asOf')+' '+date(data.asOf)+' UTC':'';
  const usable=!!data&&['ready','outside','empty'].includes(state);for(const suffix of ['', 'Bottom']){$('historyFirst'+suffix).disabled=invalid||suspended||!usable||page===1;$('historyPrevious'+suffix).disabled=invalid||suspended||!usable||!data.hasPrevious;$('historyNext'+suffix).disabled=invalid||suspended||!usable||!data.hasNext;}
  $('refreshHistory').disabled=invalid||suspended;for(const id of Object.values(filterIds))$(id).disabled=invalid||suspended;
  const list=$('historyRows');list.replaceChildren();if(!data)return;
  for(const row of data.visits){
   const card=node('article','','history-card');card.dataset.visitId=row.id;card.setAttribute('role','listitem');card.append(node('h2','#'+row.id+' · '+(row.poolName??t('notGiven'))));
   const facts=node('dl','','history-facts');fact(facts,t('pool'),row.poolId===null?t('notGiven'):'#'+row.poolId);fact(facts,t('date'),date(row.date)+' UTC');fact(facts,t('status'),row.status);fact(facts,t('technician'),row.technicianName??t('notGiven'));card.append(facts,node('h3',t('readings')));
   const readings=node('dl','','history-facts');for(const key of R.readingKeys)fact(readings,t(key),row.readings[key]===null?t('notGiven'):String(row.readings[key]));card.append(readings,node('p',t('readingNote'),'text-muted'));
   const details=node('details',''),original=node('dl','','history-facts');for(const key of ['date','plannedDate','startAt','endAt'])fact(original,t(key),row[key]??t('notGiven'));details.append(node('summary',t('raw')),original);
   if(row.notes!==null)details.append(node('h3',t('notes')),node('p',row.notes,'history-notes'));if(row.products!==null)details.append(node('h3',t('products')),node('p',row.products,'history-notes'));
   if(row.chemicals.length){details.append(node('h3',t('products')));const chemicals=node('ul','');for(const c of row.chemicals)chemicals.append(node('li',c.name+' · '+String(c.quantity)+(c.unit===null?' · '+t('notGiven'):' '+c.unit)));details.append(chemicals);}card.append(details);list.append(card);
  }
 }
 async function load(requestedPage=1){
  if(!active()||suspended)return;const moved=requestedPage!==page;abort();data=null;page=requestedPage;selection=current();if(urlInvalid||!selection){state='invalid';render();return;}
  const chosen=selection,generation=sequence;writeUrl();state='loading';render();const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);request={controller,timer};
  try{
   const query=new URLSearchParams();for(const [key,value] of Object.entries(chosen))if(value!==null&&value!=='')query.set(key,String(value));
   const response=await fetch('/api/client-portal/'+session.clientId+'/technical-history?'+query,{headers:{Authorization:'Bearer '+session.token},signal:controller.signal,cache:'no-store',redirect:'error'});
   if(!active()||suspended||generation!==sequence)return;if([401,403].includes(response.status)){invalid=true;active();return;}
   if(response.status!==200||response.headers.get('x-cw-portal-type')!=='technical-history-v1'||response.headers.get('x-cw-client-id')!==String(session.clientId)||response.headers.get('cache-control')!=='private, no-store'||!(response.headers.get('content-type')||'').startsWith('application/json'))throw Error('Unconfirmed history');
   const result=await response.json();if(!active()||suspended||generation!==sequence)return;if(!R.equal(chosen,current())||!R.packet(result,chosen,session.clientId))throw Error('Invalid history');data=result;state=result.visits.length?'ready':result.total===0?'empty':'outside';render();if(moved)$('historyStatus').scrollIntoView({block:'start'});
  }catch(_){if(active()&&!suspended&&generation===sequence){data=null;state='error';render();}}finally{clearTimeout(timer);if(generation===sequence){request=null;render();}}
 }
 function changed(){if(!active()||suspended)return;abort();data=null;urlInvalid=false;page=1;state='filters';render();}
 for(const id of Object.values(filterIds))$(id).addEventListener('input',changed);$('historyFilters').addEventListener('submit',event=>{event.preventDefault();load(1);});
 for(const suffix of ['', 'Bottom']){$('historyFirst'+suffix).addEventListener('click',()=>load(1));$('historyPrevious'+suffix).addEventListener('click',()=>load(page-1));$('historyNext'+suffix).addEventListener('click',()=>load(page+1));}
 $('historyLanguage').addEventListener('change',()=>{active();language=$('historyLanguage').value;const url=new URL(location.href);url.searchParams.set('lang',language);history.replaceState(null,'',url);render();});
 window.addEventListener('storage',()=>active());window.addEventListener('focus',()=>active());document.addEventListener('visibilitychange',()=>{if(!document.hidden)active();});window.addEventListener('pagehide',()=>{suspended=true;abort();data=null;state='loading';render();});window.addEventListener('pageshow',event=>{if(event.persisted){suspended=false;fromUrl();load(page);}});window.addEventListener('popstate',()=>{if(active()){fromUrl();load(page);}});setInterval(()=>{if(!active()||suspended)return;if(data&&!R.equal(current(),selection))changed();},300);
 for(const id of ['historyRows','historyStatus','historyChecked'])$(id).dataset.cwStateManaged='manual';fromUrl();render();if(active())load(page);
}());
