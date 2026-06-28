const onlineUsers =
  new Map();

// ==========================================================
// SOCKET SERVER
// ==========================================================

function initSocket(io){

  io.on(
    "connection",
    (socket)=>{

      console.log(
        "🟢 SOCKET CONNECT:",
        socket.id
      );

      // ==================================================
      // CLIENT ROOM
      // ==================================================

      socket.on(
        "joinClient",
        (clientId)=>{

          socket.join(
            "client_" + clientId
          );

          console.log(
            "📥 JOIN CLIENT ROOM:",
            clientId
          );
        }
      );

      // ==================================================
      // USER ONLINE
      // ==================================================

      socket.on(
        "userOnline",
        (data)=>{

          if(!data?.userId) return;

          onlineUsers.set(
            data.userId,
            {
              socketId: socket.id,
              lastSeen: new Date()
            }
          );

          io.emit(
            "presenceUpdate",
            {
              userId:data.userId,
              online:true
            }
          );
        }
      );

      // ==================================================
      // TYPING
      // ==================================================

      socket.on(
        "typing",
        (data)=>{

          if(!data?.clientId) return;

          socket.to(
            "client_" + data.clientId
          ).emit(
            "typing",
            data
          );
        }
      );

      // ==================================================
      // SEND MESSAGE
      // ==================================================

      socket.on(
        "sendMessage",
        (data)=>{

          if(!data?.clientId) return;

          io.to(
            "client_" + data.clientId
          ).emit(
            "newMessage",
            data
          );
        }
      );

      // ==================================================
      // NOTIFICATION
      // ==================================================

      socket.on(
        "sendNotification",
        (data)=>{

          io.emit(
            "new-notification",
            data
          );
        }
      );

      // ==================================================
      // DISCONNECT
      // ==================================================

      socket.on(
        "disconnect",
        ()=>{

          console.log(
            "🔴 SOCKET DISCONNECT:",
            socket.id
          );

          for(
            const [
              userId,
              user
            ] of onlineUsers.entries()
          ){

            if(
              user.socketId === socket.id
            ){

              onlineUsers.delete(
                userId
              );

              io.emit(
                "presenceUpdate",
                {
                  userId,
                  online:false,
                  lastSeen:new Date()
                }
              );
            }
          }
        }
      );
    }
  );
}

// ==========================================================
// ONLINE USERS
// ==========================================================

function getOnlineUsers(){

  return onlineUsers;
}

module.exports = {

  initSocket,

  getOnlineUsers,
};