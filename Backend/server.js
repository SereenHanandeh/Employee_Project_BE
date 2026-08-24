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

// ملفات الصور والمرفقات
app.use(
  "/uploads",
  express.static(
    path.join(__dirname, "uploads")
  )
);

// =============================
// ROUTES
// =============================

app.use(
  "/auth",
  require("./routes/auth")
);

app.use(
  "/employees",
  require("./routes/employee")
);

app.use(
  "/evaluations",
  require("./routes/evaluation")
);

app.use(
  "/leaves",
  require("./routes/leave")
);

app.use(
  "/tasks",
  require("./routes/task")
);

// =============================
// SERVER
// =============================

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(
    `Server running on port ${PORT}`
  );
});