const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '..', 'data', 'services.json');

function loadServices() {
  try {
    const raw = fs.readFileSync(DATA_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveServices(data) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
}

router.get('/', (req, res) => {
  const services = loadServices();
  res.json(services);
});

router.get('/:id', (req, res) => {
  const services = loadServices();
  const service = services.find(s => s.id == req.params.id);
  if (!service) return res.status(404).json({ error: 'Serviço não encontrado' });
  res.json(service);
});

router.post('/', (req, res) => {
  const services = loadServices();
  const newService = {
    id: Date.now(),
    ...req.body,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  services.push(newService);
  saveServices(services);
  res.status(201).json(newService);
});

router.put('/:id', (req, res) => {
  const services = loadServices();
  const index = services.findIndex(s => s.id == req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Serviço não encontrado' });
  services[index] = {
    ...services[index],
    ...req.body,
    updated_at: new Date().toISOString()
  };
  saveServices(services);
  res.json(services[index]);
});

router.delete('/:id', (req, res) => {
  const services = loadServices();
  const updated = services.filter(s => s.id != req.params.id);
  saveServices(updated);
  res.json({ message: 'Serviço removido' });
});

module.exports = router;