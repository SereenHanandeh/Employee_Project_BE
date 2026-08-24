const leaveRouter = require("express").Router();

const auth = require("../middleware/auth");
const uploadLeave = require("../middleware/uploadLeave");

const {
  createLeave,
  getLeaves,
  getMyLeaves,
  updateLeave,
  updateLeaveStatus,
} = require("../controllers/leave");

// =============================
// GET MY LEAVES
// =============================

leaveRouter.get(
  "/my",
  auth,
  getMyLeaves
);

// =============================
// GET ALL LEAVES
// =============================

leaveRouter.get(
  "/",
  auth,
  getLeaves
);

// =============================
// CREATE LEAVE
// =============================

leaveRouter.post(
  "/",
  auth,
  uploadLeave.single("attachment"),
  createLeave
);

// =============================
// UPDATE LEAVE
// =============================

leaveRouter.put(
  "/:id",
  auth,
  uploadLeave.single("attachment"),
  updateLeave
);

// =============================
// UPDATE LEAVE STATUS
// =============================

leaveRouter.put(
  "/:id/status",
  auth,
  updateLeaveStatus
);

module.exports = leaveRouter;