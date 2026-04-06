const leaveRouter = require("express").Router();
const {
  createLeave,
  getLeaves,
  updateLeaveStatus,
  getMyLeaves,
} = require("../controllers/leave");
const isAdmin = require("../middleware/isAdmin");
const auth = require("../middleware/auth");

leaveRouter.post("/", auth, createLeave);
leaveRouter.get("/", auth, getLeaves);
leaveRouter.get("/my-leaves", auth, getMyLeaves);
leaveRouter.put("/:id", auth, isAdmin, updateLeaveStatus);

module.exports = leaveRouter;
