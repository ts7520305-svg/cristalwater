const { prisma } = require("../prismaClient");

// ==========================================================
// CRIAR ACESSO
// ==========================================================

async function createAccess(req,res){

  try{

    const clientId = Number(req.params.clientId);

    const access = await prisma.clientAccess.create({
      data:{
        clientId,
        title: req.body.title,
        accessType: req.body.accessType,
        codeValue: req.body.codeValue,
        instructions: req.body.instructions,
        visibleToTechnician: req.body.visibleToTechnician ?? true,
        active: true
      }
    });

    res.json({ ok:true, access });

  }catch(err){
    console.error(err);
    res.status(500).json({ error:"Erro criar acesso" });
  }
}

module.exports = {
  createAccess
};