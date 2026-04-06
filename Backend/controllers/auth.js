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

    // 👇 البحث في employees
    const empResult = await pool.query(
      "SELECT * FROM employees WHERE email = $1",
      [email],
    );

    // 👇 البحث في admins
    const adminResult = await pool.query(
      "SELECT * FROM admins WHERE email = $1",
      [email],
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

    // ❌ لم يتم العثور على المستخدم
    if (!user) {
      return res.status(400).json({ message: "Invalid email" });
    }

    console.log("USER FOUND:", user);

    console.log("EMAIL:", email);

    console.log("EMP RESULT:", empResult.rows);
    console.log("ADMIN RESULT:", adminResult.rows);
    // 🔐 تحقق كلمة المرور (bcrypt)
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ message: "Invalid password" });
    }
    console.log("PASSWORD INPUT:", password);
    console.log("HASH IN DB:", user.password);
    const token = jwt.sign(
      {
        id: user.admin_id || user.employee_id,
        role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" },
    );

    return res.json({
      token,
      user: {
        id: user.admin_id || user.employee_id,
        email: user.email,
        role,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

//------------------------------------------------------------------------------------------

