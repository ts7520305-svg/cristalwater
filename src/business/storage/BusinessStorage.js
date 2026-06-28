class BusinessStorage {

    async save(entity){

        throw new Error("Storage ainda não implementado.");

    }

    async load(){

        return [];

    }

}

module.exports=new BusinessStorage();
