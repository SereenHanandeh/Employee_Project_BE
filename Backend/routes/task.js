const taskRouter = require("express").Router();

const {
  createTask,
  getTasks,
  assignTask,
  updateTask,
  deleteTask,
  getEmployees,
  getEmployeeTasks,
  removeTaskFromEmployee,
} = require("../controllers/task");

const auth = require("../middleware/auth");

// =============================
// ADMIN / AUTH
// =============================

// إنشاء مهمة
taskRouter.post("/", auth, createTask);

// تعديل مهمة
taskRouter.put("/:id", auth, updateTask);

// حذف مهمة
taskRouter.delete("/:id", auth, deleteTask);

// جميع المهام
// Admin => كل المهام
// Employee => المهام المعينة له فقط
taskRouter.get("/", auth, getTasks);

// الموظفين
taskRouter.get("/employees", auth, getEmployees);

// تعيين مهمة لموظف - ADMIN
taskRouter.post("/assign", auth, assignTask);

// مهام موظف معين - ADMIN
taskRouter.get(
  "/employee/:employee_id",
  auth,
  getEmployeeTasks
);

// إزالة مهمة من موظف - ADMIN
taskRouter.delete(
  "/assignment/:employee_task_id",
  auth,
  removeTaskFromEmployee
);

module.exports = taskRouter;