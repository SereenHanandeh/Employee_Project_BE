
const express = require("express");

const leaveRouter = express.Router();

const {
  createLeave,
  getLeaves,
  updateLeaveStatus,
  updateLeave,
  getMyLeaves,
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
// GET ALL LEAVES
// Admin فقط
// =====================================================

leaveRouter.get(
  "/",
  auth,
  role("admin"),
  getLeaves
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

module.exports = leaveRouter;
