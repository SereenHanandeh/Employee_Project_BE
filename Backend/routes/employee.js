const employeeRouter = require("express").Router();

const {
  createEmployee,
  getEmployees,
  deleteEmployee,
  updateEmployee,
  getMe,
  restoreEmployee,
  getDeletedEmployees,
} = require("../controllers/employee");

const auth = require("../middleware/auth");
const isAdmin = require("../middleware/isAdmin");

// ===============================
// الموظف الحالي
// Employee + Admin
// ===============================
employeeRouter.get("/me", auth, getMe);

// ===============================
// إدارة الموظفين - Admin Only
// ===============================

// إضافة موظف
employeeRouter.post("/", auth, isAdmin, createEmployee);

// عرض جميع الموظفين
employeeRouter.get("/", auth, isAdmin, getEmployees);

// حذف موظف
employeeRouter.delete("/:id/delete", auth, isAdmin, deleteEmployee);

// تعديل موظف
employeeRouter.put("/:id/update", auth, isAdmin, updateEmployee);

// استرجاع موظف محذوف
employeeRouter.put("/:id/restore", auth, isAdmin, restoreEmployee);

// عرض الموظفين المحذوفين
employeeRouter.get("/deleted", auth, isAdmin, getDeletedEmployees);

module.exports = employeeRouter;