(function(){
 'use strict';
 const R=window.CWEmailHistoryRules,copy=window.CWEmailHistoryCopy,$=id=>document.getElementById(id),panel=$('emailHistory');
 const keys=['cristalwater_jwt','token','adminToken','cristalwater_user','user'],fingerprint=()=>JSON.stringify(keys.map(k=>localStorage.getItem(k))),filterKeys=['status','type','mode','recipient','q','from','to'];
 let session=null,invalid=false,suspended=false,sequence=0,request=null,data=null,state='loading',page=1,selection=null,urlInvalid=false;
 const params=new URLSearchParams(location.search);let language=Object.hasOwn(copy,params.get('lang'))?params.get('lang'):'pt';
 const t=key=>copy[language][key],node=(tag,content,className)=>{const el=document.createElement(tag);el.textContent=content;if(className)el.className=className;return el;};
 try{
  const token=keys.slice(0,3).map(k=>localStorage.getItem(k)).find(Boolean),claims=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))),id=Number(claims.userId||claims.id),users=keys.slice(3).map(k=>localStorage.getItem(k)).filter(Boolean).map(JSON.parse);
  if(claims.role!=='ADMIN'||!R.positive(id)||!Number.isFinite(claims.exp)||claims.exp*1000<=Date.now()||!users.length||users.some(u=>u.role!=='ADMIN'||Number(u.userId||u.id)!==id)||keys.slice(0,3).some(k=>localStorage.getItem(k)&&localStorage.getItem(k)!==token))throw Error();
  session={token,owner:'ADMIN:'+id,identity:fingerprint(),expires:claims.exp*1000};
 }catch(_){invalid=true;state='session';}
 function abort(){sequence++;if(request){request.controller.abort();clearTimeout(request.timer);request=null;}}
 function active(){
  try{if(!invalid&&session.identity===fingerprint()&&session.expires>Date.now())return true;}catch(_){}
  invalid=true;abort();data=null;selection=null;page=1;for(const key of filterKeys)$('email_'+key).value='';state='session';render();return false;
 }
 function current(requestedPage=page){if(filterKeys.some(key=>$('email_'+key).validity.badInput))return null;return R.filters({...Object.fromEntries(filterKeys.map(key=>[key,$('email_'+key).value])),page:String(requestedPage)});}
 function writeUrl(){const url=new URL(location.href);for(const key of filterKeys){const value=$('email_'+key).value;value?url.searchParams.set(key,value):url.searchParams.delete(key);}url.searchParams.delete('pageSize');url.searchParams.set('page',String(page));url.searchParams.set('lang',language);history.replaceState(null,'',url);}
 function fromUrl(){const url=new URL(location.href),raw=Object.fromEntries([...filterKeys,'page'].filter(key=>url.searchParams.has(key)).map(key=>[key,url.searchParams.get(key)]));for(const key of filterKeys)$('email_'+key).value=raw[key]||'';const f=R.filters(raw);page=f?.page??NaN;urlInvalid=!f||[...filterKeys,'page','pageSize'].some(key=>url.searchParams.getAll(key).length>1)||url.searchParams.has('pageSize')&&url.searchParams.get('pageSize')!=='25';language=Object.hasOwn(copy,url.searchParams.get('lang'))?url.searchParams.get('lang'):language;}
 const locale=()=>({pt:'pt-PT',en:'en-GB',fr:'fr-FR',es:'es-ES',de:'de-DE'})[language],date=value=>new Intl.DateTimeFormat(locale(),{dateStyle:'medium',timeStyle:'medium',timeZone:'UTC'}).format(new Date(value));
 function fact(parent,label,value){const part=node('div','');part.append(node('dt',label),node('dd',value));parent.append(part);}
 function render(){
  document.documentElement.lang=language;document.title=t('title')+' · Cristal Water';$('emailLanguage').value=language;
  for(const el of panel.querySelectorAll('[data-email-copy]'))el.textContent=t(el.dataset.emailCopy);
  panel.dataset.state=state;panel.setAttribute('aria-busy',String(state==='loading'));$('emailStatus').dataset.state=state;
  $('emailStatus').textContent=state==='ready'?t('range').replace('{page}',page).replace('{pages}',data.totalPages).replace('{total}',data.total):t(state)||'';
  $('emailStatus').setAttribute('role',['error','invalid','session'].includes(state)?'alert':'status');$('emailChecked').textContent=data?t('asOf')+' '+date(data.asOf)+' UTC':'';
  const usable=!!data&&['ready','outside','empty'].includes(state);
  for(const suffix of ['', 'Bottom']){$('emailFirst'+suffix).disabled=invalid||suspended||!usable||page===1;$('emailPrevious'+suffix).disabled=invalid||suspended||!usable||!data.hasPrevious;$('emailNext'+suffix).disabled=invalid||suspended||!usable||!data.hasNext;}
  $('refreshEmails').disabled=$('clearEmails').disabled=invalid||suspended;for(const key of filterKeys)$('email_'+key).disabled=invalid||suspended;
  const list=$('emailRows');list.replaceChildren();if(!data)return;
  for(const row of data.items){
   const card=node('article','','email-card');card.dataset.emailId=row.id;card.setAttribute('role','listitem');card.append(node('h2','#'+row.id+' · '+(row.subject??t('notGiven'))));
   const facts=node('dl','');for(const [label,value] of [['created',date(row.createdAt)+' UTC'],['recordedStatus',row.status],['recipient',row.to],['legacyRecipient',row.toEmail],['recordedType',row.type],['eventType',row.eventType],['mode',row.mode],['retryCount',String(row.retryCount)],['lastRetry',row.lastRetryAt?date(row.lastRetryAt)+' UTC':null],['recordedError',row.error]])fact(facts,t(label),value??t('notGiven'));card.append(facts);
   if(row.eventType==='MONTHLY_REPORT'){const link=node('a',t('monthlyReview'),'button');link.href='/admin-email-review';link.addEventListener('click',event=>{if(!active()||state!=='ready'||!R.equal(current(),selection))event.preventDefault();});card.append(link);}else card.append(node('p',t('sourceReview'),'muted'));list.append(card);
  }
 }
 async function load(requestedPage=1){
  if(!active()||suspended)return;const moved=requestedPage!==page;abort();data=null;page=requestedPage;selection=current();
  if(urlInvalid||!selection){state='invalid';render();return;}const chosen=selection,generation=sequence;writeUrl();state='loading';render();
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);request={controller,timer};
  try{
   const query=new URLSearchParams();for(const [key,value] of Object.entries(chosen))if(value!=='')query.set(key,String(value));
   const response=await fetch('/api/admin/email-logs?'+query,{headers:{Authorization:'Bearer '+session.token},signal:controller.signal,cache:'no-store',redirect:'error'});
   if(!active()||suspended||generation!==sequence)return;if([401,403].includes(response.status)){invalid=true;active();return;}
   if(response.status!==200||response.headers.get('x-cw-email-history')!=='email-history-v1'||response.headers.get('x-cw-owner')!==session.owner||response.headers.get('cache-control')!=='private, no-store'||!(response.headers.get('content-type')||'').startsWith('application/json'))throw Error('Unconfirmed email history');
   const result=await response.json();if(!active()||suspended||generation!==sequence)return;if(!R.equal(chosen,current())||!R.packet(result,chosen,session.owner))throw Error('Invalid email history');
   data=result;state=result.items.length?'ready':result.total===0?'empty':'outside';render();if(moved)$('emailStatus').scrollIntoView({block:'start'});
  }catch(_){if(active()&&!suspended&&generation===sequence){data=null;state='error';render();}}
  finally{clearTimeout(timer);if(generation===sequence){request=null;render();}}
 }
 function changed(){if(!active()||suspended)return;abort();data=null;urlInvalid=false;page=1;state='filters';render();}
 for(const key of filterKeys)$('email_'+key).addEventListener('input',changed);
 $('emailFilters').addEventListener('submit',event=>{event.preventDefault();load(1);});
 $('clearEmails').addEventListener('click',()=>{if(!active()||suspended)return;for(const key of filterKeys)$('email_'+key).value='';urlInvalid=false;load(1);});
 for(const suffix of ['', 'Bottom']){$('emailFirst'+suffix).addEventListener('click',()=>load(1));$('emailPrevious'+suffix).addEventListener('click',()=>load(page-1));$('emailNext'+suffix).addEventListener('click',()=>load(page+1));}
 $('emailLanguage').addEventListener('change',()=>{language=$('emailLanguage').value;const url=new URL(location.href);url.searchParams.set('lang',language);history.replaceState(null,'',url);render();});
 window.addEventListener('storage',()=>active());window.addEventListener('focus',()=>active());document.addEventListener('visibilitychange',()=>{if(!document.hidden)active();});
 window.addEventListener('pagehide',()=>{suspended=true;abort();data=null;state='loading';render();});
 window.addEventListener('pageshow',()=>{suspended=false;if(active()){fromUrl();load(page);}});
 window.addEventListener('popstate',()=>{if(active()){fromUrl();load(page);}});
 setInterval(()=>{if(!active()||suspended)return;if(data&&!R.equal(current(),selection))changed();},300);
 for(const id of ['emailRows','emailStatus','emailChecked'])$(id).dataset.cwStateManaged='manual';fromUrl();render();active();
}());
