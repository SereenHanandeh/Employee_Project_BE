const leaveRouter = require("express").Router();
const {
  createLeave,
  getLeaves,
  updateLeaveStatus,
  updateLeave,
  getMyLeaves,
} = require("../controllers/leave");
const isAdmin = require("../middleware/isAdmin");
const auth = require("../middleware/auth");

leaveRouter.post("/", auth, createLeave);
leaveRouter.get("/", auth, getLeaves);
leaveRouter.get("/my-leaves", auth, getMyLeaves);
leaveRouter.put("/edit/:id",auth, isAdmin, updateLeave);
leaveRouter.put("/:id", auth, isAdmin, updateLeaveStatus);


module.exports = leaveRouter;
