class CrystalUI{

    constructor(){

        this.components={};

    }

    register(name,renderer){

        this.components[name]=renderer;

    }

    render(name,data={}){

        if(!this.components[name])
            throw new Error("Component '"+name+"' não existe.");

        return this.components[name](data);

    }

    list(){

        return Object.keys(this.components);

    }

}

window.CrystalUI=new CrystalUI();
