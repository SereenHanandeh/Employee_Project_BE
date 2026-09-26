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
} = require("../controllers/employee");

const auth = require("../middleware/auth");
const isAdmin = require("../middleware/isAdmin");

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

router.get("/job-descriptions", isAdmin, getJobDescriptions);
router.put("/:id/job-description", isAdmin, updateJobDescription);
router.delete("/:id/job-description", isAdmin, deleteJobDescription);

router.get("/job-descriptions/trash", verifyAdmin, getJobDescriptionTrash);
router.put(
  "/job-descriptions/trash/:trashId/restore",
  isAdmin,
  restoreJobDescription,
);
router.delete(
  "/job-descriptions/trash/:trashId",
  isAdmin,
  permanentlyDeleteJobDescription,
);

module.exports = employeeRouter;
