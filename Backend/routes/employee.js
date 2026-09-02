const employeeRouter = require("express").Router();

const {
  createEmployee,
  getEmployees,
  getActiveEmployees,
  deleteEmployee,
  updateEmployee,
  getMe,
  restoreEmployee,
  getDeletedEmployees,
} = require("../controllers/employee");

const auth = require("../middleware/auth");
const isAdmin = require("../middleware/isAdmin");


/* =========================================================
   CURRENT USER
========================================================= */

employeeRouter.get(
  "/me",
  auth,
  getMe
);


/* =========================================================
   ACTIVE EMPLOYEES
   يستخدمها Admin عند إنشاء إجازة
========================================================= */

employeeRouter.get(
  "/active",
  auth,
  isAdmin,
  getActiveEmployees
);


/* =========================================================
   ALL EMPLOYEES
   صفحة إدارة الموظفين
========================================================= */

employeeRouter.get(
  "/",
  auth,
  isAdmin,
  getEmployees
);


/* =========================================================
   CREATE EMPLOYEE
========================================================= */

employeeRouter.post(
  "/",
  auth,
  isAdmin,
  createEmployee
);


/* =========================================================
   DELETE EMPLOYEE
========================================================= */

employeeRouter.delete(
  "/:id/delete",
  auth,
  isAdmin,
  deleteEmployee
);


/* =========================================================
   UPDATE EMPLOYEE
========================================================= */

employeeRouter.put(
  "/:id/update",
  auth,
  isAdmin,
  updateEmployee
);


/* =========================================================
   RESTORE EMPLOYEE
========================================================= */

employeeRouter.put(
  "/:id/restore",
  auth,
  isAdmin,
  restoreEmployee
);


/* =========================================================
   DELETED EMPLOYEES
========================================================= */

employeeRouter.get(
  "/deleted",
  auth,
  isAdmin,
  getDeletedEmployees
);


module.exports = employeeRouter;