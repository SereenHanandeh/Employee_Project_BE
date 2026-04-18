const taskRouter = require("express").Router();
const {
  createTask,
  getTasks,
  assignTask,
} = require("../controllers/task");

const auth = require("../middleware/auth");

// Admin
router.post("/", auth, createTask);

// الجميع
router.get("/", auth, getTasks);

// اختيار الموظف للتاسك
router.post("/assign", auth, assignTask);

module.exports = taskRouter;