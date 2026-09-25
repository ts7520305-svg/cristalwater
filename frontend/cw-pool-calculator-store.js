(function(root){
  'use strict';
  const R=root.CWPoolCalculatorRules,copy=value=>JSON.parse(JSON.stringify(value));
  async function hash(value){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(R.canonical(value)))))].map(n=>n.toString(16).padStart(2,'0')).join('');}
  function open(owner){
    if(!/^ADMIN:[1-9]\d*$/.test(owner))throw Error('Invalid owner');
    const key='cwPoolCalculator:v1:'+owner;
    let current=null,raw=null;
    const empty=()=>({schema:1,owner,revision:0,pending:null,confirmed:null});
    async function record(value){return R.exact(value,['poolId','command','payloadHash','review'])&&R.positive(value.poolId)&&R.command(value.command)&&R.state(value.review)&&value.review.poolId===value.poolId&&value.review.version===value.command.expectedVersion&&value.payloadHash===await hash(R.envelope(value.poolId,value.command));}
    async function validate(value){
      return R.exact(value,['schema','owner','revision','pending','confirmed'])&&value.schema===1&&value.owner===owner&&Number.isSafeInteger(value.revision)&&value.revision>=0&&!(value.pending&&value.confirmed)&&(value.pending===null||await record(value.pending))&&(value.confirmed===null||R.exact(value.confirmed,['record','result'])&&await record(value.confirmed.record)&&R.confirmation(value.confirmed.result,value.confirmed.record,owner));
    }
    async function read(){
      const source=localStorage.getItem(key),value=source===null?empty():JSON.parse(source);
      if(!await validate(value))throw Error('Invalid saved request');
      raw=source;current=value;return copy(value);
    }
    async function change(next){
      if(!navigator.locks?.request||!current)throw Error('Safe storage unavailable');
      return navigator.locks.request(key,async()=>{
        if(localStorage.getItem(key)!==raw)throw Error('Another tab changed this request');
        const value={schema:1,owner,revision:current.revision+1,...next};
        if(!await validate(value))throw Error('Invalid saved request');
        const source=JSON.stringify(value);
        // A thrown or silently ignored write must never be followed by a POST.
        localStorage.setItem(key,source);
        if(localStorage.getItem(key)!==source)throw Error('Saved request not durable');
        raw=source;current=value;return copy(value);
      });
    }
    async function prepare(review,fields){
      if(!current||current.pending)throw Error('Request already pending');
      const command={requestId:crypto.randomUUID(),expectedVersion:review.version,fields:copy(fields)};
      const pending={poolId:review.poolId,command,payloadHash:await hash(R.envelope(review.poolId,command)),review:copy(review)};
      return change({pending,confirmed:null});
    }
    async function confirm(result){
      if(!current?.pending||!R.confirmation(result,current.pending,owner))throw Error('Unconfirmed result');
      return change({pending:null,confirmed:{record:current.pending,result}});
    }
    const unchanged=()=>current!==null&&localStorage.getItem(key)===raw;
    return {key,read,prepare,confirm,unchanged,clear:()=>change({pending:null,confirmed:null})};
  }
  root.CWPoolCalculatorStore={open};
}(window));
