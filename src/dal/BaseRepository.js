class BaseRepository {

    constructor(model){
        this.model = model;
    }

    findAll(args = {}){
        return this.model.findMany(args);
    }

    findById(id){
        return this.model.findUnique({
            where:{ id:Number(id) }
        });
    }

    count(where = {}){
        return this.model.count({ where });
    }

    create(data){
        return this.model.create({ data });
    }

    update(id,data){
        return this.model.update({
            where:{ id:Number(id) },
            data
        });
    }

    delete(id){
        return this.model.delete({
            where:{ id:Number(id) }
        });
    }

}

module.exports = BaseRepository;
