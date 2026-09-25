const express=require('express'),router=express.Router(),{prisma}=require('../prismaClient'),auth=require('../middlewares/authMiddleware'),c=require('../controllers/technicianManagementController'),service=require('../services/technicianManagementService'),R=require('../../frontend/cw-technician-management-rules');
router.use((req,res,next)=>{res.set('Cache-Control','private, no-store');next();});
router.use(auth('ADMIN'));
router.get('/manage',c.list);router.get('/manage/options',c.options);router.post('/manage/review',c.review);router.post('/manage/commit',c.commit);router.get('/manage/result/:requestId',c.result);router.post('/manage/cancel/:requestId',c.cancel);
router.get('/',async(req,res)=>{try{const rows=await prisma.technician.findMany({orderBy:[{name:'asc'},{id:'asc'}]});res.json(rows.map(service.safe));}catch(_){res.status(503).json({ok:false,error:'Não foi possível confirmar os técnicos.'});}});
router.get('/:id',async(req,res)=>{const id=R.id(req.params.id);if(!id)return res.status(400).json({ok:false});try{const row=await prisma.technician.findUnique({where:{id}});if(!row)return res.status(404).json({ok:false});res.json(service.safe(row));}catch(_){res.status(503).json({ok:false});}});
router.post('/',c.legacy);router.put('/:id',c.legacy);router.delete('/:id',c.legacy);
module.exports=router;
