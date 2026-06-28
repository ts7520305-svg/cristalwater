const ClientEntity=require("./ClientEntity");

const repo=require("./ClientRepository");

class ClientService{

    create(data){

        const client=new ClientEntity(data);

        return repo.create(client);

    }

    list(){

        return repo.list();

    }

}

module.exports=new ClientService();
