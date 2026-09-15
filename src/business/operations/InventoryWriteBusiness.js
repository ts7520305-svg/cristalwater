const repository = require('../../dal/EquipmentStockRepository');
const products = require('../../dal/InventoryProductRepository');
const {normalizeProductName,normalizeUnit} = require('../../utils/stockNormalizer');
const {roleMatches} = require('../../utils/roles');
function fail(message,status=400){throw Object.assign(new Error(message),{status});}
function text(value,max=500){if(value==null)return '';if(typeof value!=='string'||value.length>max)fail('Texto inválido ou demasiado longo.');return value.trim();}
function number(value,label,optional=false){if(optional&&(value==null||value===''))return 0;if(!['string','number'].includes(typeof value)||String(value).trim()===''||!Number.isFinite(Number(value))||Number(value)<0)fail(`${label}: valor não negativo obrigatório.`);return Number(value);}
function id(value){if(value==null||value==='')return null;const n=number(value,'Identificador');if(!Number.isSafeInteger(n)||n<=0)fail('Identificador inválido.');return n;}
function item(raw){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))fail('Linha de produto inválida.');
  const productName=normalizeProductName(text(raw.productName||raw.name,160)),unit=normalizeUnit(text(raw.unit,24)||'KG'),quantity=number(raw.quantity,'Quantidade');
  if(!productName||quantity<=0)fail('Produto e quantidade positiva obrigatórios.');
  return {productName,unit,quantity,category:text(raw.category,80)||'CHEMICAL'};
}
async function once(user,requestId,kind,data,work){
  if(!roleMatches(user?.role,'ADMIN'))fail('Operação reservada à gestão.',403);
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(requestId||'')))fail('Identificador do pedido obrigatório.');
  const actor=`${user.role}:${user.id}`,fingerprint=JSON.stringify({actor,data}),sourceKey=`inventory-${kind}:${requestId}`;
  return repository.prisma.$transaction(async tx=>{
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${sourceKey}))::text`;
    const previous=await tx.operationalReminder.findUnique({where:{sourceKey}});
    if(previous){if(previous.metadata.fingerprint!==fingerprint)fail('Identificador já utilizado com outros dados.',409);return {...previous.metadata.result,idempotent:true};}
    const result=await work(tx,actor);
    await tx.operationalReminder.create({data:{sourceKey,title:'Movimento de inventário registado',dueDate:new Date(),isCompleted:true,metadata:{fingerprint,result:JSON.parse(JSON.stringify(result))}}});
    return result;
  },{maxWait:15000,timeout:15000});
}
async function purchase(user,body,upload={}){
  let raw=body.items;
  if(typeof raw==='string'){try{raw=JSON.parse(raw);}catch{fail('Linhas de produto inválidas.');}}
  if(!Array.isArray(raw)||!raw.length||raw.length>100)fail('Envie entre 1 e 100 linhas de produto.');
  const items=raw.map(row=>{const normalized=item(row),unitCost=number(row.unitCost,'Custo unitário',true);const totalCost=row.totalCost==null||row.totalCost===''?normalized.quantity*unitCost:number(row.totalCost,'Total da linha');if(!Number.isFinite(totalCost))fail('Total da linha inválido.');return {...normalized,unitCost,totalCost,sku:text(row.sku,100),brand:text(row.brand,100),lot:text(row.lot,100)||null,notes:text(row.notes)||null};}).sort((a,b)=>JSON.stringify([a.productName,a.unit]).localeCompare(JSON.stringify([b.productName,b.unit])));
  const supplierName=text(body.supplierName,160);if(!supplierName)fail('Fornecedor obrigatório.');
  const invoiceDate=text(body.invoiceDate,10);
  if(invoiceDate&&(!/^\d{4}-\d{2}-\d{2}$/.test(invoiceDate)||!Number.isFinite(Date.parse(invoiceDate))||new Date(invoiceDate).toISOString().slice(0,10)!==invoiceDate))fail('Data da fatura inválida.');
  const details={supplierName,invoiceNumber:text(body.invoiceNumber,100)||null,invoiceDate:invoiceDate||null,totalAmount:number(body.totalAmount,'Total',true),notes:text(body.notes)||null};
  return once(user,body.requestId,'purchase',{details,items,documentHash:upload.documentHash||null,documentName:upload.documentName||null},async(tx,actor)=>{
    const purchase=await tx.stockPurchase.create({data:{...details,invoiceDate:invoiceDate?new Date(invoiceDate):null,createdBy:actor,documentPath:upload.documentPath||null,documentName:upload.documentName||null}});
    for(const sku of [...new Set(items.map(row=>row.sku).filter(Boolean))].sort()){const key=`inventory-sku:${sku}`;await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))::text`;}
    const createdItems=[];
    for(const row of items){
      if(row.sku){const existing=await tx.inventoryProduct.findUnique({where:{sku:row.sku}});if(existing&&(existing.name!==row.productName||existing.unit!==row.unit))fail('O SKU pertence a outro produto ou unidade.',409);}
      const product=await products.upsertProduct(row,tx);
      const {sku,brand,...line}=row;
      createdItems.push(await tx.stockPurchaseItem.create({data:{...line,purchaseId:purchase.id,productId:product.id}}));
      await repository.adjustBalance(tx,{scope:'CENTRAL',...row,productId:product.id,delta:row.quantity});
      await tx.stockMovement.create({data:{movementType:'PURCHASE_IN',scopeTo:'CENTRAL',productId:product.id,productName:row.productName,category:row.category,unit:row.unit,quantity:row.quantity,purchaseId:purchase.id,documentPath:upload.documentPath||null,notes:`Entrada por fatura ${purchase.invoiceNumber||''}`.trim(),createdBy:actor}});
    }
    return {ok:true,purchase,items:createdItems};
  });
}
async function consume(user,body){
  const row=item(body),vehicleId=id(body.vehicleId),references={};
  for(const key of ['workGuideId','visitId','clientId','poolId','technicianId'])references[key]=id(body[key]);
  const notes=text(body.notes)||null;
  return once(user,body.requestId,'consume',{row,vehicleId,references,notes},async(tx,actor)=>{
    if(references.visitId){
      await tx.$queryRaw`SELECT id FROM "ServiceVisit" WHERE id=${references.visitId} FOR UPDATE`;
      const visit=await tx.serviceVisit.findUnique({where:{id:references.visitId}});
      if(!visit)fail('Visita não encontrada.',404);
      if(visit.endAt||['DONE','COMPLETED','CANCELLED','CANCELED','SKIPPED','ARCHIVED'].includes(visit.status))fail('Visita encerrada. Utilize a correção do registo.',409);
      for(const key of ['clientId','poolId','technicianId']){if(references[key]&&references[key]!==visit[key])fail('Os dados não correspondem à visita.',409);references[key]=visit[key];}
    }
    if(references.poolId){const pool=await tx.pool.findUnique({where:{id:references.poolId}});if(!pool||references.clientId&&pool.clientId!==references.clientId)fail('Piscina e cliente não correspondem.',409);references.clientId=pool.clientId;}
    if(references.clientId&&!await tx.client.findUnique({where:{id:references.clientId}}))fail('Cliente não encontrado.',404);
    if(vehicleId){const vehicle=await tx.vehicle.findUnique({where:{id:vehicleId}});if(!vehicle?.active||vehicle.deletedAt||vehicle.archiveStatus!=='ATIVO')fail('Viatura indisponível.',409);}
    if(references.technicianId){const technician=await tx.technician.findUnique({where:{id:references.technicianId}});if(!technician||vehicleId&&technician.vehicleId!==vehicleId)fail('Técnico e viatura não correspondem.',409);}
    if(references.workGuideId){const guide=await tx.workGuide.findUnique({where:{id:references.workGuideId}});if(!guide||guide.closedAt||guide.status!=='OPEN'||guide.vehicleId!==vehicleId)fail('Guia indisponível ou de outra viatura.',409);}
    const scope=vehicleId?'VEHICLE':'CENTRAL';
    await repository.adjustBalance(tx,{scope,vehicleId,...row,delta:-row.quantity});
    const movement=await tx.stockMovement.create({data:{movementType:'CONSUMPTION',scopeFrom:scope,vehicleId,...row,...references,notes,createdBy:actor}});
    return {ok:true,movement};
  });
}
module.exports={purchase,consume};
