const ClientService=require("../clients/ClientService");

ClientService.create({

name:"Tiago",

email:"tiagosilvaa@sapo.pt"

});

console.log(ClientService.list());
