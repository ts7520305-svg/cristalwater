const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '..', 'data', 'tasks.json');

function loadTasks() {
  try {
    return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  } catch {
    return [];
  }
}

function saveTasks(data) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
}

router.get('/', (req, res) => {
  res.json(loadTasks());
});

router.post('/', (req, res) => {
  const tasks = loadTasks();
  const newTask = {
    id: Date.now(),
    ...req.body,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  tasks.push(newTask);
  saveTasks(tasks);
  res.status(201).json(newTask);
});

module.exports = router;