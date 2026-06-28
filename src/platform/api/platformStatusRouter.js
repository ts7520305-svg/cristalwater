const express = require("express");

const Kernel = require("../../core/Kernel");
const KernelRuntime = require("../../core/runtime/KernelRuntime");
const CrystalBrain = require("../../system/brain/CrystalBrain");

const router = express.Router();

router.get("/status", async (req,res)=>{

    try{

        res.json({

            ok:true,

            platform:"Crystal Platform",

            version:"23.5.0",

            kernel:KernelRuntime.status(),

            brain:CrystalBrain.status(),

            runtime:Kernel.RuntimeMonitor.status(),

            doctor:await Kernel.CrystalDoctor.run(),

            checkedAt:new Date().toISOString()

        });

    }catch(err){

        res.status(500).json({

            ok:false,

            error:err.message

        });

    }

});

module.exports=router;
