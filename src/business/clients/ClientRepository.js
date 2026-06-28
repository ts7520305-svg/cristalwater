class ClientRepository{

    constructor(){

        this.items=[];

    }

    create(client){

        this.items.push(client);

        return client;

    }

    list(){

        return this.items;

    }

    find(id){

        return this.items.find(c=>c.id===id)||null;

    }

}

module.exports=new ClientRepository();
