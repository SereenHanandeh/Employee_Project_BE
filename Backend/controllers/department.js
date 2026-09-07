const pool = require("../models/db");

// =========================================================
// GET ALL DEPARTMENTS
// =========================================================

const getDepartments = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        d.department_id,
        d.name,
        d.is_deleted,
        d.created_at,
        COUNT(
          CASE
            WHEN e.is_deleted = 0 THEN e.employee_id
          END
        )::INTEGER AS employee_count
      FROM departments d
      LEFT JOIN employees e
        ON e.department_id = d.department_id
      GROUP BY
        d.department_id,
        d.name,
        d.is_deleted,
        d.created_at
      ORDER BY
        d.is_deleted ASC,
        LOWER(d.name) ASC
    `);

    const departments = result.rows.map((department) => ({
      ...department,
      status:
        Number(department.is_deleted) === 1
          ? "محذوف"
          : "نشط",
    }));

    res.json(departments);
  } catch (error) {
    console.error("Get Departments Error:", error);

    res.status(500).json({
      message: "حدث خطأ أثناء تحميل الأقسام",
    });
  }
};

// =========================================================
// GET ACTIVE DEPARTMENTS
// =========================================================

const getActiveDepartments = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        department_id,
        name
      FROM departments
      WHERE is_deleted = 0
      ORDER BY LOWER(name) ASC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error(
      "Get Active Departments Error:",
      error
    );

    res.status(500).json({
      message: "حدث خطأ أثناء تحميل الأقسام الفعالة",
    });
  }
};

// =========================================================
// CREATE DEPARTMENT
// =========================================================

const createDepartment = async (req, res) => {
  try {
    const { name } = req.body;

    // -------------------------------------------------------
    // Validation
    // -------------------------------------------------------

    if (!name || !name.trim()) {
      return res.status(400).json({
        message: "اسم القسم مطلوب",
      });
    }

    const departmentName = name.trim();

    if (departmentName.length < 2) {
      return res.status(400).json({
        message:
          "اسم القسم يجب أن يحتوي على حرفين على الأقل",
      });
    }

    if (departmentName.length > 150) {
      return res.status(400).json({
        message: "اسم القسم طويل جدًا",
      });
    }

    // -------------------------------------------------------
    // Check duplicate department
    // -------------------------------------------------------

    const existing = await pool.query(
      `
      SELECT
        department_id,
        name,
        is_deleted
      FROM departments
      WHERE LOWER(TRIM(name)) = LOWER(TRIM($1))
      LIMIT 1
      `,
      [departmentName]
    );

    if (existing.rows.length > 0) {
      const department = existing.rows[0];

      // Active department already exists
      if (Number(department.is_deleted) === 0) {
        return res.status(409).json({
          message: "هذا القسم موجود بالفعل",
        });
      }

      // -----------------------------------------------------
      // If deleted -> restore it instead of creating duplicate
      // -----------------------------------------------------

      const restored = await pool.query(
        `
        UPDATE departments
        SET
          name = $1,
          is_deleted = 0
        WHERE department_id = $2
        RETURNING
          department_id,
          name,
          is_deleted,
          created_at
        `,
        [
          departmentName,
          department.department_id,
        ]
      );

      return res.status(201).json({
        message: "تم استرجاع القسم وإعادة تفعيله",
        department: {
          ...restored.rows[0],
          status: "نشط",
          employee_count: 0,
        },
      });
    }

    // -------------------------------------------------------
    // Create new department
    // -------------------------------------------------------

    const result = await pool.query(
      `
      INSERT INTO departments (
        name,
        is_deleted
      )
      VALUES ($1, 0)
      RETURNING
        department_id,
        name,
        is_deleted,
        created_at
      `,
      [departmentName]
    );

    res.status(201).json({
      message: "تم إضافة القسم بنجاح",
      department: {
        ...result.rows[0],
        status: "نشط",
        employee_count: 0,
      },
    });
  } catch (error) {
    console.error(
      "Create Department Error:",
      error
    );

    // PostgreSQL unique violation
    if (error.code === "23505") {
      return res.status(409).json({
        message: "هذا القسم موجود بالفعل",
      });
    }

    res.status(500).json({
      message: "حدث خطأ أثناء إضافة القسم",
    });
  }
};

// =========================================================
// UPDATE DEPARTMENT
// =========================================================

const updateDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    // -------------------------------------------------------
    // Validate ID
    // -------------------------------------------------------

    const departmentId = Number(id);

    if (!Number.isInteger(departmentId)) {
      return res.status(400).json({
        message: "معرف القسم غير صحيح",
      });
    }

    // -------------------------------------------------------
    // Validate name
    // -------------------------------------------------------

    if (!name || !name.trim()) {
      return res.status(400).json({
        message: "اسم القسم مطلوب",
      });
    }

    const departmentName = name.trim();

    if (departmentName.length < 2) {
      return res.status(400).json({
        message:
          "اسم القسم يجب أن يحتوي على حرفين على الأقل",
      });
    }

    if (departmentName.length > 150) {
      return res.status(400).json({
        message: "اسم القسم طويل جدًا",
      });
    }

    // -------------------------------------------------------
    // Check department exists
    // -------------------------------------------------------

    const departmentResult = await pool.query(
      `
      SELECT
        department_id,
        name,
        is_deleted
      FROM departments
      WHERE department_id = $1
      `,
      [departmentId]
    );

    if (departmentResult.rows.length === 0) {
      return res.status(404).json({
        message: "القسم غير موجود",
      });
    }

    const department = departmentResult.rows[0];

    // Cannot edit deleted department
    if (Number(department.is_deleted) === 1) {
      return res.status(400).json({
        message:
          "لا يمكن تعديل قسم محذوف. قم باسترجاعه أولًا.",
      });
    }

    // -------------------------------------------------------
    // Check duplicate active name
    // -------------------------------------------------------

    const duplicate = await pool.query(
      `
      SELECT department_id
      FROM departments
      WHERE
        LOWER(TRIM(name)) = LOWER(TRIM($1))
        AND department_id <> $2
        AND is_deleted = 0
      LIMIT 1
      `,
      [
        departmentName,
        departmentId,
      ]
    );

    if (duplicate.rows.length > 0) {
      return res.status(409).json({
        message: "يوجد قسم آخر بنفس الاسم",
      });
    }

    // -------------------------------------------------------
    // Update department
    // -------------------------------------------------------

    const result = await pool.query(
      `
      UPDATE departments
      SET name = $1
      WHERE department_id = $2
      RETURNING
        department_id,
        name,
        is_deleted,
        created_at
      `,
      [
        departmentName,
        departmentId,
      ]
    );

    // -------------------------------------------------------
    // Get active employee count
    // -------------------------------------------------------

    const countResult = await pool.query(
      `
      SELECT COUNT(*)::INTEGER AS employee_count
      FROM employees
      WHERE
        department_id = $1
        AND is_deleted = 0
      `,
      [departmentId]
    );

    res.json({
      message: "تم تعديل القسم بنجاح",
      department: {
        ...result.rows[0],
        status: "نشط",
        employee_count:
          countResult.rows[0].employee_count,
      },
    });
  } catch (error) {
    console.error(
      "Update Department Error:",
      error
    );

    if (error.code === "23505") {
      return res.status(409).json({
        message: "يوجد قسم آخر بنفس الاسم",
      });
    }

    res.status(500).json({
      message: "حدث خطأ أثناء تعديل القسم",
    });
  }
};

// =========================================================
// SOFT DELETE DEPARTMENT
// =========================================================

const deleteDepartment = async (req, res) => {
  try {
    const { id } = req.params;

    const departmentId = Number(id);

    if (!Number.isInteger(departmentId)) {
      return res.status(400).json({
        message: "معرف القسم غير صحيح",
      });
    }

    // -------------------------------------------------------
    // Check department
    // -------------------------------------------------------

    const departmentResult = await pool.query(
      `
      SELECT
        department_id,
        name,
        is_deleted
      FROM departments
      WHERE department_id = $1
      `,
      [departmentId]
    );

    if (departmentResult.rows.length === 0) {
      return res.status(404).json({
        message: "القسم غير موجود",
      });
    }

    const department = departmentResult.rows[0];

    if (Number(department.is_deleted) === 1) {
      return res.status(400).json({
        message: "القسم محذوف بالفعل",
      });
    }

    // -------------------------------------------------------
    // Count active employees
    // -------------------------------------------------------

    const employeesResult = await pool.query(
      `
      SELECT COUNT(*)::INTEGER AS employee_count
      FROM employees
      WHERE
        department_id = $1
        AND is_deleted = 0
      `,
      [departmentId]
    );

    const employeeCount =
      employeesResult.rows[0].employee_count;

    // -------------------------------------------------------
    // Soft delete
    // -------------------------------------------------------

    const result = await pool.query(
      `
      UPDATE departments
      SET is_deleted = 1
      WHERE department_id = $1
      RETURNING
        department_id,
        name,
        is_deleted,
        created_at
      `,
      [departmentId]
    );

    res.json({
      message:
        employeeCount > 0
          ? `تم حذف القسم مؤقتًا. يوجد ${employeeCount} موظف مرتبط بهذا القسم وسيبقى ارتباطهم محفوظًا.`
          : "تم حذف القسم مؤقتًا",

      department: {
        ...result.rows[0],
        status: "محذوف",
        employee_count: employeeCount,
      },
    });
  } catch (error) {
    console.error(
      "Delete Department Error:",
      error
    );

    res.status(500).json({
      message: "حدث خطأ أثناء حذف القسم",
    });
  }
};

// =========================================================
// RESTORE DEPARTMENT
// =========================================================

const restoreDepartment = async (req, res) => {
  try {
    const { id } = req.params;

    const departmentId = Number(id);

    if (!Number.isInteger(departmentId)) {
      return res.status(400).json({
        message: "معرف القسم غير صحيح",
      });
    }

    // -------------------------------------------------------
    // Check department
    // -------------------------------------------------------

    const departmentResult = await pool.query(
      `
      SELECT
        department_id,
        name,
        is_deleted
      FROM departments
      WHERE department_id = $1
      `,
      [departmentId]
    );

    if (departmentResult.rows.length === 0) {
      return res.status(404).json({
        message: "القسم غير موجود",
      });
    }

    const department = departmentResult.rows[0];

    if (Number(department.is_deleted) === 0) {
      return res.status(400).json({
        message: "القسم نشط بالفعل",
      });
    }

    // -------------------------------------------------------
    // Check active duplicate
    // -------------------------------------------------------

    const duplicate = await pool.query(
      `
      SELECT department_id
      FROM departments
      WHERE
        LOWER(TRIM(name)) = LOWER(TRIM($1))
        AND department_id <> $2
        AND is_deleted = 0
      LIMIT 1
      `,
      [
        department.name,
        departmentId,
      ]
    );

    if (duplicate.rows.length > 0) {
      return res.status(409).json({
        message:
          "لا يمكن استرجاع القسم لأن هناك قسمًا نشطًا بنفس الاسم",
      });
    }

    // -------------------------------------------------------
    // Restore
    // -------------------------------------------------------

    const result = await pool.query(
      `
      UPDATE departments
      SET is_deleted = 0
      WHERE department_id = $1
      RETURNING
        department_id,
        name,
        is_deleted,
        created_at
      `,
      [departmentId]
    );

    // -------------------------------------------------------
    // Get active employee count
    // -------------------------------------------------------

    const countResult = await pool.query(
      `
      SELECT COUNT(*)::INTEGER AS employee_count
      FROM employees
      WHERE
        department_id = $1
        AND is_deleted = 0
      `,
      [departmentId]
    );

    res.json({
      message: "تم استرجاع القسم بنجاح",

      department: {
        ...result.rows[0],
        status: "نشط",
        employee_count:
          countResult.rows[0].employee_count,
      },
    });
  } catch (error) {
    console.error(
      "Restore Department Error:",
      error
    );

    res.status(500).json({
      message: "حدث خطأ أثناء استرجاع القسم",
    });
  }
};

// =========================================================
// EXPORTS
// =========================================================

module.exports = {
  getDepartments,
  getActiveDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  restoreDepartment,
};