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
const role = require("../middleware/roleMiddleware");

// =====================================================
// GET ALL TASKS
// Admin    => جميع المهام
// Employee => المهام المعينة له فقط
// =====================================================
taskRouter.get("/", auth, getTasks);

// =====================================================
// GET EMPLOYEES
// Admin فقط
// =====================================================
taskRouter.get(
  "/employees",
  auth,
  role("admin"),
  getEmployees
);

// =====================================================
// CREATE TASK
// Admin فقط
// =====================================================
taskRouter.post(
  "/",
  auth,
  role("admin"),
  createTask
);

// =====================================================
// UPDATE TASK
// Admin فقط
// =====================================================
taskRouter.put(
  "/:id",
  auth,
  role("admin"),
  updateTask
);

// =====================================================
// DELETE TASK
// Admin فقط
// =====================================================
taskRouter.delete(
  "/:id",
  auth,
  role("admin"),
  deleteTask
);

// =====================================================
// ASSIGN TASK TO EMPLOYEE
// Admin فقط
// =====================================================
taskRouter.post(
  "/assign",
  auth,
  role("admin"),
  assignTask
);

// =====================================================
// GET TASKS OF SPECIFIC EMPLOYEE
// Admin فقط
// =====================================================
taskRouter.get(
  "/employee/:employee_id",
  auth,
  role("admin"),
  getEmployeeTasks
);

// =====================================================
// REMOVE TASK FROM EMPLOYEE
// Admin فقط
// =====================================================
taskRouter.delete(
  "/assignment/:employee_task_id",
  auth,
  role("admin"),
  removeTaskFromEmployee
);

module.exports = taskRouter;