(function(){
  'use strict';
  const R=window.CWPaymentLedgerRules,copy=window.CWPaymentLedgerCopy,$=id=>document.getElementById(id),panel=$('paymentLedger');
  const keys=['cristalwater_jwt','token','adminToken','cristalwater_user','user'],fingerprint=()=>JSON.stringify(keys.map(k=>localStorage.getItem(k)));
  const filterIds={q:'paymentSearch',clientId:'paymentClientId',method:'paymentMethodFilter',from:'paymentFrom',to:'paymentTo'};
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
    invalid=true;abort();data=null;selection=null;page=1;for(const id of Object.values(filterIds))$(id).value='';state='session';render();return false;
  }
  function current(requestedPage=page){return R.filters({...Object.fromEntries(Object.entries(filterIds).map(([key,id])=>[key,$(id).value])),page:String(requestedPage)});}
  function writeUrl(){const url=new URL(location.href);for(const [key,id] of Object.entries(filterIds)){$(id).value?url.searchParams.set(key,$(id).value):url.searchParams.delete(key);}url.searchParams.set('page',String(page));url.searchParams.set('lang',language);history.replaceState(null,'',url);}
  function fromUrl(){const url=new URL(location.href);for(const [key,id] of Object.entries(filterIds))$(id).value=url.searchParams.get(key)||'';const rawPage=url.searchParams.get('page')||'1';page=/^[1-9]\d*$/.test(rawPage)?Number(rawPage):NaN;urlInvalid=[...Object.keys(filterIds),'page'].some(key=>url.searchParams.getAll(key).length>1);language=Object.hasOwn(copy,url.searchParams.get('lang'))?url.searchParams.get('lang'):language;}
  const locale=()=>({pt:'pt-PT',en:'en-GB',fr:'fr-FR',es:'es-ES',de:'de-DE'})[language];
  function date(value){return new Intl.DateTimeFormat(locale(),{dateStyle:'medium',timeStyle:'medium',timeZone:'UTC'}).format(new Date(value));}
  function amount(row){return row.amountCents===null?row.amountRaw+' EUR':new Intl.NumberFormat(locale(),{style:'currency',currency:'EUR'}).format(row.amountCents/100);}
  function fact(parent,label,value){const part=node('div','');part.append(node('dt',label),node('dd',value));parent.append(part);}
  function render(){
    document.documentElement.lang=language;document.title=t('title')+' · Cristal Water';$('paymentLanguage').value=language;
    for(const el of panel.querySelectorAll('[data-ledger-copy]'))el.textContent=t(el.dataset.ledgerCopy);
    for(const [id,key] of [['paymentSearch','searchHint'],['paymentMethodFilter','allMethods'],['paymentClientId','allClients']])$(id).placeholder=t(key);
    panel.dataset.state=state;panel.setAttribute('aria-busy',String(state==='loading'));$('paymentsStatus').dataset.state=state;
    $('paymentsStatus').textContent=state==='ready'?t('range').replace('{page}',page).replace('{pages}',data.pages).replace('{total}',data.total):t(state)||'';
    $('paymentsStatus').setAttribute('role',['error','invalid','session'].includes(state)?'alert':'status');
    $('paymentChecked').textContent=data?t('asOf')+' '+date(data.asOf)+' UTC':'';
    const usable=!!data&&['ready','outside','empty'].includes(state);
    for(const suffix of ['', 'Bottom']){$('paymentFirst'+suffix).disabled=invalid||suspended||!usable||page===1;$('paymentPrevious'+suffix).disabled=invalid||suspended||!usable||!data.hasPrevious;$('paymentNext'+suffix).disabled=invalid||suspended||!usable||!data.hasNext;}
    $('refreshPayments').disabled=invalid||suspended;for(const id of Object.values(filterIds))$(id).disabled=invalid||suspended;
    const list=$('tableBox');list.replaceChildren();if(!data)return;
    for(const row of data.payments){
      const card=node('article','','payment-card');card.dataset.paymentId=row.id;card.setAttribute('role','listitem');
      const head=node('div','','payment-card-head');head.append(node('h2','#'+row.id),node('strong',amount(row),'payment-amount'));card.append(head);
      const facts=node('dl','','payment-facts');fact(facts,t('client'),row.clientName+' · CW-'+String(row.clientId).padStart(6,'0'));
      fact(facts,t('document'),'#'+row.invoiceId+(row.documentReference?' · '+row.documentReference:'')+' · '+row.documentStatus+(row.monthRef?' · '+row.monthRef:''));
      fact(facts,t('methodOriginal'),row.method??t('notGiven'));fact(facts,t('paidAt'),date(row.paidAt));card.append(facts);
      if(row.internalCredit)card.append(node('p',t('credit'),'payment-credit'));
      if(row.amountReview!=='MATCH')card.append(node('p',t({LEGACY_ZERO_CENTS:'legacy',CONFLICT:'conflict',INVALID_AMOUNT:'invalidAmount'}[row.amountReview]),'payment-review'));
      const details=node('details',''),summary=node('summary',t('raw')),original=node('dl','','payment-facts');fact(original,t('raw'),row.amountRaw+' EUR');fact(original,t('stored'),String(row.storedAmountCents));details.append(summary,original);if(row.notes!==null){details.append(node('h3',t('notes')),node('p',row.notes,'payment-notes'));}card.append(details);
      const link=node('a',t('chat'),'cw-v2-btn');link.href='/chat?clientId='+row.clientId;link.addEventListener('click',event=>{if(!active()||state!=='ready'||!R.equal(current(),selection))event.preventDefault();});card.append(link);list.append(card);
    }
  }
  async function load(requestedPage=1){
    if(!active()||suspended)return;const moved=requestedPage!==page;abort();data=null;page=requestedPage;selection=current();
    if(urlInvalid||!selection){state='invalid';render();return;}
    const chosen=selection,generation=sequence;writeUrl();state='loading';render();
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);request={controller,timer};
    try{
      const query=new URLSearchParams();for(const [key,value] of Object.entries(chosen))if(value!==null&&value!=='')query.set(key,String(value));
      const response=await fetch('/api/admin/payments/ledger/page?'+query,{headers:{Authorization:'Bearer '+session.token},signal:controller.signal,cache:'no-store',redirect:'error'});
      if(!active()||suspended||generation!==sequence)return;
      if([401,403].includes(response.status)){invalid=true;active();return;}
      if(response.status!==200||response.headers.get('x-cw-ledger')!=='admin-payments-v1'||response.headers.get('x-cw-owner')!==session.owner||response.headers.get('cache-control')!=='private, no-store'||!(response.headers.get('content-type')||'').startsWith('application/json'))throw Error('Unconfirmed payment response');
      const result=await response.json();if(!active()||suspended||generation!==sequence)return;
      if(!R.equal(chosen,current())||!R.packet(result,chosen,session.owner))throw Error('Invalid payment page');
      data=result;state=result.payments.length?'ready':result.total===0?'empty':'outside';render();if(moved)$('paymentsStatus').scrollIntoView({block:'start'});
    }catch(_){if(active()&&!suspended&&generation===sequence){data=null;state='error';render();}}
    finally{clearTimeout(timer);if(generation===sequence){request=null;render();}}
  }
  function changed(){if(!active()||suspended)return;abort();data=null;urlInvalid=false;page=1;state='filters';render();}
  for(const id of Object.values(filterIds))$(id).addEventListener('input',changed);
  $('paymentFilters').addEventListener('submit',event=>{event.preventDefault();load(1);});
  for(const suffix of ['', 'Bottom']){$('paymentFirst'+suffix).addEventListener('click',()=>load(1));$('paymentPrevious'+suffix).addEventListener('click',()=>load(page-1));$('paymentNext'+suffix).addEventListener('click',()=>load(page+1));}
  $('paymentLanguage').addEventListener('change',()=>{language=$('paymentLanguage').value;const url=new URL(location.href);url.searchParams.set('lang',language);history.replaceState(null,'',url);render();});
  window.addEventListener('storage',()=>active());window.addEventListener('focus',()=>active());document.addEventListener('visibilitychange',()=>{if(!document.hidden)active();});
  window.addEventListener('pagehide',()=>{suspended=true;abort();data=null;state='loading';render();});window.addEventListener('pageshow',event=>{if(event.persisted){suspended=false;fromUrl();load(page);}});
  window.addEventListener('popstate',()=>{if(active()){fromUrl();load(page);}});
  setInterval(()=>{if(!active()||suspended)return;if(data&&!R.equal(current(),selection))changed();},300);
  for(const id of ['tableBox','paymentsStatus','paymentChecked'])$(id).dataset.cwStateManaged='manual';
  fromUrl();render();if(active())load(page);
}());
