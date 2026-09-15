const express = require("express");

const router = express.Router();
router.use(require('../middlewares/authMiddleware')('ADMIN'));

const {

  listUsers,

  createUser,

  updateUser

} = require("../controllers/userController");

// ======================================================
// LIST USERS
// ======================================================

router.get("/", listUsers);

// ======================================================
// CREATE USER
// ======================================================

router.post("/", createUser);

// ======================================================
// UPDATE USER
// ======================================================

router.put("/:id", updateUser);

// ======================================================

module.exports = router;
