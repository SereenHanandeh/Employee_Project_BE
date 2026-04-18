const taskRouter = require("express").Router();
const {
  createTask,
  getTasks,
  assignTask,
} = require("../controllers/task");

const auth = require("../middleware/auth");

// Admin
taskRouter.post("/", auth, createTask);

// الجميع
taskRouter.get("/", auth, getTasks);

// اختيار الموظف للتاسك
taskRouter.post("/assign", auth, assignTask);

module.exports = taskRouter;