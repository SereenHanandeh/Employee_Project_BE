const { pool } = require("../models/db");
const bcrypt = require("bcryptjs");

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
          message:
            "تعذر تحديد رقم الموظف",
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
          e.role
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
      });
    }

    // =====================================================
    // UNKNOWN ROLE
    // =====================================================

    return res.status(403).json({
      message:
        "نوع المستخدم غير معروف",
    });
  } catch (err) {
    console.error(
      "GET ME ERROR:",
      err
    );

    return res.status(500).json({
      message:
        "حدث خطأ في الخادم",
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