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

  // Task
  completeTask,
  reopenTask,

  // Stages
  completeStage,
  reopenStage,
  getCompletedStages,
} = require("../controllers/task");

const auth = require("../middleware/auth");
const role = require("../middleware/role");

// =====================================================
// GET ALL TASKS
// Admin    => جميع المهام
// Employee => المهام المعينة له فقط
// =====================================================

taskRouter.get(
  "/",
  auth,
  getTasks
);

// =====================================================
// GET COMPLETED STAGES
//
// Admin    => جميع المراحل المكتملة
// Employee => المراحل المكتملة الخاصة به
// =====================================================

taskRouter.get(
  "/completed-stages",
  auth,
  getCompletedStages
);

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
// ASSIGN TASK / STAGES
// Admin فقط
//
// يدعم:
// 1. تعيين المهمة كاملة
// 2. تعيين مرحلة أو مراحل محددة
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

// =====================================================
// COMPLETE STAGE
// Employee فقط
// =====================================================

taskRouter.put(
  "/stage/:stage_id/complete",
  auth,
  role("employee"),
  completeStage
);

// =====================================================
// REOPEN STAGE
// Employee فقط
// =====================================================

taskRouter.put(
  "/stage/:stage_id/reopen",
  auth,
  role("employee"),
  reopenStage
);

// =====================================================
// COMPLETE TASK
// Employee فقط
//
// للتوافق مع النظام القديم
// =====================================================

taskRouter.put(
  "/:employee_task_id/complete",
  auth,
  role("employee"),
  completeTask
);

// =====================================================
// REOPEN TASK
// Employee فقط
//
// للتوافق مع النظام القديم
// =====================================================

taskRouter.put(
  "/:employee_task_id/reopen",
  auth,
  role("employee"),
  reopenTask
);

module.exports = taskRouter;