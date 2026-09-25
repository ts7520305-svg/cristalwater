(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./cw-pool-calculator-rules'));else root.CWPoolCalculatorDrafts=factory(root.CWPoolCalculatorRules);}(typeof window==='object'?window:globalThis,function(R){
  'use strict';
  const sameRequest=(draft,record)=>!!draft&&draft.poolId===record?.poolId&&draft.review.version===record.command?.expectedVersion&&R.equal(draft.fields,record.command.fields);
  function open(owner,storage){
    if(!/^ADMIN:[1-9]\d*$/.test(owner))throw Error('Invalid draft owner');
    const observed=new Map(),key=id=>{if(!R.positive(id))throw Error('Invalid pool');return 'cwPoolCalculatorDraft:v1:'+owner+':'+id;};
    function valid(value,id){return R.exact(value,['schema','owner','poolId','review','fields'])&&value.schema===1&&value.owner===owner&&value.poolId===id&&R.state(value.review)&&value.review.poolId===id&&R.fields(value.fields);}
    function read(id){const raw=storage.getItem(key(id)),value=raw===null?null:JSON.parse(raw);if(value!==null&&!valid(value,id))throw Error('Invalid original draft');observed.set(id,raw);return value;}
    function unchanged(id){if(!observed.has(id)||storage.getItem(key(id))!==observed.get(id))throw Error('Original draft changed');}
    function save(review,fields){
      const id=review?.poolId,value={schema:1,owner,poolId:id,review,fields};
      if(!valid(value,id))throw Error('Invalid draft');if(!observed.has(id))read(id);unchanged(id);
      const raw=JSON.stringify(value);storage.setItem(key(id),raw);if(storage.getItem(key(id))!==raw)throw Error('Draft not conserved');observed.set(id,raw);return value;
    }
    function discard(id){if(!observed.has(id))read(id);unchanged(id);storage.removeItem(key(id));if(storage.getItem(key(id))!==null)throw Error('Draft not discarded');observed.set(id,null);}
    function finish(record){const draft=read(record.poolId);if(sameRequest(draft,record))discard(record.poolId);}
    return {key,read,save,discard,finish};
  }
  return {open,sameRequest};
}));
