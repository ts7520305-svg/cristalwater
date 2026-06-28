const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '..', 'data', 'customers.json');

function loadCustomers() {
  try {
    return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  } catch {
    return [];
  }
}

function saveCustomers(data) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
}

router.get('/', (req, res) => {
  res.json(loadCustomers());
});

router.post('/', (req, res) => {
  const customers = loadCustomers();
  const newCustomer = {
    id: Date.now(),
    ...req.body,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  customers.push(newCustomer);
  saveCustomers(customers);
  res.status(201).json(newCustomer);
});

router.get('/:id', (req, res) => {
  const customers = loadCustomers();
  const customer = customers.find(c => c.id == req.params.id);
  if (!customer) return res.status(404).json({ error: 'Cliente não encontrado' });
  res.json(customer);
});

router.put('/:id', (req, res) => {
  const customers = loadCustomers();
  const idx = customers.findIndex(c => c.id == req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Cliente não encontrado' });

  customers[idx] = {
    ...customers[idx],
    ...req.body,
    updated_at: new Date().toISOString()
  };
  saveCustomers(customers);
  res.json(customers[idx]);
});

router.delete('/:id', (req, res) => {
  const customers = loadCustomers().filter(c => c.id != req.params.id);
  saveCustomers(customers);
  res.json({ message: 'Cliente removido' });
});

module.exports = router;