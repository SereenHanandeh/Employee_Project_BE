const leaveRouter = require("express").Router();

const {
  createLeave,
  getLeaves,
  updateLeaveStatus,
  updateLeave,
  getMyLeaves,
} = require("../controllers/leave");

const auth = require("../middleware/auth");
const role = require("../middleware/role");

const multer = require("multer");
const path = require("path");
const fs = require("fs");

// إنشاء مجلد uploads/leaves إذا لم يكن موجودًا
const uploadDir = path.join(__dirname, "../uploads/leaves");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// إعداد تخزين الملفات
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },

  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);

    const fileName = `leave-${Date.now()}-${Math.round(
      Math.random() * 1e9
    )}${ext}`;

    cb(null, fileName);
  },
});

// السماح بالصور فقط
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/jpg",
    "image/webp",
    "application/pdf",
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "يسمح فقط برفع JPG أو PNG أو WEBP أو PDF"
      ),
      false
    );
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, 
  },
});

// =====================================================
// CREATE LEAVE
// Employee + Admin
// =====================================================
leaveRouter.post(
  "/",
  auth,
  upload.single("attachment"),
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