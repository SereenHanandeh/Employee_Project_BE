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

// =============================
// EVERYONE
// =============================

// عرض المهام
taskRouter.get("/", auth, getTasks);

// اختيار الموظف للمهمة
taskRouter.post("/assign", auth, assignTask);

module.exports = taskRouter;