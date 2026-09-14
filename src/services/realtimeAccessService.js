const auth = require('../middlewares/authMiddleware');
const {normalizeRole} = require('../utils/roles');
const {validateJwtPrincipal} = require('../utils/jwtPrincipalGuard');
const {prisma} = require('../prismaClient');
function installRealtimeAccess(io) {
  io.use((socket,next)=>{
    const token = socket.handshake.auth?.token;
    const req = {headers:{authorization:token ? `Bearer ${token}` : socket.handshake.headers.authorization},originalUrl:'/api/realtime',method:'GET'};
    const res = {status(){return this},json(){next(new Error('Sessão inválida'))}};
    auth()(req,res,()=>{socket.data.user=req.user;next()});
  });
  io.on('connection',socket=>{
    const user=socket.data.user, role=normalizeRole(user.role);
    const clientId=role==='CLIENT'?Number(user.clientId||user.id):null;
    if(role==='ADMIN'||role==='TEAM_LEADER')socket.join('role:MANAGEMENT');
    if(clientId)socket.join(`client_${clientId}`);
    if(role==='TECHNICIAN')socket.join(`technician_${user.technicianId||user.id}`);
    const canAccessClient=id=>Number.isSafeInteger(Number(id))&&Number(id)>0&&(role==='ADMIN'||role==='TEAM_LEADER'||Number(id)===clientId);
    const live = async()=>{
      try { if(user.exp*1000<=Date.now()||!(await validateJwtPrincipal(user)).ok){socket.disconnect(true);return false}return true; }
      catch {socket.disconnect(true);return false;}
    };
    const timer=setInterval(live,60000);timer.unref();socket.on('disconnect',()=>clearInterval(timer));
    socket.on('joinClient',async id=>{if(await live()&&canAccessClient(id))socket.join(`client_${Number(id)}`)});
    for(const event of ['typing','stopTyping'])socket.on(event,async data=>{
      if(await live()&&canAccessClient(data?.clientId))io.to(`client_${Number(data.clientId)}`).emit(event,{clientId:Number(data.clientId),senderType:role});
    });
    socket.on('userOnline',async data=>{
      if(!await live())return;
      io.to('role:MANAGEMENT').emit('presenceUpdate',{userId:user.userId||user.id,online:data?.online!==false,lastSeen:new Date(),visibleToClients:false});
    });
    socket.on('sendMessage',async data=>{
      try {
        if(!await live()||!Number.isSafeInteger(Number(data?.id)))return;
        const message=await prisma.clientMessage.findUnique({where:{id:Number(data.id)},select:{id:true,clientId:true,message:true,text:true,senderType:true,sender:true,createdAt:true}});
        if(!message||!canAccessClient(message.clientId)||(clientId&&message.senderType!=='CLIENT'))return;
        io.to(`client_${message.clientId}`).emit('newMessage',message);
      }catch(error){console.warn('SOCKET_MESSAGE_ERROR',error.message)}
    });
  });
  // Existing unscoped operational broadcasts contain management data.
  // Explicit client/technician room sends retain their verified scope.
  global.io = new Proxy(io,{get(target,prop){if(prop==='emit')return (...args)=>target.to('role:MANAGEMENT').emit(...args);const value=Reflect.get(target,prop);return typeof value==='function'?value.bind(target):value;}});
}
module.exports={installRealtimeAccess};
