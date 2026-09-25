(function(){
  'use strict';
  const R=window.CWExtraHistoryRules,copy=window.CWExtraHistoryCopy,$=id=>document.getElementById(id),panel=$('extraHistory');
  const keys=['cristalwater_jwt','token','adminToken','cristalwater_user','user'],fingerprint=()=>JSON.stringify(keys.map(k=>localStorage.getItem(k)));
  const filterIds={q:'extraSearch',clientId:'extraClientId',poolId:'extraPoolId',from:'extraFrom',to:'extraTo'};
  let session=null,invalid=false,suspended=false,sequence=0,request=null,data=null,state='loading',page=1,selection=null,urlInvalid=false;
  const urlLanguage=()=>{const values=new URLSearchParams(location.search).getAll('lang');return values.length===1&&Object.hasOwn(copy,values[0])?values[0]:'pt';};let language=urlLanguage();
  const t=key=>copy[language][key],node=(tag,content,className)=>{const el=document.createElement(tag);el.textContent=content;if(className)el.className=className;return el;};
  try{
    const token=keys.slice(0,3).map(k=>localStorage.getItem(k)).find(Boolean),claims=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))),id=Number(claims.userId||claims.id),users=keys.slice(3).map(k=>localStorage.getItem(k)).filter(Boolean).map(JSON.parse);
    if(claims.role!=='ADMIN'||!R.positive(id)||!Number.isFinite(claims.exp)||claims.exp*1000<=Date.now()||!users.length||users.some(u=>u.role!=='ADMIN'||Number(u.userId||u.id)!==id)||keys.slice(0,3).some(k=>localStorage.getItem(k)&&localStorage.getItem(k)!==token))throw Error();
    session={token,owner:'ADMIN:'+id,identity:fingerprint(),expires:claims.exp*1000};
  }catch(_){invalid=true;state='session';}
  function abort(){sequence++;if(request){request.controller.abort();clearTimeout(request.timer);request=null;}}
  function active(){
    try{if(!invalid&&session.identity===fingerprint()&&session.expires>Date.now())return true;}catch(_){}
    invalid=true;abort();data=null;selection=null;page=1;for(const id of Object.values(filterIds))$(id).value='';state='session';render();return false;
  }
  function current(requestedPage=page){return R.filters({...Object.fromEntries(Object.entries(filterIds).map(([key,id])=>[key,$(id).value])),page:String(requestedPage)});}
  function writeUrl(){const url=new URL(location.href);for(const [key,id] of Object.entries(filterIds)){$(id).value?url.searchParams.set(key,$(id).value):url.searchParams.delete(key);}url.searchParams.set('page',String(page));url.searchParams.set('lang',language);history.replaceState(null,'',url);}
  function fromUrl(){const url=new URL(location.href);for(const [key,id] of Object.entries(filterIds))$(id).value=url.searchParams.get(key)||'';const rawPage=url.searchParams.get('page')||'1';page=/^[1-9]\d*$/.test(rawPage)?Number(rawPage):NaN;urlInvalid=[...Object.keys(filterIds),'page'].some(key=>url.searchParams.getAll(key).length>1);language=urlLanguage();}
  const locale=()=>({pt:'pt-PT',en:'en-GB',fr:'fr-FR',es:'es-ES',de:'de-DE'})[language];
  function date(value){return new Intl.DateTimeFormat(locale(),{dateStyle:'medium',timeStyle:'medium',timeZone:'UTC'}).format(new Date(value));}
  function amount(row){
    if(row.priceCents===null)return row.priceRaw+' EUR';
    const cents=BigInt(row.priceCents),absolute=cents<0n?-cents:cents,whole=absolute/100n,fraction=String(absolute%100n).padStart(2,'0'),signed=cents<0n?(whole===0n?-0:-whole):whole;
    return new Intl.NumberFormat(locale(),{style:'currency',currency:'EUR'}).formatToParts(signed).map(part=>part.type==='fraction'?fraction:part.value).join('');
  }
  function fact(parent,label,value){const part=node('div','');part.append(node('dt',label),node('dd',value));parent.append(part);}
  function render(){
    document.documentElement.lang=language;document.title=t('title')+' · Cristal Water';$('extraLanguage').value=language;
    for(const el of panel.querySelectorAll('[data-ledger-copy]'))el.textContent=t(el.dataset.ledgerCopy);
    for(const [id,key] of [['extraSearch','searchHint'],['extraPoolId','allPools'],['extraClientId','allClients']])$(id).placeholder=t(key);
    panel.dataset.state=state;panel.setAttribute('aria-busy',String(state==='loading'));$('extrasStatus').dataset.state=state;
    $('extrasStatus').textContent=state==='ready'?t('range').replace('{page}',page).replace('{pages}',data.pages).replace('{total}',data.total):t(state)||'';
    $('extrasStatus').setAttribute('role',['error','invalid','session'].includes(state)?'alert':'status');
    $('extraChecked').textContent=data?t('asOf')+' '+date(data.asOf)+' UTC':'';
    const usable=!!data&&['ready','outside','empty'].includes(state);
    for(const suffix of ['', 'Bottom']){$('extraFirst'+suffix).disabled=invalid||suspended||!usable||page===1;$('extraPrevious'+suffix).disabled=invalid||suspended||!usable||!data.hasPrevious;$('extraNext'+suffix).disabled=invalid||suspended||!usable||!data.hasNext;}
    $('refreshExtras').disabled=invalid||suspended;for(const id of Object.values(filterIds))$(id).disabled=invalid||suspended;
    const list=$('tableBox');list.replaceChildren();if(!data)return;
    for(const row of data.extras){
      const card=node('article','','extra-card');card.dataset.extraId=row.id;card.setAttribute('role','listitem');
      const head=node('div','','extra-card-head');head.append(node('h2','#'+row.id),node('strong',amount(row),'extra-amount'));card.append(head,node('p',t('price'),'text-muted'));
      const facts=node('dl','','extra-facts');fact(facts,t('client'),row.clientId===null?t('notGiven'):row.clientName+' · CW-'+String(row.clientId).padStart(6,'0'));
      fact(facts,t('pool'),row.poolId===null?t('notGiven'):row.poolName+' · #'+row.poolId);fact(facts,t('billedAt'),row.billedAt===null?t('missingDate'):date(row.billedAt));fact(facts,t('scheduledAt'),date(row.scheduledAt));fact(facts,t('status'),row.status);fact(facts,t('mode'),row.billingMode);card.append(facts);
      if(row.clientReview!=='RECORDED')card.append(node('p',t(row.clientReview==='MISSING'?'missingClient':'changedClient'),'extra-review'));
      if(row.priceCents===null)card.append(node('p',t('invalidAmount'),'extra-review'));else if(row.priceCents<0)card.append(node('p',t('negative'),'extra-review'));
      const details=node('details',''),summary=node('summary',t('raw')),original=node('dl','','extra-facts');fact(original,t('price'),row.priceRaw+' EUR');fact(original,t('billedAt'),row.billedAt??t('missingDate'));fact(original,t('scheduledAt'),row.scheduledAt);details.append(summary,original);if(row.notes!==null)details.append(node('h3',t('notes')),node('p',row.notes,'extra-notes'));card.append(details);list.append(card);
    }
  }
  async function load(requestedPage=1){
    if(!active()||suspended)return;const moved=requestedPage!==page;abort();data=null;page=requestedPage;selection=current();
    if(urlInvalid||!selection){state='invalid';render();return;}
    const chosen=selection,generation=sequence;writeUrl();state='loading';render();
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);request={controller,timer};
    try{
      const query=new URLSearchParams();for(const [key,value] of Object.entries(chosen))if(value!==null&&value!=='')query.set(key,String(value));
      const response=await fetch('/api/billing/extras/history/page?'+query,{headers:{Authorization:'Bearer '+session.token},signal:controller.signal,cache:'no-store',redirect:'error'});
      if(!active()||suspended||generation!==sequence)return;
      if([401,403].includes(response.status)){invalid=true;active();return;}
      if(response.status!==200||response.headers.get('x-cw-extra-history')!=='extra-history-v1'||response.headers.get('x-cw-owner')!==session.owner||response.headers.get('cache-control')!=='private, no-store'||!(response.headers.get('content-type')||'').startsWith('application/json'))throw Error('Unconfirmed extra response');
      const result=await response.json();if(!active()||suspended||generation!==sequence)return;
      if(!R.equal(chosen,current())||!R.packet(result,chosen,session.owner))throw Error('Invalid extra page');
      data=result;state=result.extras.length?'ready':result.total===0?'empty':'outside';render();if(moved)$('extrasStatus').scrollIntoView({block:'start'});
    }catch(_){if(active()&&!suspended&&generation===sequence){data=null;state='error';render();}}
    finally{clearTimeout(timer);if(generation===sequence){request=null;render();}}
  }
  function changed(){if(!active()||suspended)return;abort();data=null;urlInvalid=false;page=1;state='filters';render();}
  for(const id of Object.values(filterIds))$(id).addEventListener('input',changed);
  $('extraFilters').addEventListener('submit',event=>{event.preventDefault();load(1);});
  for(const suffix of ['', 'Bottom']){$('extraFirst'+suffix).addEventListener('click',()=>load(1));$('extraPrevious'+suffix).addEventListener('click',()=>load(page-1));$('extraNext'+suffix).addEventListener('click',()=>load(page+1));}
  $('extraLanguage').addEventListener('change',()=>{active();language=$('extraLanguage').value;const url=new URL(location.href);url.searchParams.set('lang',language);history.replaceState(null,'',url);render();});
  window.addEventListener('storage',()=>active());window.addEventListener('focus',()=>active());document.addEventListener('visibilitychange',()=>{if(!document.hidden)active();});
  window.addEventListener('pagehide',()=>{suspended=true;abort();data=null;state='loading';render();});window.addEventListener('pageshow',event=>{if(event.persisted){suspended=false;fromUrl();load(page);}});
  window.addEventListener('popstate',()=>{if(active()){fromUrl();load(page);}});
  setInterval(()=>{if(!active()||suspended)return;if(data&&!R.equal(current(),selection))changed();},300);
  for(const id of ['tableBox','extrasStatus','extraChecked'])$(id).dataset.cwStateManaged='manual';
  fromUrl();render();if(active())load(page);
}());
