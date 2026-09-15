const bcrypt = require("bcrypt");
const { prisma } = require("../src/prismaClient");

const BASE_URL = process.env.EQUIPMENT_STOCK_OS_BASE_URL || "http://127.0.0.1:3002/api";
const RUN_ID = `EQUIP-STOCK-${Date.now()}`;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new Error(`Non-JSON response from ${url}: ${text.slice(0, 200)}`);
  }
  const data = JSON.parse(text);
  return { response, data };
}

async function main() {
  const created = { technicianId: null, clientId: null, poolId: null, equipmentId: null, visitId: null };

  try {
    const technician = await prisma.technician.create({
      data: {
        name: `Tech ${RUN_ID}`,
        pin: String(Date.now()).slice(-6),
        role: "TECHNICIAN",
        active: true,
      },
    });
    created.technicianId = technician.id;
    const assignedVehicle=await prisma.vehicle.create({data:{plate:`ST-${Date.now()}`,active:true}});
    await prisma.technician.update({where:{id:technician.id},data:{vehicleId:assignedVehicle.id}});technician.vehicleId=assignedVehicle.id;


    const client = await prisma.client.create({
      data: {
        name: `Client ${RUN_ID}`,
        email: `equip-stock-${Date.now()}@example.com`,
        password: await bcrypt.hash("EquipStock123!", 10),
        active: true,
      },
    });
    created.clientId = client.id;

    const pool = await prisma.pool.create({
      data: {
        clientId: client.id,
        name: `Pool ${RUN_ID}`,
        active: true,
        type: "POOL",
      },
    });
    created.poolId = pool.id;

    const equipment = await prisma.poolEquipment.create({
      data: {
        poolId: pool.id,
        type: "PUMP",
        brand: "QA",
        model: "Q-100",
      },
    });
    created.equipmentId = equipment.id;

    const visit = await prisma.serviceVisit.create({
      data: {
        clientId: client.id,
        poolId: pool.id,
        technicianId: technician.id,
        technicianName: technician.name,
        status: "PLANNED",
        plannedDate: new Date(),
        date: new Date(),
      },
    });
    created.visitId = visit.id;

    const productName = "CLORO LIQUIDO QA";
    await prisma.inventoryProduct.create({
      data: {
        name: productName,
        sku: `SKU-${RUN_ID}`,
        unit: "L",
        minStockCentral: 5,
        minStockVehicle: 2,
        active: true,
      },
    });

    await prisma.stockBalance.create({
      data: {
        scope: "CENTRAL",
        productName,
        unit: "L",
        quantity: 20,
      },
    });

    const login = await fetchJson(`${BASE_URL}/technician-auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: technician.pin }),
    });
    assert(login.response.ok && login.data.ok, `tech login failed: ${JSON.stringify(login.data)}`);

    const headers = {
      Authorization: `Bearer ${login.data.token}`,
      "Content-Type": "application/json",
    };

    const inventory = await fetchJson(`${BASE_URL}/equipment-stock-os/equipment`, { headers });
    assert(inventory.response.ok && inventory.data.ok, "equipment inventory failed");

    const lifecycle = await fetchJson(`${BASE_URL}/equipment-stock-os/equipment/${equipment.id}/lifecycle`, { headers });
    assert(lifecycle.response.ok && lifecycle.data.ok, "equipment lifecycle failed");

    const maintenance = await fetchJson(`${BASE_URL}/equipment-stock-os/equipment/${equipment.id}/maintenance`, {
      method: "POST",
      headers,
      body: JSON.stringify({ message: "Inspecao preventiva", dueAt: new Date(Date.now() + 86400000).toISOString() }),
    });
    assert(maintenance.response.ok && maintenance.data.ok, "maintenance scheduling failed");

    const transfer = await fetchJson(`${BASE_URL}/equipment-stock-os/stock/transfers`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        vehicleId: technician.vehicleId || 1,
        direction: "CENTRAL_TO_VEHICLE",
        items: [{ productName, quantity: 6, unit: "L" }],
        notes: "Carga inicial",
      }),
    });
    assert(transfer.response.ok && transfer.data.ok, `transfer failed: ${JSON.stringify(transfer.data)}`);

    const check=require('node:assert/strict'),uuid=()=>require('node:crypto').randomUUID();
    const endpoint=`${BASE_URL}/equipment-stock-os/stock/transfers`;
    const send=body=>fetchJson(endpoint,{method:'POST',headers,body:JSON.stringify(body)});
    const payload={vehicleId:assignedVehicle.id,direction:'CENTRAL_TO_VEHICLE',items:[{productName,quantity:2,unit:'L'}],requestId:uuid()};
    const repeated=await Promise.all([send(payload),send(payload)]);repeated.forEach(reply=>check.equal(reply.response.status,200,JSON.stringify(reply.data)));check.equal(repeated[0].data.movements[0].id,repeated[1].data.movements[0].id);
    check.equal((await send({...payload,items:[{productName,quantity:3,unit:'L'}]})).response.status,409);
    check.equal((await send({...payload,requestId:uuid(),direction:'INVALID'})).response.status,400);
    check.equal((await send({...payload,requestId:uuid(),items:[null]})).response.status,400);
    check.equal((await send({...payload,requestId:uuid(),items:[{productName,quantity:true}]})).response.status,400);
    check.equal((await send({...payload,requestId:uuid(),items:[{productName,quantity:1,unit:'L'},{productName:'BAD',quantity:-1,unit:'L'}]})).response.status,400);
    const foreignVehicle=await prisma.vehicle.create({data:{plate:`FV-${Date.now()}`,active:true}});
    check.equal((await send({...payload,requestId:uuid(),vehicleId:foreignVehicle.id})).response.status,403);
    const raceProduct=`RACE ${RUN_ID}`;
    await prisma.stockBalance.create({data:{scope:'CENTRAL',productName:raceProduct,unit:'L',quantity:10}});
    const racePayload={...payload,items:[{productName:raceProduct,quantity:7,unit:'L'}]};
    const race=await Promise.all([send({...racePayload,requestId:uuid()}),send({...racePayload,requestId:uuid()})]);check.deepEqual(race.map(reply=>reply.response.status).sort(),[200,409]);
    const central=await prisma.stockBalance.findFirst({where:{scope:'CENTRAL',productName:raceProduct}}),vehicleBalance=await prisma.stockBalance.findFirst({where:{scope:'VEHICLE',vehicleId:assignedVehicle.id,productName:raceProduct}});check.equal(central.quantity,3);check.equal(vehicleBalance.quantity,7);
    const failedReturn=await send({...racePayload,requestId:uuid(),direction:'VEHICLE_TO_CENTRAL',items:[{productName:raceProduct,quantity:8,unit:'L'}]});check.equal(failedReturn.response.status,409);check.equal((await prisma.stockBalance.findUnique({where:{id:central.id}})).quantity,3);
    const returned=await send({...racePayload,requestId:uuid(),direction:'VEHICLE_TO_CENTRAL',items:[{productName:raceProduct,quantity:7,unit:'L'}]});check.equal(returned.response.status,200);check.equal((await prisma.stockBalance.findUnique({where:{id:central.id}})).quantity,10);
    const duplicateName=`DUPLICATE ${RUN_ID}`;await prisma.stockBalance.createMany({data:[{scope:'CENTRAL',productName:duplicateName,unit:'L',quantity:4},{scope:'CENTRAL',productName:duplicateName,unit:'L',quantity:6}]});
    const ambiguous=await send({...payload,requestId:uuid(),items:[{productName:duplicateName,quantity:1,unit:'L'}]});check.equal(ambiguous.response.status,409);check.match(ambiguous.data.error,/saldos duplicados/);check.equal(await prisma.stockMovement.count({where:{productName:duplicateName}}),0);
    console.log('PASS stock transfer replay, ownership, validation, concurrent balance conservation and failed-return rollback');
    const need=await prisma.operationalReminder.create({data:{sourceKey:`incomplete:${visit.id}:${uuid()}`,title:'QA falta de química',dueDate:new Date(),assignedToTechnicianId:technician.id,poolId:pool.id,metadata:{visitId:visit.id,reason:'CHEMICAL_MISSING',reportedAt:new Date(Date.now()-60000).toISOString(),chemicalShortage:{productName,quantity:10,unit:'L'}}}});
    const deliveryUrl=`${BASE_URL}/technician/chemical-shortages/${need.id}/deliveries`;
    const deliveryBody={requestId:uuid(),movementId:transfer.data.movements[0].id,quantity:2};
    const receive=body=>fetchJson(deliveryUrl,{method:'POST',headers,body:JSON.stringify(body)});
    const beforeDelivery=await prisma.stockBalance.findFirst({where:{scope:'VEHICLE',vehicleId:assignedVehicle.id,productName}});
    const choices=await fetchJson(deliveryUrl,{headers});check.equal(choices.response.status,200);check.ok(choices.data.rows.some(row=>row.id===deliveryBody.movementId));
    const confirmations=await Promise.all([receive(deliveryBody),receive(deliveryBody)]);confirmations.forEach(reply=>check.equal(reply.response.status,200,JSON.stringify(reply.data)));check.equal(confirmations[0].data.receipt.receivedAt,confirmations[1].data.receipt.receivedAt);
    check.equal((await receive({...deliveryBody,quantity:3})).response.status,409);
    check.equal((await receive({...deliveryBody,requestId:uuid(),quantity:true})).response.status,400);
    check.equal((await receive({...deliveryBody,requestId:uuid(),quantity:5})).response.status,409);
    check.equal((await receive({...deliveryBody,requestId:uuid(),movementId:returned.data.movements[0].id,quantity:1})).response.status,409);
    const competing=await Promise.all([receive({...deliveryBody,requestId:uuid(),quantity:3}),receive({...deliveryBody,requestId:uuid(),quantity:3})]);check.deepEqual(competing.map(r=>r.response.status).sort(),[200,409]);
    const list=await fetchJson(`${BASE_URL}/technician/chemical-shortages`,{headers});check.equal(list.data.rows.find(row=>row.shortageId===need.id).receivedQuantity,5);
    check.equal((await prisma.stockBalance.findUnique({where:{id:beforeDelivery.id}})).quantity,beforeDelivery.quantity);
    check.equal((await prisma.serviceVisit.findUnique({where:{id:visit.id}})).status,'PLANNED');
    const substitute=await prisma.technician.create({data:{name:'QA substitute '+RUN_ID,pin:'9'+String(Date.now()).slice(-7),active:true}});
    await prisma.serviceVisit.update({where:{id:visit.id},data:{technicianId:substitute.id}});
    check.equal((await receive({...deliveryBody,requestId:uuid(),quantity:1})).response.status,409);
    const managerLogin=await fetchJson(`${BASE_URL}/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:process.env.ADMIN_EMAIL,password:process.env.ADMIN_PASSWORD})});
    const managerHeaders={...headers,Authorization:`Bearer ${managerLogin.data.token}`};
    check.equal((await fetchJson(deliveryUrl,{method:'POST',headers:managerHeaders,body:JSON.stringify({...deliveryBody,requestId:uuid()})})).response.status,403);
    const managementList=await fetchJson(`${BASE_URL}/technician/chemical-shortages`,{headers:managerHeaders});const reassignedNeed=managementList.data.rows.find(row=>row.shortageId===need.id);check.equal(reassignedNeed.receivedQuantity,0);check.equal(reassignedNeed.receipts.length,2);check.ok(reassignedNeed.receipts.every(r=>r.currentAssignment===false));
    await prisma.serviceVisit.update({where:{id:visit.id},data:{technicianId:technician.id}});
    const loadBody={shortageId:need.id,vehicleId:assignedVehicle.id,requestId:uuid(),direction:'CENTRAL_TO_VEHICLE',items:[{productName,quantity:3,unit:'L'}]};
    const load=body=>fetchJson(endpoint,{method:'POST',headers:managerHeaders,body:JSON.stringify(body)});
    check.equal((await send(loadBody)).response.status,403);
    check.equal((await load({...loadBody,vehicleId:foreignVehicle.id})).response.status,409);
    check.equal((await load({...loadBody,items:[{productName:'OTHER PRODUCT',quantity:3,unit:'L'}]})).response.status,409);
    const loadRace=await Promise.all([load(loadBody),load({...loadBody,requestId:uuid()})]);check.deepEqual(loadRace.map(r=>r.response.status).sort(),[200,409]);
    const winner=loadRace.find(r=>r.response.status===200);
    const prepared=await fetchJson(`${BASE_URL}/technician/chemical-shortages`,{headers:managerHeaders});const preparedNeed=prepared.data.rows.find(row=>row.shortageId===need.id);check.equal(preparedNeed.preparedQuantity,3);check.equal(preparedNeed.committedQuantity,8);
    check.equal((await load({...loadBody,requestId:uuid(),items:[{productName,quantity:3,unit:'L'}]})).response.status,409);
    const finalLoad={...loadBody,requestId:uuid(),items:[{productName,quantity:2,unit:'L'}]};
    const duplicateLoad=await Promise.all([load(finalLoad),load(finalLoad)]);duplicateLoad.forEach(r=>check.equal(r.response.status,200,JSON.stringify(r.data)));check.equal(duplicateLoad[0].data.movements[0].id,duplicateLoad[1].data.movements[0].id);
    check.equal((await load({...finalLoad,items:[{productName,quantity:1,unit:'L'}]})).response.status,409);
    const loadedNeed=(await fetchJson(`${BASE_URL}/technician/chemical-shortages`,{headers:managerHeaders})).data.rows.find(row=>row.shortageId===need.id);check.equal(loadedNeed.committedQuantity,10);check.equal(loadedNeed.receivedQuantity,5);
    console.log('PASS linked warehouse load, administrator control, stale vehicle, concurrent limit, legacy receipt accounting and replay');
    const originalLoad=winner.data.movements[0];
    check.equal((await receive({...deliveryBody,requestId:uuid(),movementId:originalLoad.id,quantity:3})).response.status,200);
    const returnBody={vehicleId:assignedVehicle.id,returnOfMovementId:originalLoad.id,direction:'VEHICLE_TO_CENTRAL',requestId:uuid(),items:[{productName,quantity:2,unit:'L'}]};
    check.equal((await send(returnBody)).response.status,403);
    const warehouseBefore=await prisma.stockBalance.findFirst({where:{scope:'CENTRAL',productName}}),vanBefore=await prisma.stockBalance.findFirst({where:{scope:'VEHICLE',vehicleId:assignedVehicle.id,productName}});
    const partialReturns=await Promise.all([load(returnBody),load(returnBody)]);partialReturns.forEach(r=>check.equal(r.response.status,200,JSON.stringify(r.data)));check.equal(partialReturns[0].data.movements[0].id,partialReturns[1].data.movements[0].id);
    check.equal((await prisma.stockBalance.findUnique({where:{id:warehouseBefore.id}})).quantity,warehouseBefore.quantity+2);check.equal((await prisma.stockBalance.findUnique({where:{id:vanBefore.id}})).quantity,vanBefore.quantity-2);
    const afterReturn=(await fetchJson(`${BASE_URL}/technician/chemical-shortages`,{headers})).data.rows.find(r=>r.shortageId===need.id);check.equal(afterReturn.preparedQuantity,3);check.equal(afterReturn.receivedQuantity,6);check.equal(afterReturn.committedQuantity,8);check.equal(afterReturn.returnedQuantity,2);check.ok(afterReturn.receipts.some(r=>r.movementId===originalLoad.id&&r.quantity===3));
    check.equal((await load({...returnBody,items:[{productName,quantity:1,unit:'L'}]})).response.status,409);
    check.equal((await load({...returnBody,requestId:uuid()})).response.status,409);
    const replacement=await load({...loadBody,requestId:uuid(),items:[{productName,quantity:2,unit:'L'}]});check.equal(replacement.response.status,200);
    const finalReturns=await Promise.all([load({...returnBody,requestId:uuid(),items:[{productName,quantity:1,unit:'L'}]}),load({...returnBody,requestId:uuid(),items:[{productName,quantity:1,unit:'L'}]})]);check.deepEqual(finalReturns.map(r=>r.response.status).sort(),[200,409]);
    const returnedOptions=await fetchJson(deliveryUrl,{headers});check.ok(returnedOptions.data.rows.every(r=>r.id!==originalLoad.id));
    check.equal((await receive({...deliveryBody,requestId:uuid(),movementId:originalLoad.id,quantity:1})).response.status,409);
    const currentBalance=await prisma.stockBalance.findUnique({where:{id:vanBefore.id}}),currentCentral=await prisma.stockBalance.findUnique({where:{id:warehouseBefore.id}});
    await prisma.stockBalance.update({where:{id:vanBefore.id},data:{quantity:0}});
    check.equal((await load({...returnBody,requestId:uuid(),returnOfMovementId:replacement.data.movements[0].id,items:[{productName,quantity:1,unit:'L'}]})).response.status,409);
    check.equal((await prisma.stockBalance.findUnique({where:{id:warehouseBefore.id}})).quantity,currentCentral.quantity);
    await prisma.stockBalance.update({where:{id:vanBefore.id},data:{quantity:currentBalance.quantity}});
    await prisma.vehicle.update({where:{id:assignedVehicle.id},data:{active:false,archiveStatus:'ARQUIVADO'}});
    const inactiveReturn={...returnBody,requestId:uuid(),returnOfMovementId:replacement.data.movements[0].id,items:[{productName,quantity:1,unit:'L'}]};
    check.equal((await load(inactiveReturn)).response.status,200);
    check.equal((await load({...loadBody,requestId:uuid(),items:[{productName,quantity:1,unit:'L'}]})).response.status,400);
    await prisma.vehicle.update({where:{id:assignedVehicle.id},data:{active:true,archiveStatus:'ATIVO'}});
    console.log('PASS linked partial returns, immutable receipt history, replacement load, concurrent limits and rollback on insufficient vehicle stock');

    await prisma.technician.update({where:{id:technician.id},data:{vehicleId:foreignVehicle.id}});
    const changedVehicleList=await fetchJson(`${BASE_URL}/technician/chemical-shortages`,{headers});check.equal(changedVehicleList.data.rows.find(row=>row.shortageId===need.id).receivedQuantity,0);
    check.equal((await receive({...deliveryBody,requestId:uuid(),quantity:1})).response.status,409);
    await prisma.technician.update({where:{id:technician.id},data:{vehicleId:assignedVehicle.id}});
    const otherVisit=await prisma.serviceVisit.create({data:{clientId:client.id,poolId:pool.id,technicianId:technician.id,status:'PLANNED',plannedDate:new Date()}});
    const otherNeed=await prisma.operationalReminder.create({data:{sourceKey:`incomplete:${otherVisit.id}:${uuid()}`,title:'QA quantidade por confirmar',dueDate:new Date(),metadata:{visitId:otherVisit.id,reportedAt:new Date(Date.now()-60000).toISOString(),chemicalShortage:{productName,quantity:null,unit:'L'}}}});
    const otherReceive=body=>fetchJson(`${BASE_URL}/technician/chemical-shortages/${otherNeed.id}/deliveries`,{method:'POST',headers,body:JSON.stringify(body)});
    const otherOptions=await fetchJson(`${BASE_URL}/technician/chemical-shortages/${otherNeed.id}/deliveries`,{headers});check.ok(otherOptions.data.rows.every(m=>m.id!==winner.data.movements[0].id));
    check.equal((await otherReceive({...deliveryBody,requestId:uuid(),movementId:winner.data.movements[0].id,quantity:1})).response.status,409);
    check.equal((await otherReceive({...deliveryBody,requestId:uuid(),quantity:2})).response.status,409);
    check.equal((await otherReceive({...deliveryBody,requestId:uuid(),quantity:1})).response.status,200);
    const unknownList=await fetchJson(`${BASE_URL}/technician/chemical-shortages`,{headers});const unknown=unknownList.data.rows.find(row=>row.shortageId===otherNeed.id);check.equal(unknown.quantity,null);check.equal(unknown.receivedQuantity,1);
    await prisma.operationalReminder.update({where:{id:otherNeed.id},data:{isCompleted:true}});
    await prisma.operationalReminder.update({where:{id:need.id},data:{isCompleted:true}});
    check.equal((await receive({...deliveryBody,requestId:uuid(),quantity:1})).response.status,409);
    check.equal((await load({...inactiveReturn,requestId:uuid()})).response.status,200);
    console.log('PASS chemical delivery options, partial receipt, concurrent replay, allocation limit, unchanged stock, reassignment and closed need');


    const unavailable=await fetchJson(`${BASE_URL}/equipment-stock-os/visits/${visit.id}/consume`,{method:'POST',headers,body:JSON.stringify({vehicleId:assignedVehicle.id,items:[{productName,quantity:100000,unit:'L'}]})});check.equal(unavailable.response.status,409);
    const consumeUrl=`${BASE_URL}/equipment-stock-os/visits/${visit.id}/consume`,consumeBody={vehicleId:assignedVehicle.id,requestId:uuid(),items:[{productName,quantity:1,unit:'L'}]};
    const recordConsumption=body=>fetchJson(consumeUrl,{method:'POST',headers,body:JSON.stringify(body)});
    check.equal((await recordConsumption({...consumeBody,vehicleId:foreignVehicle.id})).response.status,403);
    check.equal((await recordConsumption({...consumeBody,items:[{productName,quantity:true,unit:'L'}]})).response.status,400);
    check.equal((await recordConsumption({...consumeBody,items:[...consumeBody.items,null]})).response.status,400);
    await prisma.serviceVisit.update({where:{id:visit.id},data:{technicianId:substitute.id}});
    check.equal((await recordConsumption(consumeBody)).response.status,403);
    await prisma.serviceVisit.update({where:{id:visit.id},data:{technicianId:technician.id}});
    const beforeConsumption=await prisma.stockBalance.findFirst({where:{scope:'VEHICLE',vehicleId:assignedVehicle.id,productName}});
    const replayConsumption=await Promise.all([recordConsumption(consumeBody),recordConsumption(consumeBody)]);replayConsumption.forEach(reply=>check.equal(reply.response.status,200,JSON.stringify(reply.data)));check.equal(replayConsumption[0].data.consumed[0].id,replayConsumption[1].data.consumed[0].id);
    check.equal((await prisma.stockBalance.findUnique({where:{id:beforeConsumption.id}})).quantity,beforeConsumption.quantity-1);
    check.equal((await recordConsumption({...consumeBody,items:[{productName,quantity:2,unit:'L'}]})).response.status,409);
    await prisma.serviceVisit.update({where:{id:visit.id},data:{status:'DONE',endAt:new Date()}});
    check.equal((await recordConsumption({...consumeBody,requestId:uuid()})).response.status,409);
    check.equal((await recordConsumption(consumeBody)).response.status,200);
    await prisma.serviceVisit.update({where:{id:visit.id},data:{status:'PLANNED',endAt:null}});
    console.log('PASS consumption authorization, entire-batch validation, concurrent idempotency and closed-visit protection');
    const legacyProduct=`LEGACY ${RUN_ID}`;await prisma.stockBalance.create({data:{scope:'CENTRAL',productName:legacyProduct,unit:'L',quantity:10}});
    const legacyBody={vehicleId:assignedVehicle.id,requestId:uuid(),items:[{productName:legacyProduct,unit:'L',quantity:7}],createdBy:'SPOOFED'};
    const legacySend=body=>fetchJson(`${BASE_URL}/inventory/transfer-to-vehicle`,{method:'POST',headers:managerHeaders,body:JSON.stringify(body)});
    for(const change of [{unit:['L']},{unit:{}},{unit:'!!!'},{productName:[legacyProduct]},{productName:false,name:legacyProduct}]){
      const invalid=await legacySend({...legacyBody,requestId:uuid(),items:[{...legacyBody.items[0],...change}]});
      check.equal(invalid.response.status,400,`Malformed transfer accepted: ${JSON.stringify(change)}`);
    }
    for(const change of [{vehicleId:[assignedVehicle.id]},{vehicleId:{toString:null}},{requestId:[uuid()]},{items:null}])check.equal((await legacySend({...legacyBody,...change})).response.status,400);
    check.equal((await prisma.stockBalance.findFirst({where:{scope:'CENTRAL',productName:legacyProduct}})).quantity,10);
    check.equal(await prisma.stockMovement.count({where:{productName:legacyProduct}}),0);
    const sharedRace=await Promise.all([legacySend(legacyBody),load({...legacyBody,requestId:uuid()})]);check.deepEqual(sharedRace.map(r=>r.response.status).sort(),[200,409]);
    check.equal((await legacySend({...legacyBody,items:[null]})).response.status,400);
    const repeatLegacy={...legacyBody,requestId:uuid(),items:[{productName:legacyProduct,unit:'L',quantity:1}]};const legacyReplies=await Promise.all([legacySend(repeatLegacy),legacySend(repeatLegacy)]);legacyReplies.forEach(r=>check.equal(r.response.status,200,JSON.stringify(r.data)));check.equal(legacyReplies[0].data.movements[0].id,legacyReplies[1].data.movements[0].id);check.notEqual(legacyReplies[0].data.movements[0].createdBy,'SPOOFED');
    const legacyVan=await prisma.stockBalance.findFirst({where:{scope:'VEHICLE',vehicleId:assignedVehicle.id,productName:legacyProduct}});check.equal(legacyVan.quantity,8);
    const countUrl=`${BASE_URL}/inventory/audit-count`,countBody={vehicleId:assignedVehicle.id,productName:legacyProduct,unit:'L',expectedQuantity:8,physicalQuantity:4,requestId:uuid(),createdBy:'SPOOFED'};
    const count=body=>fetchJson(countUrl,{method:'POST',headers:managerHeaders,body:JSON.stringify(body)});
    check.equal((await count({...countBody,physicalQuantity:''})).response.status,400);check.equal((await count({...countBody,expectedQuantity:'  '})).response.status,400);check.equal((await count({...countBody,physicalQuantity:-1})).response.status,400);check.equal((await count({...countBody,expectedQuantity:7})).response.status,409);check.equal((await count({...countBody,physicalQuantity:true})).response.status,400);
    const countMovementFilter={vehicleId:assignedVehicle.id,productName:legacyProduct,movementType:{startsWith:'AUDIT_COUNT_'}};
    const movementsBeforeCount=await prisma.stockMovement.count({where:countMovementFilter});
    for(const productName of [{},[],['CLORO'],'!!!','X'.repeat(161),false,0])check.equal((await count({...countBody,productName,name:legacyProduct})).response.status,400);
    for(const unit of [{},[], '!!!', 'X'.repeat(25),true,0])check.equal((await count({...countBody,unit})).response.status,400);
    for(const vehicleId of [true,[assignedVehicle.id],{}])check.equal((await count({...countBody,vehicleId})).response.status,400);
    for(const requestId of [[countBody.requestId],{},true])check.equal((await count({...countBody,requestId})).response.status,400);
    for(const field of ['vehicleId','physicalQuantity','expectedQuantity'])check.equal((await count({...countBody,[field]:{toString:null}})).response.status,400);
    check.equal(await prisma.stockMovement.count({where:countMovementFilter}),movementsBeforeCount);
    check.equal((await prisma.stockBalance.findUnique({where:{id:legacyVan.id}})).quantity,8);
    const countReplies=await Promise.all([count({...countBody,productName:'  '+legacyProduct.toLowerCase()+'  ',unit:'l'}),count(countBody)]);countReplies.forEach(r=>check.equal(r.response.status,200,JSON.stringify(r.data)));check.equal(countReplies[0].data.movement.id,countReplies[1].data.movement.id);check.equal(countReplies[0].data.digitalQuantity,8);check.equal(countReplies[0].data.desvio,-4);check.equal(countReplies[0].data.movement.productName,legacyProduct);check.equal(countReplies[0].data.movement.unit,'L');check.notEqual(countReplies[0].data.movement.createdBy,'SPOOFED');
    const savedCount=await prisma.operationalReminder.findUnique({where:{sourceKey:`stock-count:${countBody.requestId}`}});
    const legacyCountFingerprint={...JSON.parse(savedCount.metadata.fingerprint),productName:legacyProduct.toLowerCase(),unit:'l'};
    await prisma.operationalReminder.update({where:{id:savedCount.id},data:{metadata:{...savedCount.metadata,fingerprint:JSON.stringify(legacyCountFingerprint)}}});
    try{const replay=await count({...countBody,productName:legacyProduct.toLowerCase(),unit:'l'});check.equal(replay.response.status,200);check.equal(replay.data.movement.id,countReplies[0].data.movement.id);}
    finally{await prisma.operationalReminder.update({where:{id:savedCount.id},data:{metadata:savedCount.metadata}});}
    check.equal((await count({...countBody,physicalQuantity:5})).response.status,409);
    const aliasReplay=await count({...countBody,productName:undefined,name:legacyProduct});check.equal(aliasReplay.response.status,200);check.equal(aliasReplay.data.movement.id,countReplies[0].data.movement.id);
    const countBusiness=require('../src/business/operations/InventoryCountBusiness');
    const countActor={role:'ADMIN',id:countReplies[0].data.movement.createdBy.split(':')[1]};
    const directReplay=await countBusiness.count(countActor,{...countBody,productName:'  '+legacyProduct.toLowerCase()+'  ',unit:'l'});
    check.equal(directReplay.ok,true);check.equal(directReplay.movement.id,countReplies[0].data.movement.id);
    check.equal(await prisma.stockMovement.count({where:countMovementFilter}),movementsBeforeCount+1);
    check.equal((await prisma.stockBalance.findUnique({where:{id:legacyVan.id}})).quantity,4);
    const directBody={...countBody,expectedQuantity:4,physicalQuantity:4,requestId:uuid()};
    const directCount=await countBusiness.count(countActor,{...directBody,productName:'  '+legacyProduct.toLowerCase()+'  ',unit:'l'});
    check.equal(directCount.ok,true);check.equal(directCount.movement.productName,legacyProduct);check.equal(directCount.movement.unit,'L');
    check.equal(directCount.movement.quantity,0);check.equal(directCount.movement.movementType,'AUDIT_COUNT_CONFIRMED');
    const directCountReplay=await countBusiness.count(countActor,directBody);
    check.equal(directCountReplay.idempotent,true);check.equal(directCountReplay.movement.id,directCount.movement.id);
    check.equal(await prisma.stockMovement.count({where:countMovementFilter}),movementsBeforeCount+2);
    const countRace=await Promise.all([count({...countBody,requestId:uuid(),expectedQuantity:4,physicalQuantity:5}),recordConsumption({...consumeBody,requestId:uuid(),items:[{productName:legacyProduct,unit:'L',quantity:1}]})]);check.equal(countRace[1].response.status,200);check.ok([200,409].includes(countRace[0].response.status));check.equal((await prisma.stockBalance.findUnique({where:{id:legacyVan.id}})).quantity,countRace[0].response.status===200?4:3);
    console.log('PASS legacy/new transfer conservation, trusted actor, safe physical counts, stale count rejection and concurrent consumption');

    const syncProduct=`SYNC ${RUN_ID}`;
    const syncBalance=await prisma.stockBalance.create({data:{scope:'VEHICLE',vehicleId:assignedVehicle.id,productName:syncProduct,unit:'L',quantity:10}});
    const syncVisit=await prisma.serviceVisit.create({data:{clientId:client.id,poolId:pool.id,technicianId:technician.id,status:'IN_PROGRESS',startAt:new Date(),plannedDate:new Date(),date:new Date()}});
    const syncBody={id:syncVisit.id,vehicleId:assignedVehicle.id,ph:7.2,consumos:[{productName:syncProduct,quantity:2,unit:'L'}]};
    const sync=async body=>{const reply=await fetchJson(`${BASE_URL}/sync/text`,{method:'POST',headers,body:JSON.stringify({visits:[body]})});check.equal(reply.response.status,200);return reply.data.results[0];};
    const syncReplies=await Promise.all([sync(syncBody),sync(syncBody)]);
    syncReplies.forEach(r=>check.equal(r.status,'SYNCED',JSON.stringify(r)));check.equal(syncReplies.filter(r=>r.idempotent).length,1);
    const balanceNow=async()=>(await prisma.stockBalance.findUnique({where:{id:syncBalance.id}})).quantity;
    check.equal(await balanceNow(),8);check.equal((await prisma.serviceVisit.findUnique({where:{id:syncVisit.id}})).status,'IN_PROGRESS');
    const readingReply=await sync({...syncBody,ph:7.3,expectedSyncHash:syncReplies[0].syncHash});check.equal(readingReply.status,'SYNCED',JSON.stringify(readingReply));check.equal(await balanceNow(),8);
    const moreBody={...syncBody,ph:7.3,consumos:[{productName:syncProduct,quantity:3,unit:'L'}],expectedSyncHash:readingReply.syncHash};
    const moreReply=await sync(moreBody);check.equal(moreReply.status,'SYNCED',JSON.stringify(moreReply));check.equal(await balanceNow(),7);
    check.equal((await sync({...moreBody,consumos:[{productName:syncProduct,quantity:4,unit:'L'}]})).status,'FAILED');check.equal(await balanceNow(),7);
    check.equal((await sync(syncBody)).idempotent,true);check.equal(await balanceNow(),7);
    const lessReply=await sync({...moreBody,consumos:[{productName:syncProduct,quantity:1,unit:'L'}],expectedSyncHash:moreReply.syncHash});check.equal(lessReply.status,'SYNCED',JSON.stringify(lessReply));check.equal(await balanceNow(),9);
    for(const changes of [{vehicleId:foreignVehicle.id,consumos:[{productName:syncProduct,quantity:2,unit:'L'}]},{consumos:[null]},{consumos:[{productName:syncProduct,quantity:true,unit:'L'}]},{consumos:[{productName:syncProduct,quantity:99,unit:'L'}]},{ph:true}])check.equal((await sync({...syncBody,...changes,expectedSyncHash:lessReply.syncHash})).status,'FAILED');
    check.equal(await balanceNow(),9);
    const missingProduct=`MISSING ${RUN_ID}`;
    check.equal((await sync({...syncBody,expectedSyncHash:lessReply.syncHash,consumos:[{productName:syncProduct,quantity:2,unit:'L'},{productName:missingProduct,quantity:1,unit:'L'}]})).status,'FAILED');check.equal(await balanceNow(),9);
    const backToThree=await sync({...moreBody,expectedSyncHash:lessReply.syncHash});check.equal(backToThree.status,'SYNCED',JSON.stringify(backToThree));check.equal(await balanceNow(),7);
    const backToOne=await sync({...moreBody,consumos:[{productName:syncProduct,quantity:1,unit:'L'}],expectedSyncHash:backToThree.syncHash});check.equal(backToOne.status,'SYNCED',JSON.stringify(backToOne));check.equal(await balanceNow(),9);
    await prisma.serviceVisit.update({where:{id:syncVisit.id},data:{technicianId:substitute.id}});check.equal((await sync(syncBody)).status,'FAILED');
    await prisma.serviceVisit.update({where:{id:syncVisit.id},data:{technicianId:technician.id,status:'DONE',endAt:new Date()}});
    check.equal((await sync({...syncBody,ph:7.4,expectedSyncHash:lessReply.syncHash})).status,'FAILED');check.equal((await sync(syncBody)).idempotent,true);
    const syncMoves=await prisma.stockMovement.findMany({where:{visitId:syncVisit.id,movementType:{startsWith:'V22_SYNC'}}});check.equal(syncMoves.length,5);check.ok(syncMoves.every(m=>m.createdBy.startsWith('TECHNICIAN:')));
    const raceVisit=await prisma.serviceVisit.create({data:{clientId:client.id,poolId:pool.id,technicianId:technician.id,status:'PLANNED',plannedDate:new Date(),date:new Date()}});
    const syncRace=await Promise.all([sync({...syncBody,id:raceVisit.id,consumos:[{productName:syncProduct,quantity:7,unit:'L'}]}),recordConsumption({...consumeBody,requestId:uuid(),items:[{productName:syncProduct,quantity:7,unit:'L'}]})]);
    check.equal(Number(syncRace[0].status==='SYNCED')+Number(syncRace[1].response.status===200),1);check.equal(await balanceNow(),2);
    const oldVisit=await prisma.serviceVisit.create({data:{clientId:client.id,poolId:pool.id,technicianId:technician.id,status:'SYNCED',plannedDate:new Date(),date:new Date(),chemicalsJson:{lastSyncHash:'old-hash',consumos:[{productName:syncProduct,quantity:2,unit:'L'}]}}});
    check.equal((await sync({...syncBody,id:oldVisit.id,expectedSyncHash:'old-hash'})).status,'FAILED');
    const oldRead=await sync({id:oldVisit.id,ph:7.5,expectedSyncHash:'old-hash'});check.equal(oldRead.status,'SYNCED',JSON.stringify(oldRead));check.equal((await prisma.serviceVisit.findUnique({where:{id:oldVisit.id}})).status,'PLANNED');check.equal(await balanceNow(),2);
    const legacyVisit=await prisma.visit.create({data:{id:1900000001,clientId:client.id,poolId:pool.id,technicianId:technician.id,status:'PLANNED'}});
    const legacySync=await sync({...syncBody,id:legacyVisit.id,consumos:[{productName:syncProduct,quantity:1,unit:'L'}]});check.equal(legacySync.status,'SYNCED',JSON.stringify(legacySync));check.equal(legacySync.kind,'Visit');check.equal(await balanceNow(),1);
    const legacyRead=await sync({id:legacyVisit.id,chlorine:1.5,expectedSyncHash:legacySync.syncHash});check.equal(legacyRead.status,'SYNCED',JSON.stringify(legacyRead));check.equal(await balanceNow(),1);
    const legacyState=await prisma.operationalReminder.findUnique({where:{sourceKey:`legacy-sync-state:Visit:${legacyVisit.id}`}});check.equal(legacyState.metadata.readings.ph,7.2);check.equal(legacyState.metadata.readings.chlorine,1.5);check.equal((await prisma.visit.findUnique({where:{id:legacyVisit.id}})).status,'PLANNED');
    check.equal((await sync({id:legacyVisit.id,consumos:[],expectedSyncHash:legacyRead.syncHash})).status,'SYNCED');check.equal(await balanceNow(),2);
    const nullPayload=await sync(null);check.equal(nullPayload.status,'FAILED');
    const tooMany=await fetchJson(`${BASE_URL}/sync/text`,{method:'POST',headers,body:JSON.stringify({visits:Array(101).fill(syncBody)})});check.equal(tooMany.response.status,400);
    console.log('PASS legacy sync concurrent replay, readings without extra debit, versioned corrections, stale/closed/foreign rejection, atomic rollback and shared stock conservation');

    const entryProduct=`ENTRY ${RUN_ID}`,entryBody={supplierName:'QA supplier',invoiceNumber:RUN_ID,requestId:uuid(),items:[{productName:entryProduct,unit:'L',quantity:10,unitCost:2}],createdBy:'SPOOFED'};
    const purchase=body=>fetchJson(`${BASE_URL}/inventory/purchases`,{method:'POST',headers:managerHeaders,body:JSON.stringify(body)});
    const entries=await Promise.all([purchase(entryBody),purchase(entryBody)]);entries.forEach(r=>check.equal(r.response.status,201,JSON.stringify(r.data)));check.equal(entries[0].data.purchase.id,entries[1].data.purchase.id);check.notEqual(entries[0].data.purchase.createdBy,'SPOOFED');check.equal(await prisma.stockPurchase.count({where:{invoiceNumber:RUN_ID}}),1);
    check.equal((await purchase({...entryBody,items:[{...entryBody.items[0],quantity:11}]})).response.status,409);
    for(const bad of [[...entryBody.items,null],[{...entryBody.items[0],quantity:-1}],[{...entryBody.items[0],quantity:true}]])check.equal((await purchase({...entryBody,requestId:uuid(),items:bad})).response.status,400);
    check.equal((await purchase({...entryBody,requestId:uuid(),invoiceDate:'2026-02-30'})).response.status,400);
    check.equal(await prisma.stockPurchase.count({where:{invoiceNumber:RUN_ID}}),1);
    const manualBody={productName:entryProduct,unit:'L',quantity:1,requestId:uuid(),createdBy:'SPOOFED'};
    const manual=body=>fetchJson(`${BASE_URL}/inventory/consume`,{method:'POST',headers:managerHeaders,body:JSON.stringify(body)});
    const unitGuardProduct=`UNIT GUARD ${RUN_ID}`;
    const unitGuard=await prisma.stockBalance.create({data:{scope:'CENTRAL',productName:unitGuardProduct,unit:'KG',quantity:10}});
    for(const unit of ['!!!',{},['KG'],false]){
      check.equal((await purchase({...entryBody,requestId:uuid(),items:[{productName:unitGuardProduct,unit,quantity:1}]})).response.status,400);
      check.equal((await manual({...manualBody,requestId:uuid(),productName:unitGuardProduct,unit})).response.status,400);
    }
    check.equal((await prisma.stockBalance.findUnique({where:{id:unitGuard.id}})).quantity,10);
    check.equal(await prisma.stockMovement.count({where:{productName:unitGuardProduct}}),0);
    for(const requestId of [[uuid()],{},true]){
      check.equal((await purchase({...entryBody,requestId})).response.status,400);
      check.equal((await manual({...manualBody,requestId})).response.status,400);
    }
    for(const invalidBody of [null,[]]){
      const business=require('../src/business/operations/InventoryWriteBusiness');
      await check.rejects(()=>business.purchase({role:'ADMIN',id:1},invalidBody),error=>error.status===400);
      await check.rejects(()=>business.consume({role:'ADMIN',id:1},invalidBody),error=>error.status===400);
    }
    const manualReplies=await Promise.all([manual(manualBody),manual(manualBody)]);manualReplies.forEach(r=>check.equal(r.response.status,200,JSON.stringify(r.data)));check.equal(manualReplies[0].data.movement.id,manualReplies[1].data.movement.id);check.notEqual(manualReplies[0].data.movement.createdBy,'SPOOFED');
    for(const bad of [{quantity:true},{quantity:-1},{requestId:undefined},{visitId:syncVisit.id},{workGuideId:1900000000}])check.ok([400,409].includes((await manual({...manualBody,requestId:uuid(),...bad})).response.status));
    const manualRace=await Promise.all([manual({...manualBody,requestId:uuid(),quantity:8}),load({vehicleId:assignedVehicle.id,requestId:uuid(),items:[{productName:entryProduct,quantity:8,unit:'L'}]})]);check.deepEqual(manualRace.map(r=>r.response.status).sort(),[200,409]);
    check.equal((await prisma.stockBalance.findFirst({where:{scope:'CENTRAL',productName:entryProduct}})).quantity,1);
    console.log('PASS purchase/manual consumption replay, entire-line validation, immutable actor, invalid references and concurrent stock conservation');

    const suggestions = await fetchJson(`${BASE_URL}/equipment-stock-os/visits/${visit.id}/suggestions`, { headers });
    assert(suggestions.response.ok && suggestions.data.ok, "visit suggestion failed");

    const consume = await fetchJson(`${BASE_URL}/equipment-stock-os/visits/${visit.id}/consume`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        vehicleId: technician.vehicleId || 1,
        items: [{ productName, quantity: 2, unit: "L" }],
      }),
    });
    assert(consume.response.ok && consume.data.ok, `consume failed: ${JSON.stringify(consume.data)}`);

    const alerts = await fetchJson(`${BASE_URL}/equipment-stock-os/stock/alerts`, { headers });
    assert(alerts.response.ok && alerts.data.ok, "stock alerts failed");

    const dashboard = await fetchJson(`${BASE_URL}/equipment-stock-os/dashboard`, { headers });
    assert(dashboard.response.ok && dashboard.data.ok, "dashboard failed");

    const customerReport = await fetchJson(`${BASE_URL}/equipment-stock-os/customer-report/${client.id}`, { headers });
    assert(customerReport.response.ok && customerReport.data.ok, "customer report failed");

    console.log(JSON.stringify({
      ok: true,
      service: "EquipmentStockOsOperationalSmoke",
      equipmentRows: inventory.data.equipment.length,
      movementRows: dashboard.data.dashboard.lastMovements.length,
      alertRows: alerts.data.alerts.length,
      consumedRows: consume.data.consumed.length,
    }, null, 2));
  } finally {
    if (created.visitId) await prisma.serviceVisit.deleteMany({ where: { id: created.visitId } }).catch(() => null);
    if (created.equipmentId) await prisma.poolEquipment.deleteMany({ where: { id: created.equipmentId } }).catch(() => null);
    if (created.poolId) await prisma.pool.deleteMany({ where: { id: created.poolId } }).catch(() => null);
    if (created.clientId) {
      await prisma.notification.deleteMany({ where: { clientId: created.clientId } }).catch(() => null);
      await prisma.client.deleteMany({ where: { id: created.clientId } }).catch(() => null);
    }
    if (created.technicianId) await prisma.technician.deleteMany({ where: { id: created.technicianId } }).catch(() => null);
    await prisma.stockMovement.deleteMany({ where: { createdBy: { in: ["TECHNICIAN_FIELD", "system"] }, notes: { contains: "Carga inicial" } } }).catch(() => null);
    await prisma.stockBalance.deleteMany({ where: { productName: "CLORO LIQUIDO QA" } }).catch(() => null);
    await prisma.inventoryProduct.deleteMany({ where: { name: "CLORO LIQUIDO QA" } }).catch(() => null);
    await prisma.technicalHistory.deleteMany({ where: { type: { in: ["EQUIPMENT_MAINTENANCE_SCHEDULED", "EQUIPMENT_STOCK_CONSUMPTION"] } } }).catch(() => null);
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, service: "EquipmentStockOsOperationalSmoke", error: error.message }, null, 2));
  process.exit(1);
});
