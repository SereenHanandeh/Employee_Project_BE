const { pool } = require("../models/db");
const bcrypt = require("bcryptjs");
const XLSX = require("xlsx");

// =========================================================
// HELPER - VALIDATE DEPARTMENT
// =========================================================

const validateDepartment = async (department_id) => {
  if (
    department_id === undefined ||
    department_id === null ||
    department_id === ""
  ) {
    return {
      error: "القسم مطلوب",
    };
  }

  const departmentId = Number(department_id);

  if (!Number.isInteger(departmentId) || departmentId <= 0) {
    return {
      error: "معرف القسم غير صالح",
    };
  }

  const result = await pool.query(
    `
    SELECT
      department_id,
      name
    FROM departments
    WHERE department_id = $1
      AND is_deleted = 0
    LIMIT 1
    `,
    [departmentId]
  );

  if (result.rows.length === 0) {
    return {
      error: "القسم غير موجود أو غير نشط",
    };
  }

  return {
    department_id: result.rows[0].department_id,
    department_name: result.rows[0].name,
  };
};

// =========================================================
// CREATE EMPLOYEE
// =========================================================

exports.createEmployee = async (req, res) => {
  try {
    const {
      name,
      department_id,
      position,
      email,
      password,
      role,
    } = req.body;

    // =====================================================
    // VALIDATION
    // =====================================================

    if (!name || !name.trim()) {
      return res.status(400).json({
        message: "اسم الموظف مطلوب",
      });
    }

    if (!email || !email.trim()) {
      return res.status(400).json({
        message: "البريد الإلكتروني مطلوب",
      });
    }

    if (!password) {
      return res.status(400).json({
        message: "كلمة المرور مطلوبة",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message:
          "كلمة المرور يجب أن تكون 6 أحرف على الأقل",
      });
    }

    // =====================================================
    // NORMALIZE DATA
    // =====================================================

    const employeeName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const employeePosition =
      position?.trim() || null;

    // =====================================================
    // VALIDATE ROLE
    // =====================================================

    const allowedRoles = ["employee", "admin"];
    const employeeRole = role || "employee";

    if (!allowedRoles.includes(employeeRole)) {
      return res.status(400).json({
        message: "الدور غير صالح",
      });
    }

    // =====================================================
    // VALIDATE DEPARTMENT
    // =====================================================

    const departmentResult =
      await validateDepartment(department_id);

    if (departmentResult?.error) {
      return res.status(400).json({
        message: departmentResult.error,
      });
    }

    // =====================================================
    // CHECK EMAIL
    // =====================================================

    const emailCheck = await pool.query(
      `
      SELECT employee_id
      FROM employees
      WHERE LOWER(TRIM(email)) = $1
      LIMIT 1
      `,
      [normalizedEmail]
    );

    if (emailCheck.rows.length > 0) {
      return res.status(400).json({
        message: "الإيميل مستخدم مسبقاً",
      });
    }

    // =====================================================
    // HASH PASSWORD
    // =====================================================

    const hashedPassword = await bcrypt.hash(
      password,
      10
    );

    // =====================================================
    // CREATE EMPLOYEE
    //
    // department:
    // نحتفظ به أيضًا للتوافق مع البيانات القديمة
    // =====================================================

    const result = await pool.query(
      `
      INSERT INTO employees
      (
        name,
        department_id,
        department,
        position,
        email,
        password,
        role,
        is_deleted
      )
      VALUES
      (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        0
      )
      RETURNING
        employee_id,
        name,
        email,
        department_id,
        department,
        position,
        role,
        is_deleted
      `,
      [
        employeeName,
        departmentResult.department_id,
        departmentResult.department_name,
        employeePosition,
        normalizedEmail,
        hashedPassword,
        employeeRole,
      ]
    );

    return res.status(201).json({
      message: "تم إضافة الموظف بنجاح",

      employee: {
        ...result.rows[0],

        department_name:
          departmentResult.department_name,

        department:
          departmentResult.department_name,
      },
    });
  } catch (err) {
    console.error(
      "Create Employee Error:",
      err
    );

    // PostgreSQL unique violation
    if (err.code === "23505") {
      return res.status(409).json({
        message: "الإيميل مستخدم مسبقاً",
      });
    }

    // Foreign key violation
    if (err.code === "23503") {
      return res.status(400).json({
        message: "القسم المحدد غير صالح",
      });
    }

    return res.status(500).json({
      message:
        "حدث خطأ أثناء إنشاء الموظف",
    });
  }
};

// =========================================================
// GET ALL EMPLOYEES
// =========================================================

exports.getEmployees = async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        e.employee_id,
        e.name,
        e.email,

        e.department_id,

        COALESCE(
          d.name,
          e.department
        ) AS department_name,

        COALESCE(
          d.name,
          e.department
        ) AS department,

        e.position,
        e.role,
        e.is_deleted,

        CASE
          WHEN e.is_deleted = 1
            THEN 'deleted'
          ELSE 'active'
        END AS status

      FROM employees e

      LEFT JOIN departments d
        ON d.department_id = e.department_id

      ORDER BY e.employee_id DESC
      `
    );

    return res.json(result.rows);
  } catch (err) {
    console.error(
      "Fetch Employees Error:",
      err
    );

    return res.status(500).json({
      message:
        "حدث خطأ أثناء تحميل الموظفين",
    });
  }
};

// =========================================================
// GET ACTIVE EMPLOYEES
// يستخدم في طلب الإجازة
// =========================================================

exports.getActiveEmployees = async (
  req,
  res
) => {
  try {
    const result = await pool.query(
      `
      SELECT
        e.employee_id,
        e.name,
        e.email,

        e.department_id,

        COALESCE(
          d.name,
          e.department
        ) AS department_name,

        COALESCE(
          d.name,
          e.department
        ) AS department,

        e.position,
        e.role

      FROM employees e

      LEFT JOIN departments d
        ON d.department_id = e.department_id

      WHERE e.is_deleted = 0

      ORDER BY e.name ASC
      `
    );

    return res.json(result.rows);
  } catch (err) {
    console.error(
      "Fetch Active Employees Error:",
      err
    );

    return res.status(500).json({
      message:
        "حدث خطأ أثناء تحميل الموظفين النشطين",
    });
  }
};

// =========================================================
// GET ME
// =========================================================

exports.getMe = async (req, res) => {
  try {
    console.log("REQ.USER:", req.user);

    // =====================================================
    // ADMIN
    // =====================================================

    if (req.user?.role === "admin") {
      const adminId =
        req.user.admin_id || req.user.id;

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
        department_id: null,
        department: null,
        department_name: null,
        position: null,
        role: "admin",
        welcome_seen: true,
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
          e.employee_id,
          e.name,
          e.email,
          e.department_id,

          COALESCE(
            d.name,
            e.department
          ) AS department_name,

          COALESCE(
            d.name,
            e.department
          ) AS department,

          e.position,
          e.role,
          e.welcome_seen

        FROM employees e

        LEFT JOIN departments d
          ON d.department_id = e.department_id

        WHERE e.employee_id = $1
          AND e.is_deleted = 0

        LIMIT 1
        `,
        [employeeId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          message:
            "الموظف غير موجود أو تم حذفه",
        });
      }

      const employee = result.rows[0];

      return res.json({
        ...employee,

        id: employee.employee_id,

        employee_id:
          employee.employee_id,

        department:
          employee.department_name ||
          employee.department ||
          null,

        department_name:
          employee.department_name ||
          employee.department ||
          null,

        role: "employee",

        welcome_seen:
          employee.welcome_seen === true,
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
      error:
        process.env.NODE_ENV === "development"
          ? err.message
          : undefined,
    });
  }
};

// =========================================================
// DELETE EMPLOYEE
// Soft Delete
// =========================================================

exports.deleteEmployee = async (
  req,
  res
) => {
  try {
    const { id } = req.params;

    const employeeId = Number(id);

    if (
      !Number.isInteger(employeeId) ||
      employeeId <= 0
    ) {
      return res.status(400).json({
        message:
          "معرف الموظف غير صالح",
      });
    }

    // =====================================================
    // CHECK EMPLOYEE
    // =====================================================

    const check = await pool.query(
      `
      SELECT
        employee_id
      FROM employees
      WHERE employee_id = $1
        AND is_deleted = 0
      LIMIT 1
      `,
      [employeeId]
    );

    if (check.rows.length === 0) {
      return res.status(404).json({
        message:
          "الموظف غير موجود",
      });
    }

    // =====================================================
    // SOFT DELETE
    // =====================================================

    await pool.query(
      `
      UPDATE employees
      SET is_deleted = 1
      WHERE employee_id = $1
      `,
      [employeeId]
    );

    return res.json({
      message:
        "تم حذف الموظف بنجاح",
    });
  } catch (err) {
    console.error(
      "Delete Employee Error:",
      err
    );

    return res.status(500).json({
      message:
        "حدث خطأ أثناء حذف الموظف",
    });
  }
};

// =========================================================
// UPDATE EMPLOYEE
// =========================================================

exports.updateEmployee = async (
  req,
  res
) => {
  try {
    const { id } = req.params;

    const {
      name,
      department_id,
      position,
      email,
      role,
    } = req.body;

    const employeeId = Number(id);

    // =====================================================
    // VALIDATE ID
    // =====================================================

    if (
      !Number.isInteger(employeeId) ||
      employeeId <= 0
    ) {
      return res.status(400).json({
        message:
          "معرف الموظف غير صالح",
      });
    }

    // =====================================================
    // VALIDATE NAME
    // =====================================================

    if (!name || !name.trim()) {
      return res.status(400).json({
        message:
          "اسم الموظف مطلوب",
      });
    }

    // =====================================================
    // VALIDATE EMAIL
    // =====================================================

    if (!email || !email.trim()) {
      return res.status(400).json({
        message:
          "الإيميل مطلوب",
      });
    }

    const employeeName = name.trim();

    const normalizedEmail =
      email.trim().toLowerCase();

    const employeePosition =
      position?.trim() || null;

    // =====================================================
    // CHECK EMPLOYEE
    // =====================================================

    const employeeCheck =
      await pool.query(
        `
        SELECT
          employee_id
        FROM employees
        WHERE employee_id = $1
          AND is_deleted = 0
        LIMIT 1
        `,
        [employeeId]
      );

    if (employeeCheck.rows.length === 0) {
      return res.status(404).json({
        message:
          "الموظف غير موجود",
      });
    }

    // =====================================================
    // VALIDATE DEPARTMENT
    // =====================================================

    const departmentResult =
      await validateDepartment(
        department_id
      );

    if (departmentResult?.error) {
      return res.status(400).json({
        message:
          departmentResult.error,
      });
    }

    // =====================================================
    // CHECK EMAIL
    // =====================================================

    const emailCheck =
      await pool.query(
        `
        SELECT
          employee_id
        FROM employees
        WHERE LOWER(TRIM(email)) = $1
          AND employee_id <> $2
        LIMIT 1
        `,
        [
          normalizedEmail,
          employeeId,
        ]
      );

    if (emailCheck.rows.length > 0) {
      return res.status(400).json({
        message:
          "الإيميل مستخدم مسبقاً",
      });
    }

    // =====================================================
    // VALIDATE ROLE
    // =====================================================

    const allowedRoles = [
      "employee",
      "admin",
    ];

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        message:
          "الدور غير صالح",
      });
    }

    // =====================================================
    // UPDATE EMPLOYEE
    //
    // نحدث department_id و department معًا
    // حتى نبقى متوافقين مع البيانات القديمة
    // =====================================================

    const result = await pool.query(
      `
      UPDATE employees

      SET
        name = $1,
        department_id = $2,
        department = $3,
        position = $4,
        email = $5,
        role = $6

      WHERE employee_id = $7
        AND is_deleted = 0

      RETURNING
        employee_id,
        name,
        email,
        department_id,
        department,
        position,
        role
      `,
      [
        employeeName,
        departmentResult.department_id,
        departmentResult.department_name,
        employeePosition,
        normalizedEmail,
        role,
        employeeId,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message:
          "الموظف غير موجود",
      });
    }

    return res.json({
      message:
        "تم تحديث الموظف بنجاح",

      employee: {
        ...result.rows[0],

        department_name:
          departmentResult.department_name,

        department:
          departmentResult.department_name,
      },
    });
  } catch (err) {
    console.error(
      "Update Employee Error:",
      err
    );

    if (err.code === "23505") {
      return res.status(409).json({
        message:
          "الإيميل مستخدم مسبقاً",
      });
    }

    if (err.code === "23503") {
      return res.status(400).json({
        message:
          "القسم المحدد غير صالح",
      });
    }

    return res.status(500).json({
      message:
        "حدث خطأ أثناء تحديث الموظف",
    });
  }
};

// =========================================================
// RESTORE EMPLOYEE
// =========================================================

exports.restoreEmployee = async (
  req,
  res
) => {
  try {
    const { id } = req.params;

    const employeeId = Number(id);

    if (
      !Number.isInteger(employeeId) ||
      employeeId <= 0
    ) {
      return res.status(400).json({
        message:
          "معرف الموظف غير صالح",
      });
    }

    // =====================================================
    // CHECK DELETED EMPLOYEE
    // =====================================================

    const check = await pool.query(
      `
      SELECT
        employee_id
      FROM employees
      WHERE employee_id = $1
        AND is_deleted = 1
      LIMIT 1
      `,
      [employeeId]
    );

    if (check.rows.length === 0) {
      return res.status(404).json({
        message:
          "الموظف المحذوف غير موجود",
      });
    }

    // =====================================================
    // RESTORE
    // =====================================================

    await pool.query(
      `
      UPDATE employees

      SET is_deleted = 0

      WHERE employee_id = $1
      `,
      [employeeId]
    );

    return res.json({
      message:
        "تم استرجاع الموظف بنجاح",
    });
  } catch (err) {
    console.error(
      "Restore Employee Error:",
      err
    );

    return res.status(500).json({
      message:
        "حدث خطأ أثناء استرجاع الموظف",
    });
  }
};

// =========================================================
// GET DELETED EMPLOYEES
// =========================================================

exports.getDeletedEmployees = async (
  req,
  res
) => {
  try {
    const result = await pool.query(
      `
      SELECT
        e.employee_id,
        e.name,
        e.email,

        e.department_id,

        COALESCE(
          d.name,
          e.department
        ) AS department_name,

        COALESCE(
          d.name,
          e.department
        ) AS department,

        e.position,
        e.role,
        e.is_deleted

      FROM employees e

      LEFT JOIN departments d
        ON d.department_id = e.department_id

      WHERE e.is_deleted = 1

      ORDER BY e.employee_id DESC
      `
    );

    return res.json(result.rows);
  } catch (err) {
    console.error(
      "Fetch Deleted Employees Error:",
      err
    );

    return res.status(500).json({
      message:
        "حدث خطأ أثناء تحميل الموظفين المحذوفين",
    });
  }
};

// =========================================================
// UPDATE MY PROFILE
// الموظف يستطيع تعديل الاسم والإيميل فقط
// =========================================================

exports.updateMyProfile = async (
  req,
  res
) => {
  try {
    // =====================================================
    // CHECK ROLE
    // =====================================================

    if (req.user?.role !== "employee") {
      return res.status(403).json({
        message:
          "هذه العملية متاحة للموظفين فقط",
      });
    }

    const employeeId =
      req.user.employee_id ||
      req.user.id;

    if (!employeeId) {
      return res.status(401).json({
        message:
          "تعذر تحديد رقم الموظف",
      });
    }

    const { name, email } = req.body;

    // =====================================================
    // VALIDATE NAME
    // =====================================================

    if (!name || !name.trim()) {
      return res.status(400).json({
        message: "الاسم مطلوب",
      });
    }

    // =====================================================
    // VALIDATE EMAIL
    // =====================================================

    if (!email || !email.trim()) {
      return res.status(400).json({
        message:
          "الإيميل مطلوب",
      });
    }

    const employeeName =
      name.trim();

    const normalizedEmail =
      email.trim().toLowerCase();

    // =====================================================
    // CHECK EMPLOYEE
    // =====================================================

    const employeeCheck =
      await pool.query(
        `
        SELECT
          employee_id
        FROM employees
        WHERE employee_id = $1
          AND is_deleted = 0
        LIMIT 1
        `,
        [employeeId]
      );

    if (employeeCheck.rows.length === 0) {
      return res.status(404).json({
        message:
          "الموظف غير موجود",
      });
    }

    // =====================================================
    // CHECK EMAIL
    // =====================================================

    const emailCheck =
      await pool.query(
        `
        SELECT
          employee_id
        FROM employees
        WHERE LOWER(TRIM(email)) = $1
          AND employee_id <> $2
        LIMIT 1
        `,
        [
          normalizedEmail,
          employeeId,
        ]
      );

    if (emailCheck.rows.length > 0) {
      return res.status(400).json({
        message:
          "الإيميل مستخدم مسبقاً",
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
        department_id,
        department,
        position,
        role
      `,
      [
        employeeName,
        normalizedEmail,
        employeeId,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message:
          "الموظف غير موجود",
      });
    }

    // =====================================================
    // GET DEPARTMENT NAME
    // =====================================================

    const employee =
      result.rows[0];

    const departmentResult =
      await pool.query(
        `
        SELECT name
        FROM departments
        WHERE department_id = $1
        LIMIT 1
        `,
        [
          employee.department_id,
        ]
      );

    const departmentName =
      departmentResult.rows[0]?.name ||
      employee.department ||
      null;

    return res.json({
      message:
        "تم تحديث معلوماتك بنجاح",

      employee: {
        ...employee,

        department_name:
          departmentName,

        department:
          departmentName,
      },
    });
  } catch (err) {
    console.error(
      "Update My Profile Error:",
      err
    );

    if (err.code === "23505") {
      return res.status(409).json({
        message:
          "الإيميل مستخدم مسبقاً",
      });
    }

    return res.status(500).json({
      message:
        "حدث خطأ أثناء تحديث المعلومات",
    });
  }
};

// =========================================================
// CHANGE MY PASSWORD
// =========================================================

exports.changeMyPassword = async (
  req,
  res
) => {
  try {
    // =====================================================
    // CHECK ROLE
    // =====================================================

    if (req.user?.role !== "employee") {
      return res.status(403).json({
        message:
          "هذه العملية متاحة للموظفين فقط",
      });
    }

    const employeeId =
      req.user.employee_id ||
      req.user.id;

    if (!employeeId) {
      return res.status(401).json({
        message:
          "تعذر تحديد رقم الموظف",
      });
    }

    const {
      currentPassword,
      newPassword,
    } = req.body;

    // =====================================================
    // VALIDATION
    // =====================================================

    if (!currentPassword) {
      return res.status(400).json({
        message:
          "كلمة المرور الحالية مطلوبة",
      });
    }

    if (!newPassword) {
      return res.status(400).json({
        message:
          "كلمة المرور الجديدة مطلوبة",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        message:
          "كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل",
      });
    }

    if (
      currentPassword === newPassword
    ) {
      return res.status(400).json({
        message:
          "كلمة المرور الجديدة يجب أن تكون مختلفة عن الحالية",
      });
    }

    // =====================================================
    // GET EMPLOYEE PASSWORD
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
        message:
          "الموظف غير موجود",
      });
    }

    const employee =
      result.rows[0];

    // =====================================================
    // CHECK CURRENT PASSWORD
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

// =====================================================
// MARK WELCOME AS SEEN
// =====================================================

exports.markWelcomeSeen = async (req, res) => {
  try {
    if (req.user?.role !== "employee") {
      return res.status(403).json({
        message: "غير مسموح",
      });
    }

    const employeeId =
      req.user.employee_id || req.user.id;

    if (!employeeId) {
      return res.status(401).json({
        message: "تعذر تحديد رقم الموظف",
      });
    }

    const result = await pool.query(
      `
      UPDATE employees
      SET welcome_seen = TRUE
      WHERE employee_id = $1
        AND is_deleted = 0
      RETURNING employee_id, welcome_seen
      `,
      [employeeId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "الموظف غير موجود",
      });
    }

    return res.json({
      success: true,
      welcome_seen:
        result.rows[0].welcome_seen,
    });
  } catch (err) {
    console.error(
      "MARK WELCOME SEEN ERROR:",
      err
    );

    return res.status(500).json({
      message: "حدث خطأ في الخادم",
    });
  }
};

// =========================================================
// HELPER - PARSE JOB DESCRIPTION POINTS
// =========================================================

const parseJobPoints = (raw) => {
  if (!raw) return [];

  if (Array.isArray(raw)) return raw;

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [String(raw)];
  } catch {
    // بيانات قديمة كانت نص عادي وليست JSON
    return [String(raw)];
  }
};

// =========================================================
// GET JOB DESCRIPTIONS
// =========================================================

exports.getJobDescriptions = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        e.employee_id,
        e.name,
        e.email,
        e.position,
        e.job_description,
        e.role,
        e.created_at,

        COALESCE(d.name, e.department) AS department_name,

        COALESCE(
          json_agg(
            json_build_object(
              'task_id', t.task_id,
              'title', t.title,
              'description', t.description,
              'status', et.status
            )
          ) FILTER (WHERE t.task_id IS NOT NULL),
          '[]'
        ) AS tasks

      FROM employees e
      LEFT JOIN departments d
        ON d.department_id = e.department_id
      LEFT JOIN employee_tasks et
        ON et.employee_id = e.employee_id
      LEFT JOIN tasks t
        ON t.task_id = et.task_id

      WHERE e.is_deleted = 0

      GROUP BY e.employee_id, d.name
      ORDER BY e.name ASC
    `);

    const employees = result.rows.map((emp) => ({
      ...emp,
      job_description_points: parseJobPoints(emp.job_description),
    }));

    return res.json(employees);
  } catch (err) {
    console.error("Get Job Descriptions Error:", err);
    return res.status(500).json({
      message: "حدث خطأ أثناء تحميل الوصف الوظيفي",
    });
  }
};

// =========================================================
// UPDATE JOB DESCRIPTION (نقاط متعددة)
// =========================================================

exports.updateJobDescription = async (req, res) => {
  try {
    const { id } = req.params;
    const { points } = req.body;

    const employeeId = Number(id);

    if (!Number.isInteger(employeeId) || employeeId <= 0) {
      return res.status(400).json({ message: "معرف الموظف غير صالح" });
    }

    const cleanPoints = Array.isArray(points)
      ? points
          .map((p) => String(p).trim())
          .filter((p) => p.length > 0)
      : [];

    const result = await pool.query(
      `
      UPDATE employees
      SET job_description = $1
      WHERE employee_id = $2
        AND is_deleted = 0
      RETURNING employee_id
      `,
      [JSON.stringify(cleanPoints), employeeId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "الموظف غير موجود" });
    }

    return res.json({
      message: "تم تحديث الوصف الوظيفي بنجاح",
      employee_id: employeeId,
      job_description_points: cleanPoints,
    });
  } catch (err) {
    console.error("Update Job Description Error:", err);
    return res.status(500).json({
      message: "حدث خطأ أثناء تحديث الوصف الوظيفي",
    });
  }
};

// =========================================================
// DELETE JOB DESCRIPTION (نقل لسلة المهملات)
// =========================================================

exports.deleteJobDescription = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const employeeId = Number(id);

    if (!Number.isInteger(employeeId) || employeeId <= 0) {
      client.release();
      return res.status(400).json({ message: "معرف الموظف غير صالح" });
    }

    const empResult = await client.query(
      `
      SELECT employee_id, name, job_description
      FROM employees
      WHERE employee_id = $1
        AND is_deleted = 0
      LIMIT 1
      `,
      [employeeId]
    );

    if (empResult.rows.length === 0) {
      client.release();
      return res.status(404).json({ message: "الموظف غير موجود" });
    }

    const employee = empResult.rows[0];
    const points = parseJobPoints(employee.job_description);

    if (points.length === 0) {
      client.release();
      return res.status(400).json({
        message: "لا يوجد وصف وظيفي لحذفه",
      });
    }

    await client.query("BEGIN");

    await client.query(
      `
      INSERT INTO job_description_trash
        (employee_id, employee_name, job_description_points)
      VALUES ($1, $2, $3)
      `,
      [employeeId, employee.name, JSON.stringify(points)]
    );

    await client.query(
      `UPDATE employees SET job_description = NULL WHERE employee_id = $1`,
      [employeeId]
    );

    await client.query("COMMIT");

    return res.json({
      message: "تم نقل الوصف الوظيفي إلى سلة المهملات",
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Delete Job Description Error:", err);
    return res.status(500).json({
      message: "حدث خطأ أثناء حذف الوصف الوظيفي",
    });
  } finally {
    client.release();
  }
};

// =========================================================
// GET TRASH LIST
// =========================================================

exports.getJobDescriptionTrash = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        trash_id,
        employee_id,
        employee_name,
        job_description_points,
        deleted_at
      FROM job_description_trash
      ORDER BY deleted_at DESC
    `);

    return res.json(result.rows);
  } catch (err) {
    console.error("Get Job Description Trash Error:", err);
    return res.status(500).json({
      message: "حدث خطأ أثناء تحميل سلة المهملات",
    });
  }
};

// =========================================================
// RESTORE FROM TRASH
// =========================================================

exports.restoreJobDescription = async (req, res) => {
  const client = await pool.connect();

  try {
    const { trashId } = req.params;
    const id = Number(trashId);

    if (!Number.isInteger(id) || id <= 0) {
      client.release();
      return res.status(400).json({ message: "معرف غير صالح" });
    }

    const trashResult = await client.query(
      `SELECT * FROM job_description_trash WHERE trash_id = $1 LIMIT 1`,
      [id]
    );

    if (trashResult.rows.length === 0) {
      client.release();
      return res.status(404).json({
        message: "العنصر غير موجود في سلة المهملات",
      });
    }

    const trashItem = trashResult.rows[0];

    const employeeCheck = await client.query(
      `
      SELECT employee_id
      FROM employees
      WHERE employee_id = $1
        AND is_deleted = 0
      LIMIT 1
      `,
      [trashItem.employee_id]
    );

    if (employeeCheck.rows.length === 0) {
      client.release();
      return res.status(404).json({
        message: "لا يمكن الاسترجاع، الموظف غير موجود حالياً",
      });
    }

    await client.query("BEGIN");

    await client.query(
      `UPDATE employees SET job_description = $1 WHERE employee_id = $2`,
      [
        JSON.stringify(trashItem.job_description_points),
        trashItem.employee_id,
      ]
    );

    await client.query(
      `DELETE FROM job_description_trash WHERE trash_id = $1`,
      [id]
    );

    await client.query("COMMIT");

    return res.json({ message: "تم استرجاع الوصف الوظيفي بنجاح" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Restore Job Description Error:", err);
    return res.status(500).json({
      message: "حدث خطأ أثناء استرجاع الوصف الوظيفي",
    });
  } finally {
    client.release();
  }
};

// =========================================================
// PERMANENTLY DELETE FROM TRASH
// =========================================================

exports.permanentlyDeleteJobDescription = async (req, res) => {
  try {
    const { trashId } = req.params;
    const id = Number(trashId);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "معرف غير صالح" });
    }

    const result = await pool.query(
      `DELETE FROM job_description_trash WHERE trash_id = $1 RETURNING trash_id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "العنصر غير موجود" });
    }

    return res.json({ message: "تم الحذف النهائي بنجاح" });
  } catch (err) {
    console.error("Permanently Delete Job Description Error:", err);
    return res.status(500).json({
      message: "حدث خطأ أثناء الحذف النهائي",
    });
  }
};



// =========================================================
// HELPER - تحويل ملف إكسل إلى مصفوفة صفوف
// =========================================================

const excelBufferToRows = (buffer) => {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
  });
};

const findColumnIndex = (headerRow, possibleNames) => {
  const normalize = (s) =>
    String(s || "")
      .replace(/[\u200B\u200E\u200F\uFEFF]/g, "")
      .replace(/[\u064B-\u065F\u0670]/g, "")
      .replace(/[أإآ]/g, "ا")
      .replace(/ى/g, "ي")
      .replace(/ة/g, "ه")
      .trim()
      .toLowerCase()
      .replace(/[*:،,]/g, "")
      .replace(/\s+/g, " ");

  const normalizedHeaders = headerRow.map((h) => normalize(h));
  const normalizedTargets = possibleNames.map((n) => normalize(n));

  for (let i = 0; i < normalizedHeaders.length; i++) {
    const header = normalizedHeaders[i];

    const isMatch = normalizedTargets.some(
      (target) => header.includes(target) || target.includes(header)
    );

    if (isMatch) return i;
  }

  return -1;
};

// =========================================================
// PREVIEW EMPLOYEES EXCEL IMPORT
// =========================================================

exports.previewEmployeeImport = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        message: "الرجاء رفع ملف إكسل",
      });
    }

    let rows;

    try {
      rows = excelBufferToRows(req.file.buffer);
    } catch (e) {
      return res.status(400).json({
        message: "تعذر قراءة الملف، تأكد أنه ملف إكسل صالح",
      });
    }

    rows = rows.filter((row) =>
      row.some((cell) => String(cell || "").trim() !== "")
    );

    if (rows.length < 2) {
      return res.status(400).json({
        message: "الملف فارغ أو لا يحتوي على بيانات",
      });
    }

    const headerRow = rows[0];

    const nameIdx = findColumnIndex(headerRow, [
      "الاسم",
      "اسم الموظف",
      "name",
    ]);
    const emailIdx = findColumnIndex(headerRow, [
      "البريد",
      "الإيميل",
      "email",
    ]);
    const departmentIdx = findColumnIndex(headerRow, [
      "القسم",
      "department",
    ]);
    const positionIdx = findColumnIndex(headerRow, [
      "المسمى الوظيفي",
      "المسمى",
      "المنصب",
      "position",
    ]);
    const passwordIdx = findColumnIndex(headerRow, [
      "كلمة المرور",
      "الباسورد",
      "password",
    ]);
    const roleIdx = findColumnIndex(headerRow, [
      "الدور",
      "الصلاحية",
      "role",
    ]);

 if (nameIdx === -1 || emailIdx === -1) {
  console.log("HEADER ROW RAW:", JSON.stringify(headerRow));
  return res.status(400).json({
    message:
      "لم يتم العثور على عمود 'الاسم' أو 'البريد الإلكتروني'. تأكد من رؤوس الأعمدة.",
  });
}
    const dataRows = rows.slice(1);

    const departmentsResult = await pool.query(
      `SELECT department_id, name FROM departments WHERE is_deleted = 0`
    );

    const normalize = (s) =>
      String(s || "").trim().toLowerCase().replace(/\s+/g, " ");

    const departmentsMap = departmentsResult.rows.map((d) => ({
      department_id: d.department_id,
      name: d.name,
      normalized: normalize(d.name),
    }));

    const employeesResult = await pool.query(
      `SELECT email FROM employees WHERE is_deleted = 0`
    );

    const existingEmails = new Set(
      employeesResult.rows.map((e) => normalize(e.email))
    );

    const seenEmailsInFile = new Set();

    const preview = dataRows.map((row) => {
      const rawName = String(row[nameIdx] || "").trim();
      const rawEmail = String(row[emailIdx] || "").trim();
      const rawDepartment =
        departmentIdx !== -1
          ? String(row[departmentIdx] || "").trim()
          : "";
      const rawPosition =
        positionIdx !== -1
          ? String(row[positionIdx] || "").trim()
          : "";
      const rawPassword =
        passwordIdx !== -1
          ? String(row[passwordIdx] || "").trim()
          : "";
      const rawRole =
        roleIdx !== -1
          ? String(row[roleIdx] || "").trim().toLowerCase()
          : "";

      const errors = [];

      if (!rawName) errors.push("الاسم مفقود");
      if (!rawEmail) errors.push("البريد الإلكتروني مفقود");

      const normalizedEmail = normalize(rawEmail);

      if (rawEmail && existingEmails.has(normalizedEmail)) {
        errors.push("البريد مستخدم مسبقاً في النظام");
      }

      if (rawEmail && seenEmailsInFile.has(normalizedEmail)) {
        errors.push("البريد مكرر داخل الملف");
      }

      if (normalizedEmail) seenEmailsInFile.add(normalizedEmail);

      let matchedDepartment = null;

      if (rawDepartment) {
        matchedDepartment = departmentsMap.find(
          (d) => d.normalized === normalize(rawDepartment)
        );

        if (!matchedDepartment) {
          errors.push(`القسم "${rawDepartment}" غير موجود`);
        }
      } else {
        errors.push("القسم مفقود");
      }

      const role = ["employee", "admin"].includes(rawRole)
        ? rawRole
        : "employee";

const password = rawPassword || "123456";

     return {
  raw_name: rawName,
  raw_email: rawEmail,
  raw_department: rawDepartment,
  department_id: matchedDepartment?.department_id || null,
  department_name: matchedDepartment?.name || null,
  position: rawPosition || null,
  role,
  password,
  password_was_generated: !rawPassword, // يعني استخدمنا الافتراضية 123456
  valid: errors.length === 0,
  errors,
};
    });

    return res.json({
      total_rows: preview.length,
      valid_count: preview.filter((p) => p.valid).length,
      invalid_count: preview.filter((p) => !p.valid).length,
      rows: preview,
      available_departments: departmentsMap.map((d) => ({
        department_id: d.department_id,
        name: d.name,
      })),
    });
  } catch (err) {
    console.error("Preview Employee Import Error:", err);
    return res.status(500).json({
      message: "حدث خطأ أثناء قراءة ملف الموظفين",
    });
  }
};

// =========================================================
// CONFIRM EMPLOYEES EXCEL IMPORT
// =========================================================

exports.confirmEmployeeImport = async (req, res) => {
  const client = await pool.connect();

  try {
    const { employees: items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      client.release();
      return res.status(400).json({
        message: "لا يوجد بيانات لاستيرادها",
      });
    }

    await client.query("BEGIN");

    const created = [];
    const failed = [];

    for (const item of items) {
      try {
        const name = String(item.name || "").trim();
        const email = String(item.email || "").trim().toLowerCase();
        const departmentId = Number(item.department_id);
        const position = item.position
          ? String(item.position).trim()
          : null;
        const role = ["employee", "admin"].includes(item.role)
          ? item.role
          : "employee";
        const password = String(item.password || "");

        if (!name || !email || !departmentId || password.length < 6) {
          failed.push({ email, reason: "بيانات ناقصة أو غير صالحة" });
          continue;
        }

        const emailCheck = await client.query(
          `SELECT employee_id FROM employees WHERE LOWER(TRIM(email)) = $1 LIMIT 1`,
          [email]
        );

        if (emailCheck.rows.length > 0) {
          failed.push({ email, reason: "البريد مستخدم مسبقاً" });
          continue;
        }

        const deptResult = await client.query(
          `SELECT department_id, name FROM departments WHERE department_id = $1 AND is_deleted = 0 LIMIT 1`,
          [departmentId]
        );

        if (deptResult.rows.length === 0) {
          failed.push({ email, reason: "القسم غير صالح" });
          continue;
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await client.query(
          `
          INSERT INTO employees
            (name, department_id, department, position, email, password, role, is_deleted)
          VALUES ($1, $2, $3, $4, $5, $6, $7, 0)
          RETURNING employee_id, name, email
          `,
          [
            name,
            deptResult.rows[0].department_id,
            deptResult.rows[0].name,
            position,
            email,
            hashedPassword,
            role,
          ]
        );

        created.push({
          ...result.rows[0],
          password, // ترجع مرة واحدة فقط لتسليمها للموظف
        });
      } catch (rowErr) {
        console.error("Import Row Error:", rowErr);
        failed.push({ email: item.email, reason: "خطأ غير متوقع" });
      }
    }

    await client.query("COMMIT");

    return res.json({
      message: `تم إضافة ${created.length} موظف بنجاح${
        failed.length ? ` (فشل ${failed.length})` : ""
      }`,
      created,
      failed,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Confirm Employee Import Error:", err);
    return res.status(500).json({
      message: "حدث خطأ أثناء تنفيذ الاستيراد",
    });
  } finally {
    client.release();
  }
};

// =========================================================
// HELPER - تعبئة الخلايا الفارغة بالقيمة السابقة (Fill Down)
// مفيدة لأن خلايا الإكسل المدمجة (merged cells) تطلع فاضية
// في كل الصفوف عدا الصف الأول من الدمج
// =========================================================

const fillDownColumn = (rows, colIndex, startRow) => {
  if (colIndex === -1) return;

  let lastValue = "";

  for (let r = startRow; r < rows.length; r++) {
    const value = String(rows[r][colIndex] || "").trim();

    if (value) {
      lastValue = value;
    } else {
      rows[r][colIndex] = lastValue;
    }
  }
};

// =========================================================
// PREVIEW JOB DESCRIPTION EXCEL IMPORT
// =========================================================

exports.previewJobDescriptionImport = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        message: "الرجاء رفع ملف إكسل",
      });
    }

    let rows;

    try {
      rows = excelBufferToRows(req.file.buffer);
    } catch (e) {
      return res.status(400).json({
        message: "تعذر قراءة الملف، تأكد أنه ملف إكسل صالح",
      });
    }

    rows = rows.filter((row) =>
      row.some((cell) => String(cell || "").trim() !== "")
    );

    if (rows.length < 2) {
      return res.status(400).json({
        message: "الملف فارغ أو لا يحتوي على بيانات",
      });
    }

    const headerRow = rows[0];

    const nameIdx = findColumnIndex(headerRow, ["الاسم", "اسم الموظف", "name"]);
    const emailIdx = findColumnIndex(headerRow, ["البريد", "الإيميل", "email"]);
    const pointIdx = findColumnIndex(headerRow, [
       "المهام الموكلة",
      "نقطة الوصف الوظيفي",
      "الوصف الوظيفي",
      "نقطة",
    ]);

    if (nameIdx === -1 || pointIdx === -1) {
      return res.status(400).json({
        message:
          "لم يتم العثور على عمود 'الاسم' أو عمود 'نقطة الوصف الوظيفي'. تأكد من رؤوس الأعمدة.",
      });
    }

    const dataRows = rows.slice(1);

    // تعويض الخلايا الفارغة الناتجة عن الدمج (merged cells)
    [nameIdx, emailIdx].forEach((idx) => {
      fillDownColumn(dataRows, idx, 0);
    });

    const cleanRows = dataRows.filter((row) =>
      row.some((cell) => String(cell || "").trim() !== "")
    );

    const groups = [];
    let currentGroup = null;

    cleanRows.forEach((row) => {
      const rawName = String(row[nameIdx] || "").trim();
      const rawEmail = emailIdx !== -1 ? String(row[emailIdx] || "").trim() : "";
      const point = String(row[pointIdx] || "").trim();

      const key = `${rawName}|${rawEmail}`;

      if (!currentGroup || currentGroup.key !== key) {
        currentGroup = {
          key,
          raw_name: rawName,
          raw_email: rawEmail,
          points: [],
        };

        groups.push(currentGroup);
      }

      if (point && point !== "لا يوجد وصف وظيفي") {
        currentGroup.points.push(point);
      }
    });

    if (groups.length === 0) {
      return res.status(400).json({
        message: "لم يتم العثور على بيانات صالحة داخل الملف",
      });
    }

    const employeesResult = await pool.query(`
      SELECT employee_id, name, email
      FROM employees
      WHERE is_deleted = 0
    `);

    const normalize = (str) =>
      String(str || "").trim().toLowerCase().replace(/\s+/g, " ");

    const employeesList = employeesResult.rows.map((e) => ({
      employee_id: e.employee_id,
      name: e.name,
      email: e.email,
      normalized_name: normalize(e.name),
      normalized_email: normalize(e.email),
    }));

    const preview = groups.map((group) => {
      const normalizedEmail = normalize(group.raw_email);
      const normalizedName = normalize(group.raw_name);

      let matched = normalizedEmail
        ? employeesList.find((e) => e.normalized_email === normalizedEmail)
        : null;

      let matchType = matched ? "email" : null;

      if (!matched) {
        matched = employeesList.find(
          (e) => e.normalized_name === normalizedName
        );
        matchType = matched ? "exact_name" : null;
      }

      if (!matched) {
        matched = employeesList.find(
          (e) =>
            e.normalized_name.includes(normalizedName) ||
            normalizedName.includes(e.normalized_name)
        );
        matchType = matched ? "partial_name" : "none";
      }

      return {
        raw_name: group.raw_name,
        raw_email: group.raw_email,
        points: group.points,
        matched_employee_id: matched?.employee_id || null,
        matched_employee_name: matched?.name || null,
        match_type: matchType || "none",
      };
    });

    return res.json({
      total_rows: preview.length,
      matched_count: preview.filter((p) => p.matched_employee_id).length,
      unmatched_count: preview.filter((p) => !p.matched_employee_id).length,
      rows: preview,
      available_employees: employeesList.map((e) => ({
        employee_id: e.employee_id,
        name: e.name,
      })),
    });
  } catch (err) {
    console.error("Preview Job Description Import Error:", err);
    return res.status(500).json({
      message: "حدث خطأ أثناء قراءة ملف الإكسل",
    });
  }
};

// =========================================================
// CONFIRM IMPORT (تطبيق التحديثات بعد المعاينة)
// =========================================================

exports.confirmJobDescriptionImport = async (req, res) => {
  const client = await pool.connect();

  try {
    const { items } = req.body;
    // items = [{ employee_id, points: [...] }]

    if (!Array.isArray(items) || items.length === 0) {
      client.release();
      return res.status(400).json({
        message: "لا يوجد بيانات لاستيرادها",
      });
    }

    await client.query("BEGIN");

    const updated = [];

    for (const item of items) {
      const employeeId = Number(item.employee_id);

      if (!Number.isInteger(employeeId) || employeeId <= 0) continue;

      const cleanPoints = Array.isArray(item.points)
        ? item.points
            .map((p) => String(p).trim())
            .filter((p) => p.length > 0)
        : [];

      if (cleanPoints.length === 0) continue;

      const result = await client.query(
        `
        UPDATE employees
        SET job_description = $1
        WHERE employee_id = $2
          AND is_deleted = 0
        RETURNING employee_id, name
        `,
        [JSON.stringify(cleanPoints), employeeId]
      );

      if (result.rows.length > 0) {
        updated.push(result.rows[0]);
      }
    }

    await client.query("COMMIT");

    return res.json({
      message: `تم تحديث الوصف الوظيفي لـ ${updated.length} موظف بنجاح`,
      updated,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Confirm Job Description Import Error:", err);
    return res.status(500).json({
      message: "حدث خطأ أثناء تطبيق الاستيراد",
    });
  } finally {
    client.release();
  }
};