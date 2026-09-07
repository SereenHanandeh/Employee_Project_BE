const departmentRouter = require("express").Router();

const {
  getDepartments,
  getActiveDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  restoreDepartment,
} = require("../controllers/department");

const auth = require("../middleware/auth");
const isAdmin = require("../middleware/isAdmin");

// =========================================================
// ACTIVE DEPARTMENTS
// مهم أن يكون قبل /:id
// =========================================================

departmentRouter.get(
  "/active",
  auth,
  isAdmin,
  getActiveDepartments
);

// =========================================================
// ALL DEPARTMENTS
// =========================================================

departmentRouter.get(
  "/",
  auth,
  isAdmin,
  getDepartments
);

// =========================================================
// CREATE
// =========================================================

departmentRouter.post(
  "/",
  auth,
  isAdmin,
  createDepartment
);

// =========================================================
// UPDATE
// =========================================================

departmentRouter.put(
  "/:id",
  auth,
  isAdmin,
  updateDepartment
);

// =========================================================
// SOFT DELETE
// =========================================================

departmentRouter.delete(
  "/:id",
  auth,
  isAdmin,
  deleteDepartment
);

// =========================================================
// RESTORE
// =========================================================

departmentRouter.put(
  "/:id/restore",
  auth,
  isAdmin,
  restoreDepartment
);

module.exports = departmentRouter;