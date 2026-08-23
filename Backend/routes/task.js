const taskRouter = require("express").Router();

const {
  createTask,
  getTasks,
  assignTask,
  updateTask,
  deleteTask,
} = require("../controllers/task");

const auth = require("../middleware/auth");

// =============================
// ADMIN
// =============================

// إضافة مهمة
taskRouter.post("/", auth, createTask);

// تعديل مهمة
taskRouter.put("/:id", auth, updateTask);

// حذف مهمة
taskRouter.delete("/:id", auth, deleteTask);

// تعيين مهمة لموظف محدد
taskRouter.post("/assign", auth, assignTask);

// =============================
// EVERYONE
// =============================

// عرض المهام
taskRouter.get("/", auth, getTasks);

module.exports = taskRouter;