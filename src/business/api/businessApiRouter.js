const express = require("express");
const prisma = require("../../prismaClient");

const router = express.Router();

router.get("/status", async (req,res)=>{

    res.json({

        ok:true,

        module:"Cristal Water Business",

        database:"PostgreSQL",

        provider:"Prisma",

        checkedAt:new Date().toISOString()

    });

});

router.get("/summary",async(req,res)=>{

    try{

        const [

            clients,

            pools,

            technicians,

            visits,

            invoices,

            payments

        ]=await Promise.all([

            prisma.client.count(),

            prisma.pool.count(),

            prisma.technician.count(),

            prisma.serviceVisit.count(),

            prisma.invoice.count(),

            prisma.payment.count()

        ]);

        res.json({

            ok:true,

            clients,

            pools,

            technicians,

            visits,

            invoices,

            payments,

            checkedAt:new Date().toISOString()

        });

    }catch(error){

        res.status(500).json({

            ok:false,

            error:error.message

        });

    }

});

module.exports=router;
