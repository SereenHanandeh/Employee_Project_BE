const express = require("express");

const leaveRouter = express.Router();

const {
  createLeave,
  getLeaves,
  updateLeaveStatus,
  updateLeave,
  getMyLeaves,
  deleteLeave,
  getDeletedLeaves,
  restoreLeave,
} = require("../controllers/leave");

const auth = require("../middleware/auth");
const role = require("../middleware/role");
const uploadLeave = require("../middleware/uploadLeave");

// =====================================================
// CREATE LEAVE
// Employee + Admin
// =====================================================

leaveRouter.post(
  "/",
  auth,
  uploadLeave.single("attachment"),
  createLeave
);

// =====================================================
// GET ALL ACTIVE LEAVES
// Admin فقط
// =====================================================

leaveRouter.get(
  "/",
  auth,
  role("admin"),
  getLeaves
);

// =====================================================
// GET DELETED LEAVES
// Admin فقط
// =====================================================

leaveRouter.get(
  "/deleted",
  auth,
  role("admin"),
  getDeletedLeaves
);

// =====================================================
// GET MY LEAVES
// Employee + Admin
// =====================================================

leaveRouter.get(
  "/my-leaves",
  auth,
  getMyLeaves
);

// =====================================================
// UPDATE LEAVE
// Admin فقط
// =====================================================

leaveRouter.put(
  "/edit/:id",
  auth,
  role("admin"),
  uploadLeave.single("attachment"),
  updateLeave
);

// =====================================================
// UPDATE LEAVE STATUS
// Admin فقط
// =====================================================

leaveRouter.put(
  "/:id",
  auth,
  role("admin"),
  updateLeaveStatus
);

// =====================================================
// RESTORE DELETED LEAVE
// Admin فقط
// =====================================================

leaveRouter.put(
  "/restore/:id",
  auth,
  role("admin"),
  restoreLeave
);

// =====================================================
// SOFT DELETE LEAVE
// Admin فقط
// =====================================================

leaveRouter.delete(
  "/:id",
  auth,
  role("admin"),
  deleteLeave
);

module.exports = leaveRouter;