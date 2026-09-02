const { pool } = require("../models/db");
const bcrypt = require("bcryptjs");

/* =========================================================
   CREATE EMPLOYEE
========================================================= */

exports.createEmployee = async (req, res) => {
  try {
    const {
      name,
      department,
      position,
      email,
      password,
      role,
    } = req.body;

    // =============================
    // Validation
    // =============================

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "الحقول الأساسية مطلوبة",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: "كلمة المرور يجب أن تكون 6 أحرف على الأقل",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // =============================
    // Validate role
    // =============================

    const allowedRoles = ["employee", "admin"];
    const employeeRole = role || "employee";

    if (!allowedRoles.includes(employeeRole)) {
      return res.status(400).json({
        message: "الدور غير صالح",
      });
    }

    // =============================
    // Check email
    // =============================

    const check = await pool.query(
      `
      SELECT employee_id
      FROM employees
      WHERE LOWER(email) = $1
      `,
      [normalizedEmail]
    );

    if (check.rows.length > 0) {
      return res.status(400).json({
        message: "الإيميل مستخدم مسبقاً",
      });
    }

    // =============================
    // Hash password
    // =============================

    const hashedPassword = await bcrypt.hash(password, 10);

    // =============================
    // Create employee
    // =============================

    const result = await pool.query(
      `
      INSERT INTO employees
      (
        name,
        department,
        position,
        email,
        password,
        role,
        is_deleted
      )
      VALUES ($1, $2, $3, $4, $5, $6, 0)
      RETURNING
        employee_id,
        name,
        email,
        department,
        position,
        role
      `,
      [
        name.trim(),
        department?.trim() || null,
        position?.trim() || null,
        normalizedEmail,
        hashedPassword,
        employeeRole,
      ]
    );

    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Create Employee Error:", err);

    return res.status(500).json({
      message: "Create Employee Error",
    });
  }
};


/* =========================================================
   GET ALL EMPLOYEES
   يستخدم في صفحة إدارة الموظفين + سلة المحذوفات
========================================================= */

exports.getEmployees = async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
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
      ORDER BY employee_id DESC
      `
    );

    return res.json(result.rows);
  } catch (err) {
    console.error("Fetch Employees Error:", err);

    return res.status(500).json({
      message: "Fetch Employees Error",
    });
  }
};


/* =========================================================
   GET ACTIVE EMPLOYEES
   يستخدم فقط لاختيار الموظف في طلب الإجازة
========================================================= */

exports.getActiveEmployees = async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        employee_id,
        name,
        email,
        department,
        position,
        role
      FROM employees
      WHERE is_deleted = 0
      ORDER BY name ASC
      `
    );

    return res.json(result.rows);
  } catch (err) {
    console.error("Fetch Active Employees Error:", err);

    return res.status(500).json({
      message: "Fetch Active Employees Error",
    });
  }
};


/* =========================================================
   GET ME
   المستخدم الحالي سواء Admin أو Employee
========================================================= */

const getMe = async (req, res) => {
  try {
    console.log("REQ.USER:", req.user);

    const employeeId = req.user?.employee_id || req.user?.id;

    console.log("EMPLOYEE ID:", employeeId);

    if (!employeeId) {
      return res.status(401).json({
        message: "تعذر تحديد الموظف من بيانات تسجيل الدخول",
      });
    }

    const result = await pool.query(
      `
      SELECT
        employee_id,
        name,
        email,
        department,
        position,
        role
      FROM employees
      WHERE employee_id = $1
        AND is_deleted = 0
      LIMIT 1
      `,
      [employeeId]
    );

    console.log("GET ME RESULT:", result.rows);

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "المستخدم غير موجود أو تم حذفه",
      });
    }

    return res.json(result.rows[0]);

  } catch (err) {
    console.error("GET ME ERROR:", err);

    return res.status(500).json({
      message: "حدث خطأ في الخادم",
    });
  }
};

/* =========================================================
   DELETE EMPLOYEE
   حذف منطقي فقط
========================================================= */

exports.deleteEmployee = async (req, res) => {
  try {
    const { id } = req.params;

    if (!Number.isInteger(Number(id))) {
      return res.status(400).json({
        message: "معرف الموظف غير صالح",
      });
    }

    // =============================
    // Check employee
    // =============================

    const check = await pool.query(
      `
      SELECT employee_id
      FROM employees
      WHERE employee_id = $1
        AND is_deleted = 0
      `,
      [id]
    );

    if (check.rows.length === 0) {
      return res.status(404).json({
        message: "الموظف غير موجود",
      });
    }

    // =============================
    // Soft delete
    // =============================

    await pool.query(
      `
      UPDATE employees
      SET is_deleted = 1
      WHERE employee_id = $1
      `,
      [id]
    );

    return res.json({
      message: "تم حذف الموظف بنجاح",
    });
  } catch (err) {
    console.error("Delete Employee Error:", err);

    return res.status(500).json({
      message: "Delete Error",
    });
  }
};


/* =========================================================
   UPDATE EMPLOYEE
========================================================= */

exports.updateEmployee = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      name,
      department,
      position,
      email,
      role,
    } = req.body;

    // =============================
    // Validate ID
    // =============================

    if (!Number.isInteger(Number(id))) {
      return res.status(400).json({
        message: "معرف الموظف غير صالح",
      });
    }

    // =============================
    // Validate required fields
    // =============================

    if (!name || !name.trim()) {
      return res.status(400).json({
        message: "اسم الموظف مطلوب",
      });
    }

    if (!email || !email.trim()) {
      return res.status(400).json({
        message: "الإيميل مطلوب",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // =============================
    // Check employee
    // =============================

    const check = await pool.query(
      `
      SELECT employee_id
      FROM employees
      WHERE employee_id = $1
        AND is_deleted = 0
      `,
      [id]
    );

    if (check.rows.length === 0) {
      return res.status(404).json({
        message: "الموظف غير موجود",
      });
    }

    // =============================
    // Check email
    // =============================

    const emailCheck = await pool.query(
      `
      SELECT employee_id
      FROM employees
      WHERE LOWER(email) = $1
        AND employee_id != $2
      `,
      [normalizedEmail, id]
    );

    if (emailCheck.rows.length > 0) {
      return res.status(400).json({
        message: "الإيميل مستخدم مسبقاً",
      });
    }

    // =============================
    // Validate role
    // =============================

    const allowedRoles = ["employee", "admin"];

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        message: "الدور غير صالح",
      });
    }

    // =============================
    // Update
    // =============================

    const result = await pool.query(
      `
      UPDATE employees
      SET
        name = $1,
        department = $2,
        position = $3,
        email = $4,
        role = $5
      WHERE employee_id = $6
        AND is_deleted = 0
      RETURNING
        employee_id,
        name,
        email,
        department,
        position,
        role
      `,
      [
        name.trim(),
        department?.trim() || null,
        position?.trim() || null,
        normalizedEmail,
        role,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "الموظف غير موجود",
      });
    }

    return res.json({
      message: "تم تحديث الموظف بنجاح",
      employee: result.rows[0],
    });
  } catch (err) {
    console.error("Update Employee Error:", err);

    return res.status(500).json({
      message: "Update Employee Error",
    });
  }
};


/* =========================================================
   RESTORE EMPLOYEE
========================================================= */

exports.restoreEmployee = async (req, res) => {
  try {
    const { id } = req.params;

    if (!Number.isInteger(Number(id))) {
      return res.status(400).json({
        message: "معرف الموظف غير صالح",
      });
    }

    // =============================
    // Check deleted employee
    // =============================

    const check = await pool.query(
      `
      SELECT employee_id
      FROM employees
      WHERE employee_id = $1
        AND is_deleted = 1
      `,
      [id]
    );

    if (check.rows.length === 0) {
      return res.status(404).json({
        message: "الموظف المحذوف غير موجود",
      });
    }

    // =============================
    // Restore
    // =============================

    await pool.query(
      `
      UPDATE employees
      SET is_deleted = 0
      WHERE employee_id = $1
      `,
      [id]
    );

    return res.json({
      message: "تم استرجاع الموظف بنجاح",
    });
  } catch (err) {
    console.error("Restore Employee Error:", err);

    return res.status(500).json({
      message: "Restore Error",
    });
  }
};


/* =========================================================
   GET DELETED EMPLOYEES
========================================================= */

exports.getDeletedEmployees = async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        employee_id,
        name,
        email,
        department,
        position,
        role
      FROM employees
      WHERE is_deleted = 1
      ORDER BY employee_id DESC
      `
    );

    return res.json(result.rows);
  } catch (err) {
    console.error("Fetch Deleted Employees Error:", err);

    return res.status(500).json({
      message: "Fetch Deleted Error",
    });
  }
};