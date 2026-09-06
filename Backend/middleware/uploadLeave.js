const multer = require("multer");

// =====================================================
// MEMORY STORAGE
// =====================================================

const storage = multer.memoryStorage();

// =====================================================
// FILE FILTER
// =====================================================

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

// =====================================================
// MULTER
// =====================================================

const uploadLeave = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

module.exports = uploadLeave;