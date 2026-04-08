const { pool } = require("../models/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

/* ============================= */
/*        CREATE EMPLOYEE        */
/* ============================= */
exports.createEmployee = async (req, res) => {
  try {
    const { name, department, position, email, password, role } = req.body;

    // تحقق
    if (!name || !email || !password) {
      return res.status(400).json({
        message: "الحقول الأساسية مطلوبة",
      });
    }

    // تحقق إذا الإيميل موجود
    const check = await pool.query(`SELECT * FROM employees WHERE email=$1`, [
      email,
    ]);

    if (check.rows.length > 0) {
      return res.status(400).json({
        message: "الإيميل مستخدم مسبقاً",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO employees 
      (name, department, position, email, password, role)
      VALUES ($1,$2,$3,$4,$5,$6)
      RETURNING employee_id, name, email, role`,
      [name, department, position, email, hashedPassword, role || "employee"],
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Create Employee Error" });
  }
};

/* ============================= */
/*        GET ALL EMPLOYEES      */
/* ============================= */
exports.getEmployees = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
  employee_id,
  name,
  email,
  department,
  position,
  role,
  CASE 
    WHEN is_deleted = 1 THEN 'deleted'
    ELSE 'active'
  END AS status
FROM employees
ORDER BY employee_id DESC`,
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Fetch Employees Error" });
  }
};

/* ============================= */
/*        DELETE EMPLOYEE        */
/* ============================= */
exports.deleteEmployee = async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query(`UPDATE employees SET is_deleted=1 WHERE employee_id=$1`, [
      id,
    ]);

    res.json({ message: "Employee Deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Delete Error" });
  }
};

exports.updateEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, department, position, email, role } = req.body;

    // تحقق وجود الموظف
    const check = await pool.query(
      `SELECT * FROM employees WHERE employee_id=$1 AND is_deleted=0`,
      [id],
    );

    if (check.rows.length === 0) {
      return res.status(404).json({
        message: "الموظف غير موجود",
      });
    }
    const emailCheck = await pool.query(
      `SELECT * FROM employees WHERE email=$1 AND employee_id != $2`,
      [email, id],
    );

    if (emailCheck.rows.length > 0) {
      return res.status(400).json({
        message: "الإيميل مستخدم مسبقاً",
      });
    }
    // تحديث البيانات
    const result = await pool.query(
      `UPDATE employees 
       SET name=$1,
           department=$2,
           position=$3,
           email=$4,
           role=$5
       WHERE employee_id=$6
       RETURNING employee_id, name, email, department, position, role`,
      [name, department, position, email, role, id],
    );

    res.json({
      message: "تم تحديث الموظف بنجاح",
      employee: result.rows[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Update Employee Error" });
  }
};

exports.getMe = async (req, res) => {
  try {
    const employeeId = req.user.id;

    const result = await pool.query(
      "SELECT employee_id, name, email FROM employees WHERE employee_id = $1",
      [employeeId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Employee not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};


exports.restoreEmployee = async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query(
      `UPDATE employees SET is_deleted=0 WHERE employee_id=$1`,
      [id]
    );

    res.json({ message: "Employee Restored" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Restore Error" });
  }
};


exports.getDeletedEmployees = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        employee_id,
        name,
        email,
        department,
        position,
        role
       FROM employees
       WHERE is_deleted=1
       ORDER BY employee_id DESC`
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: "Fetch Deleted Error" });
  }
};