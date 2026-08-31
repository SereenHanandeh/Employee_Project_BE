const { pool } = require("../models/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

async function createAdmin() {
  const hash = await bcrypt.hash("admin123", 10);

  await pool.query(
    "INSERT INTO admins (email, password, role_id) VALUES ($1, $2, $3)",
    ["admin@gmail.com", hash, 1],
  );

  console.log("Admin created");
}

//createAdmin();

//------------------------------------------------------------------------------------------------------------

exports.login = async (req, res) => {
  try {
    let { email, password } = req.body;

    email = email.trim().toLowerCase();

    // =============================
    // SEARCH EMPLOYEE
    // =============================

    const empResult = await pool.query(
      "SELECT * FROM employees WHERE email = $1",
      [email]
    );

    // =============================
    // SEARCH ADMIN
    // =============================

    const adminResult = await pool.query(
      "SELECT * FROM admins WHERE email = $1",
      [email]
    );

    let user = null;
    let role = null;

    if (empResult.rows.length > 0) {
      user = empResult.rows[0];
      role = "employee";
    } else if (adminResult.rows.length > 0) {
      user = adminResult.rows[0];
      role = "admin";
    }

    // =============================
    // USER NOT FOUND
    // =============================

    if (!user) {
      return res.status(400).json({
        message: "Invalid email",
      });
    }

    // =============================
    // PASSWORD
    // =============================

    const isMatch = await bcrypt.compare(
      password,
      user.password
    );

    if (!isMatch) {
      return res.status(400).json({
        message: "Invalid password",
      });
    }

    // =============================
    // JWT
    // =============================

    const token = jwt.sign(
      {
        id:
          user.admin_id ||
          user.employee_id,

        employee_id:
          user.employee_id || null,

        admin_id:
          user.admin_id || null,

        role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "1d",
      }
    );

    // =============================
    // RESPONSE
    // =============================

    return res.json({
      token,

      user: {
        id:
          user.admin_id ||
          user.employee_id,

        employee_id:
          user.employee_id || null,

        admin_id:
          user.admin_id || null,

        email: user.email,

        role,
      },
    });

  } catch (err) {
    console.error("LOGIN ERROR:", err);

    return res.status(500).json({
      message: "Server error",
    });
  }
};

//------------------------------------------------------------------------------------------

