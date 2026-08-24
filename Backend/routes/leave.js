const leaveRouter = require("express").Router();

const {
  createLeave,
  getLeaves,
  getMyLeaves,
  updateLeave,
  updateLeaveStatus,
} = require("../controllers/leave");

const auth = require("../middleware/auth");
const uploadLeave = require("../middleware/uploadLeave");

// إنشاء طلب إجازة + صورة
leaveRouter.post(
  "/",
  auth,
  uploadLeave.single("attachment"),
  createLeave
);

// جميع الإجازات - للأدمن
leaveRouter.get(
  "/",
  auth,
  getLeaves
);

// إجازات الموظف الحالي فقط
leaveRouter.get(
  "/my-leaves",
  auth,
  getMyLeaves
);

// تعديل الإجازة + إمكانية تغيير الصورة
leaveRouter.put(
  "/:id",
  auth,
  uploadLeave.single("attachment"),
  updateLeave
);

// تغيير الحالة
leaveRouter.put(
  "/:id/status",
  auth,
  updateLeaveStatus
);

module.exports = leaveRouter;