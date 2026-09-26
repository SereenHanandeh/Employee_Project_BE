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
  previewJobDescriptionImport,
  confirmJobDescriptionImport,
  previewEmployeeImport,
  confirmEmployeeImport,
  uploadJobDescriptionFile,
  getJobDescriptionFile,
  deleteJobDescriptionFile,
} = require("../controllers/employee");

const auth = require("../middleware/auth");
const isAdmin = require("../middleware/isAdmin");

const multer = require("multer");

// =========================================================
// UPLOAD - ملفات Excel (تستخدم لاستيراد الموظفين واستيراد الوصف الوظيفي)
// =========================================================

const uploadExcel = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
    ];

    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("الرجاء رفع ملف إكسل بصيغة .xlsx أو .xls فقط"));
    }
  },
});

const uploadDocument = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});

// =========================================================
// CURRENT USER
// =========================================================

employeeRouter.get("/me", auth, getMe);
employeeRouter.put("/me/welcome", auth, markWelcomeSeen);
employeeRouter.put("/me", auth, updateMyProfile);
employeeRouter.put("/me/password", auth, changeMyPassword);

// =========================================================
// ACTIVE / ALL EMPLOYEES
// =========================================================

employeeRouter.get("/active", auth, isAdmin, getActiveEmployees);
employeeRouter.get("/", auth, isAdmin, getEmployees);
employeeRouter.post("/", auth, isAdmin, createEmployee);
employeeRouter.delete("/:id/delete", auth, isAdmin, deleteEmployee);
employeeRouter.put("/:id/update", auth, isAdmin, updateEmployee);
employeeRouter.put("/:id/restore", auth, isAdmin, restoreEmployee);
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
// JOB DESCRIPTION IMPORT (Excel)
// =========================================================

employeeRouter.post(
  "/job-description/import/preview",
  isAdmin,
  uploadExcel.single("file"),
  previewJobDescriptionImport,
);

employeeRouter.post(
  "/job-description/import/confirm",
  isAdmin,
  confirmJobDescriptionImport,
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

employeeRouter.post(
  "/:id/job-description/file",
  isAdmin,
  uploadDocument.single("file"),
  uploadJobDescriptionFile,
);

employeeRouter.get(
  "/:id/job-description/file",
  isAdmin,
  getJobDescriptionFile,
);

employeeRouter.delete(
  "/:id/job-description/file",
  isAdmin,
  deleteJobDescriptionFile,
);

module.exports = employeeRouter;