require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

// =============================
// MIDDLEWARE
// =============================

app.use(cors());

app.use(express.json());

app.use(express.urlencoded({ extended: true }));

// =============================
// STATIC FILES
// =============================

app.use("/uploads", express.static("uploads"));


// =============================
// PUBLIC ROUTES
// =============================

// تسجيل الدخول فقط
app.use(
  "/auth",
  require("./routes/auth")
);

// =============================
// AUTH MIDDLEWARE
// =============================

const authMiddleware = require("./middleware/authMiddleware");

// =============================
// PROTECTED ROUTES
// =============================

// كل الـ routes التالية تحتاج JWT
app.use(
  "/employees",
  authMiddleware,
  require("./routes/employee")
);

app.use(
  "/evaluations",
  authMiddleware,
  require("./routes/evaluation")
);

app.use(
  "/leaves",
  authMiddleware,
  require("./routes/leave")
);

app.use(
  "/tasks",
  authMiddleware,
  require("./routes/task")
);

// =============================
// 404
// =============================

app.use((req, res) => {
  res.status(404).json({
    message: "Route not found",
  });
});

// =============================
// ERROR HANDLER
// =============================

app.use((err, req, res, next) => {
  console.error("SERVER ERROR:", err);

  res.status(500).json({
    message: "حدث خطأ في الخادم",
  });
});

// =============================
// SERVER
// =============================

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(
    `Server running on port ${PORT}`
  );
});