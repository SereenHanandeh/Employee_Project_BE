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


exports.getMe = async (req, res) => {
  try {
    console.log("REQ.USER:", req.user);

    // =====================================================
    // ADMIN
    // =====================================================
    if (req.user?.role === "admin") {
      const adminId = req.user.admin_id || req.user.id;

      if (!adminId) {
        return res.status(401).json({
          message: "تعذر تحديد المدير",
        });
      }

      const result = await pool.query(
        `
        SELECT
          admin_id,
          email
        FROM admins
        WHERE admin_id = $1
        LIMIT 1
        `,
        [adminId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          message: "المدير غير موجود",
        });
      }

      return res.json({
        id: result.rows[0].admin_id,
        admin_id: result.rows[0].admin_id,
        employee_id: null,
        email: result.rows[0].email,
        name: "المدير",
        role: "admin",
      });
    }

    // =====================================================
    // EMPLOYEE
    // =====================================================
    if (req.user?.role === "employee") {
      const employeeId =
        req.user.employee_id || req.user.id;

      if (!employeeId) {
        return res.status(401).json({
          message: "تعذر تحديد رقم الموظف",
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

      if (result.rows.length === 0) {
        return res.status(404).json({
          message: "الموظف غير موجود أو تم حذفه",
        });
      }

      return res.json({
        ...result.rows[0],
        id: result.rows[0].employee_id,
        employee_id: result.rows[0].employee_id,
        role: "employee",
      });
    }

    // =====================================================
    // UNKNOWN ROLE
    // =====================================================
    return res.status(403).json({
      message: "نوع المستخدم غير معروف",
    });

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

/* =========================================================
   UPDATE MY PROFILE
   الموظف يستطيع تعديل معلوماته الشخصية فقط
========================================================= */

exports.updateMyProfile = async (req, res) => {
  try {
    // =====================================================
    // CHECK USER
    // =====================================================

    if (req.user?.role !== "employee") {
      return res.status(403).json({
        message: "هذه العملية متاحة للموظفين فقط",
      });
    }

    const employeeId =
      req.user.employee_id || req.user.id;

    if (!employeeId) {
      return res.status(401).json({
        message: "تعذر تحديد رقم الموظف",
      });
    }

    // =====================================================
    // DATA
    // =====================================================

    const { name, email } = req.body;

    // =====================================================
    // VALIDATION
    // =====================================================

    if (!name || !name.trim()) {
      return res.status(400).json({
        message: "الاسم مطلوب",
      });
    }

    if (!email || !email.trim()) {
      return res.status(400).json({
        message: "الإيميل مطلوب",
      });
    }

    const normalizedEmail =
      email.trim().toLowerCase();

    // =====================================================
    // CHECK EMPLOYEE
    // =====================================================

    const employeeCheck = await pool.query(
      `
      SELECT employee_id
      FROM employees
      WHERE employee_id = $1
        AND is_deleted = 0
      LIMIT 1
      `,
      [employeeId]
    );

    if (employeeCheck.rows.length === 0) {
      return res.status(404).json({
        message: "الموظف غير موجود",
      });
    }

    // =====================================================
    // CHECK EMAIL
    // =====================================================

    const emailCheck = await pool.query(
      `
      SELECT employee_id
      FROM employees
      WHERE LOWER(email) = $1
        AND employee_id != $2
      LIMIT 1
      `,
      [
        normalizedEmail,
        employeeId,
      ]
    );

    if (emailCheck.rows.length > 0) {
      return res.status(400).json({
        message: "الإيميل مستخدم مسبقاً",
      });
    }

    // =====================================================
    // UPDATE
    // =====================================================

    const result = await pool.query(
      `
      UPDATE employees
      SET
        name = $1,
        email = $2
      WHERE employee_id = $3
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
        normalizedEmail,
        employeeId,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "الموظف غير موجود",
      });
    }

    return res.json({
      message: "تم تحديث معلوماتك بنجاح",
      employee: result.rows[0],
    });

  } catch (err) {
    console.error(
      "Update My Profile Error:",
      err
    );

    return res.status(500).json({
      message: "حدث خطأ أثناء تحديث المعلومات",
    });
  }
};


/* =========================================================
   CHANGE MY PASSWORD
   الموظف يستطيع تغيير كلمة مروره فقط
========================================================= */

exports.changeMyPassword = async (req, res) => {
  try {
    // =====================================================
    // CHECK USER
    // =====================================================

    if (req.user?.role !== "employee") {
      return res.status(403).json({
        message: "هذه العملية متاحة للموظفين فقط",
      });
    }

    const employeeId =
      req.user.employee_id || req.user.id;

    if (!employeeId) {
      return res.status(401).json({
        message: "تعذر تحديد رقم الموظف",
      });
    }

    // =====================================================
    // DATA
    // =====================================================

    const {
      currentPassword,
      newPassword,
    } = req.body;

    // =====================================================
    // VALIDATION
    // =====================================================

    if (!currentPassword) {
      return res.status(400).json({
        message: "كلمة المرور الحالية مطلوبة",
      });
    }

    if (!newPassword) {
      return res.status(400).json({
        message: "كلمة المرور الجديدة مطلوبة",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        message:
          "كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل",
      });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({
        message:
          "كلمة المرور الجديدة يجب أن تكون مختلفة عن الحالية",
      });
    }

    // =====================================================
    // GET CURRENT PASSWORD
    // =====================================================

    const result = await pool.query(
      `
      SELECT
        employee_id,
        password
      FROM employees
      WHERE employee_id = $1
        AND is_deleted = 0
      LIMIT 1
      `,
      [employeeId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "الموظف غير موجود",
      });
    }

    const employee = result.rows[0];

    // =====================================================
    // VERIFY CURRENT PASSWORD
    // =====================================================

    const isPasswordValid =
      await bcrypt.compare(
        currentPassword,
        employee.password
      );

    if (!isPasswordValid) {
      return res.status(400).json({
        message:
          "كلمة المرور الحالية غير صحيحة",
      });
    }

    // =====================================================
    // HASH NEW PASSWORD
    // =====================================================

    const hashedPassword =
      await bcrypt.hash(
        newPassword,
        10
      );

    // =====================================================
    // UPDATE PASSWORD
    // =====================================================

    await pool.query(
      `
      UPDATE employees
      SET password = $1
      WHERE employee_id = $2
        AND is_deleted = 0
      `,
      [
        hashedPassword,
        employeeId,
      ]
    );

    return res.json({
      message:
        "تم تغيير كلمة المرور بنجاح",
    });

  } catch (err) {
    console.error(
      "Change My Password Error:",
      err
    );

    return res.status(500).json({
      message:
        "حدث خطأ أثناء تغيير كلمة المرور",
    });
  }
};