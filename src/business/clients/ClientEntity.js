class ClientEntity{

    constructor(data={}){

        this.id=data.id||`client_${Date.now()}`;

        this.name=data.name||"";

        this.email=data.email||"";

        this.phone=data.phone||"";

        this.status=data.status||"ACTIVE";

        this.createdAt=new Date().toISOString();

    }

}

module.exports=ClientEntity;
