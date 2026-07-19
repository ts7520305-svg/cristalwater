const fs = require('fs');
const path = require('path');
function ok(name, cond){ if(!cond){ console.error('FAIL:', name); process.exitCode=1; } else console.log('OK:', name); }
const root = path.join(__dirname, '..');
const { calculatePoolOptimization } = require('../src/services/poolCalculationService');
const result = calculatePoolOptimization({ shape:'RECTANGULAR', lengthM:10, widthM:5, averageDepthM:1.5, pumpFlowM3h:15, saltCurrentPpm:2500, targetSalinityPpm:3500, chlorinatorGph:30, chlorineCurrentPpm:0.5, targetChlorinePpm:2, heatPumpThermalKw:20, currentWaterTempC:20, targetWaterTempC:27, cop:5, covered:false, bathersAverage:4 });
ok('volume 75m3', Math.abs(result.geometry.volumeM3 - 75) < 0.01);
ok('salt 75kg for +1000ppm/75m3', Math.abs(result.salt.saltKgToAdd - 75) < 0.01);
ok('filtration hours calculated', result.filtration.idealFiltrationHoursDay > 0);
ok('chlorinator hours calculated', result.chlorination.estimatedDailyProductionHours > 0);
ok('heat pump hours calculated', result.heatPump.estimatedHoursToTarget > 0);
const schema = fs.readFileSync(path.join(root,'prisma/schema.prisma'),'utf8');
ok('PoolCalculationProfile model exists', schema.includes('model PoolCalculationProfile'));
ok('Pool relation exists', /calculationProfile\s+PoolCalculationProfile\?/.test(schema));
['src/routes/poolCalculationRoutes.js','src/controllers/poolCalculationController.js','src/services/poolCalculationService.js','frontend/admin-pool-calculator.html','frontend/admin-pool-calculator.js'].forEach(f=>ok('file '+f, fs.existsSync(path.join(root,f))));
const server = fs.readFileSync(path.join(root,'src/server.js'),'utf8');
ok('route mounted', server.includes('/api/pool-calculations'));
console.log('Pool calculation module readiness OK.');
