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
  updateMyProfile,
  changeMyPassword,
  markWelcomeSeen,
  getJobDescriptions,
  updateJobDescription,
  deleteJobDescription,
  getJobDescriptionTrash,
  restoreJobDescription,
  permanentlyDeleteJobDescription,
  previewEmployeeImport,
  confirmEmployeeImport,
} = require("../controllers/employee");

const auth = require("../middleware/auth");
const isAdmin = require("../middleware/isAdmin");

const multer = require("multer");

// =========================================================
// UPLOAD - ملفات Excel (استيراد الموظفين)
// =========================================================

const uploadExcel = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
      "application/vnd.ms-excel", // .xls
    ];

    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("الرجاء رفع ملف إكسل بصيغة .xlsx أو .xls فقط"));
    }
  },
});

// =========================================================
// CURRENT USER
// =========================================================

employeeRouter.get("/me", auth, getMe);

// =========================================================
// MARK WELCOME AS SEEN
// =========================================================

employeeRouter.put("/me/welcome", auth, markWelcomeSeen);

// =========================================================
// UPDATE MY PROFILE
// =========================================================

employeeRouter.put("/me", auth, updateMyProfile);

// =========================================================
// CHANGE MY PASSWORD
// =========================================================

employeeRouter.put("/me/password", auth, changeMyPassword);

// =========================================================
// ACTIVE EMPLOYEES
// =========================================================

employeeRouter.get("/active", auth, isAdmin, getActiveEmployees);

// =========================================================
// ALL EMPLOYEES
// =========================================================

employeeRouter.get("/", auth, isAdmin, getEmployees);

// =========================================================
// CREATE EMPLOYEE
// =========================================================

employeeRouter.post("/", auth, isAdmin, createEmployee);

// =========================================================
// DELETE EMPLOYEE
// =========================================================

employeeRouter.delete("/:id/delete", auth, isAdmin, deleteEmployee);

// =========================================================
// UPDATE EMPLOYEE
// =========================================================

employeeRouter.put("/:id/update", auth, isAdmin, updateEmployee);

// =========================================================
// RESTORE EMPLOYEE
// =========================================================

employeeRouter.put("/:id/restore", auth, isAdmin, restoreEmployee);

// =========================================================
// DELETED EMPLOYEES
// =========================================================

employeeRouter.get("/deleted", auth, isAdmin, getDeletedEmployees);

// =========================================================
// JOB DESCRIPTIONS
// =========================================================

employeeRouter.get("/job-descriptions", isAdmin, getJobDescriptions);
employeeRouter.put("/:id/job-description", isAdmin, updateJobDescription);
employeeRouter.delete("/:id/job-description", isAdmin, deleteJobDescription);

employeeRouter.get("/job-descriptions/trash", isAdmin, getJobDescriptionTrash);
employeeRouter.put(
  "/job-descriptions/trash/:trashId/restore",
  isAdmin,
  restoreJobDescription,
);
employeeRouter.delete(
  "/job-descriptions/trash/:trashId",
  isAdmin,
  permanentlyDeleteJobDescription,
);

// =========================================================
// EMPLOYEES IMPORT (Excel)
// =========================================================

employeeRouter.post(
  "/import/preview",
  auth,
  isAdmin,
  uploadExcel.single("file"),
  previewEmployeeImport,
);

employeeRouter.post(
  "/import/confirm",
  auth,
  isAdmin,
  confirmEmployeeImport,
);

module.exports = employeeRouter;