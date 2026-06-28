require("dotenv").config();

const Kernel = require("../core/Kernel");
const CrystalBrain = require("../system/brain/CrystalBrain");

async function bootstrap() {

    console.log("========================================");
    console.log(" CRYSTAL PLATFORM BOOTSTRAP ");
    console.log("========================================");

    Kernel.KernelRuntime.start(Kernel);

    Kernel.LifecycleManager.register("Kernel");
    Kernel.LifecycleManager.register("Brain");
    Kernel.LifecycleManager.register("Runtime");

    Kernel.LifecycleManager.start("Kernel");
    Kernel.LifecycleManager.start("Brain");
    Kernel.LifecycleManager.start("Runtime");

    console.log("Kernel iniciado.");

    console.log("Brain iniciado.");

    console.log("Platform pronta.");

    return {

        ok:true,

        kernel:Kernel.KernelRuntime.status(),

        lifecycle:Kernel.LifecycleManager.status(),

        brain:CrystalBrain.status()

    };

}

module.exports={

bootstrap

};

if(require.main===module){

(async()=>{

const result=await bootstrap();

console.log(JSON.stringify(result,null,2));

})();

}
