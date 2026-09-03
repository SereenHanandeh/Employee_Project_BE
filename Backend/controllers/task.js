const { pool } = require("../models/db");

// =========================================================
// CREATE TASK
// =========================================================
exports.createTask = async (req, res) => {
  try {
    const { title, description } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({
        message: "عنوان المهمة مطلوب",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO tasks (title, description)
      VALUES ($1, $2)
      RETURNING *
      `,
      [
        title.trim(),
        description?.trim() || null,
      ]
    );

    return res.status(201).json(result.rows[0]);

  } catch (error) {
    console.error("CREATE TASK ERROR:", error);

    return res.status(500).json({
      message: "حدث خطأ أثناء إنشاء المهمة",
      error: error.message,
      code: error.code,
      detail: error.detail,
    });
  }
};


// =========================================================
// GET TASKS
// =========================================================

exports.getTasks = async (req, res) => {
  try {
    console.log("GET TASKS USER:", req.user);

    // =====================================================
    // ADMIN
    // =====================================================
    if (req.user?.role === "admin") {
      const result = await pool.query(`
        SELECT
          t.task_id,
          t.title,
          t.description,

          -- جميع أرقام الموظفين المرتبطين بالمهمة
          COALESCE(
            ARRAY_AGG(DISTINCT et.employee_id)
            FILTER (WHERE et.employee_id IS NOT NULL),
            '{}'
          ) AS employee_ids,

          -- جميع الموظفين المرتبطين بالمهمة
          COALESCE(
            JSON_AGG(
              DISTINCT JSONB_BUILD_OBJECT(
                'employee_id', e.employee_id,
                'name', e.name,
                'email', e.email
              )
            ) FILTER (WHERE e.employee_id IS NOT NULL),
            '[]'
          ) AS employees

        FROM tasks t

        LEFT JOIN employee_tasks et
          ON et.task_id = t.task_id

        LEFT JOIN employees e
          ON e.employee_id = et.employee_id
          AND e.is_deleted = 0

        GROUP BY
          t.task_id,
          t.title,
          t.description

        ORDER BY t.task_id DESC
      `);

      return res.json(result.rows);
    }

    // =====================================================
    // EMPLOYEE
    // =====================================================
    if (req.user?.role === "employee") {
      const employeeId =
        req.user.employee_id ||
        req.user.id;

      if (!employeeId) {
        return res.status(400).json({
          message: "معرف الموظف غير موجود",
        });
      }

      const result = await pool.query(
        `
        SELECT
          et.id AS employee_task_id,
          et.employee_id,
          et.task_id,
          t.title,
          t.description
        FROM employee_tasks et

        INNER JOIN tasks t
          ON t.task_id = et.task_id

        INNER JOIN employees e
          ON e.employee_id = et.employee_id

        WHERE et.employee_id = $1
          AND e.is_deleted = 0

        ORDER BY et.id DESC
        `,
        [employeeId]
      );

      return res.json(result.rows);
    }

    // =====================================================
    // UNKNOWN ROLE
    // =====================================================
    return res.status(403).json({
      message: "غير مصرح لك بالوصول إلى المهام",
    });

  } catch (error) {
    console.error("=================================");
    console.error("GET TASKS ERROR");
    console.error("message:", error.message);
    console.error("code:", error.code);
    console.error("detail:", error.detail);
    console.error("hint:", error.hint);
    console.error("=================================");

    return res.status(500).json({
      message: "Fetch Tasks Error",
      error: error.message,
      code: error.code,
      detail: error.detail,
    });
  }
};



// =========================================================
// GET EMPLOYEES
// =========================================================
exports.getEmployees = async (req, res) => {
  try {

    const result = await pool.query(
      `
      SELECT
        employee_id,
        name,
        email
      FROM employees
      WHERE is_deleted = 0
      ORDER BY name ASC
      `
    );

    return res.json(result.rows);

  } catch (error) {

    console.error("=================================");
    console.error("GET EMPLOYEES ERROR");
    console.error("message:", error.message);
    console.error("code:", error.code);
    console.error("detail:", error.detail);
    console.error("=================================");

    return res.status(500).json({
      message: "فشل تحميل الموظفين",
      error: error.message,
      code: error.code,
      detail: error.detail,
    });
  }
};


// =========================================================
// ASSIGN TASK TO MULTIPLE EMPLOYEES
// =========================================================
exports.assignTask = async (req, res) => {
  try {
    console.log("=================================");
    console.log("ASSIGN TASK START");
    console.log("USER:", req.user);
    console.log("BODY:", req.body);
    console.log("=================================");

    // =====================================================
    // CHECK ADMIN
    // =====================================================
    if (req.user?.role !== "admin") {
      return res.status(403).json({
        message: "غير مصرح لك بتعيين المهام",
      });
    }

    const { employee_ids, employee_id, task_id } = req.body;

    // =====================================================
    // SUPPORT OLD FORMAT + NEW FORMAT
    // =====================================================
    let employeeIds = [];

    if (Array.isArray(employee_ids)) {
      employeeIds = employee_ids;
    } else if (employee_id) {
      employeeIds = [employee_id];
    }

    // تحويل إلى أرقام وحذف التكرار
    employeeIds = [
      ...new Set(
        employeeIds
          .map((id) => Number(id))
          .filter(
            (id) =>
              Number.isInteger(id) && id > 0
          )
      ),
    ];

    const taskId = Number(task_id);

    // =====================================================
    // VALIDATION
    // =====================================================
    if (employeeIds.length === 0) {
      return res.status(400).json({
        message: "يرجى اختيار موظف واحد على الأقل",
      });
    }

    if (
      !Number.isInteger(taskId) ||
      taskId <= 0
    ) {
      return res.status(400).json({
        message: "معرف المهمة غير صحيح",
      });
    }

    console.log("TASK ID:", taskId);
    console.log("EMPLOYEE IDS:", employeeIds);

    // =====================================================
    // CHECK TASK
    // =====================================================
    const taskResult = await pool.query(
      `
      SELECT
        task_id,
        title,
        description
      FROM tasks
      WHERE task_id = $1
      `,
      [taskId]
    );

    if (taskResult.rows.length === 0) {
      return res.status(404).json({
        message: "المهمة غير موجودة",
      });
    }

    // =====================================================
    // CHECK EMPLOYEES
    // =====================================================
    const employeesResult = await pool.query(
      `
      SELECT
        employee_id,
        name,
        email
      FROM employees
      WHERE employee_id = ANY($1::int[])
        AND is_deleted = 0
      ORDER BY name ASC
      `,
      [employeeIds]
    );

    if (
      employeesResult.rows.length !==
      employeeIds.length
    ) {
      return res.status(400).json({
        message:
          "بعض الموظفين المحددين غير موجودين أو محذوفين",
      });
    }

    // =====================================================
    // TRANSACTION
    // =====================================================
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // ---------------------------------------------------
      // حذف التعيينات الحالية لهذه المهمة فقط
      // ---------------------------------------------------
      await client.query(
        `
        DELETE FROM employee_tasks
        WHERE task_id = $1
        `,
        [taskId]
      );

      // ---------------------------------------------------
      // إضافة جميع الموظفين
      // ---------------------------------------------------
      const assignments = [];

      for (const employeeId of employeeIds) {
        const result = await client.query(
          `
          INSERT INTO employee_tasks
            (employee_id, task_id)
          VALUES
            ($1, $2)
          RETURNING
            id,
            employee_id,
            task_id,
            status,
            selected_at
          `,
          [employeeId, taskId]
        );

        assignments.push(result.rows[0]);
      }

      await client.query("COMMIT");

      console.log(
        "ASSIGNMENTS CREATED:",
        assignments
      );

      return res.status(201).json({
        message:
          "تم تعيين المهمة للموظفين بنجاح",

        task: taskResult.rows[0],

        employees:
          employeesResult.rows,

        assignments,
      });

    } catch (transactionError) {
      await client.query("ROLLBACK");
      throw transactionError;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error("=================================");
    console.error("ASSIGN TASK ERROR");
    console.error("message:", error.message);
    console.error("code:", error.code);
    console.error("detail:", error.detail);
    console.error("hint:", error.hint);
    console.error("constraint:", error.constraint);
    console.error("table:", error.table);
    console.error("column:", error.column);
    console.error("=================================");

    return res.status(500).json({
      message:
        "حدث خطأ أثناء تعيين المهمة",
      error: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
      constraint: error.constraint,
      table: error.table,
      column: error.column,
    });
  }
};


// =========================================================
// GET EMPLOYEE TASKS
// =========================================================
exports.getEmployeeTasks = async (req, res) => {
  try {

    const employeeId =
      Number(req.params.employee_id);


    if (
      !Number.isInteger(employeeId) ||
      employeeId <= 0
    ) {
      return res.status(400).json({
        message: "معرف الموظف غير صحيح",
      });
    }


    // =====================================================
    // CHECK EMPLOYEE
    // =====================================================
    const employeeResult =
      await pool.query(
        `
        SELECT
          employee_id,
          name,
          email
        FROM employees
        WHERE employee_id = $1
          AND is_deleted = 0
        `,
        [employeeId]
      );


    if (employeeResult.rows.length === 0) {
      return res.status(404).json({
        message: "الموظف غير موجود",
      });
    }


    // =====================================================
    // GET TASKS
    // =====================================================
    const result = await pool.query(
      `
      SELECT
        et.id AS employee_task_id,
        et.employee_id,
        et.task_id,

        t.title,
        t.description

      FROM employee_tasks et

      INNER JOIN tasks t
        ON t.task_id = et.task_id

      WHERE et.employee_id = $1

      ORDER BY et.id DESC
      `,
      [employeeId]
    );


    return res.json(result.rows);

  } catch (error) {

    console.error(
      "GET EMPLOYEE TASKS ERROR:",
      error
    );

    return res.status(500).json({
      message: "فشل تحميل مهام الموظف",
      error: error.message,
      code: error.code,
      detail: error.detail,
    });
  }
};


// =========================================================
// REMOVE TASK FROM EMPLOYEE
// =========================================================
exports.removeTaskFromEmployee = async (
  req,
  res
) => {
  try {

    const employeeTaskId =
      Number(
        req.params.employee_task_id
      );


    if (
      !Number.isInteger(employeeTaskId) ||
      employeeTaskId <= 0
    ) {
      return res.status(400).json({
        message:
          "معرف تعيين المهمة غير صحيح",
      });
    }


    const result = await pool.query(
      `
      DELETE FROM employee_tasks
      WHERE id = $1
      RETURNING *
      `,
      [employeeTaskId]
    );


    if (result.rows.length === 0) {
      return res.status(404).json({
        message:
          "تعيين المهمة غير موجود",
      });
    }


    return res.json({
      message:
        "تم إزالة المهمة من الموظف بنجاح",

      assignment:
        result.rows[0],
    });

  } catch (error) {

    console.error(
      "REMOVE TASK ERROR:",
      error
    );

    return res.status(500).json({
      message:
        "حدث خطأ أثناء إزالة المهمة",
      error: error.message,
      code: error.code,
      detail: error.detail,
    });
  }
};


// =========================================================
// UPDATE TASK
// =========================================================
exports.updateTask = async (
  req,
  res
) => {
  try {

    const taskId =
      Number(req.params.id);

    const {
      title,
      description,
    } = req.body;


    if (
      !Number.isInteger(taskId) ||
      taskId <= 0
    ) {
      return res.status(400).json({
        message: "معرف المهمة غير صحيح",
      });
    }


    if (!title || !title.trim()) {
      return res.status(400).json({
        message: "عنوان المهمة مطلوب",
      });
    }


    const result = await pool.query(
      `
      UPDATE tasks

      SET
        title = $1,
        description = $2

      WHERE task_id = $3

      RETURNING *
      `,
      [
        title.trim(),
        description?.trim() || null,
        taskId,
      ]
    );


    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "المهمة غير موجودة",
      });
    }


    return res.json(
      result.rows[0]
    );

  } catch (error) {

    console.error(
      "UPDATE TASK ERROR:",
      error
    );

    return res.status(500).json({
      message:
        "حدث خطأ أثناء تعديل المهمة",
      error: error.message,
      code: error.code,
      detail: error.detail,
    });
  }
};


// =========================================================
// DELETE TASK
// =========================================================
exports.deleteTask = async (
  req,
  res
) => {
  try {

    const taskId =
      Number(req.params.id);


    if (
      !Number.isInteger(taskId) ||
      taskId <= 0
    ) {
      return res.status(400).json({
        message: "معرف المهمة غير صحيح",
      });
    }


    // حذف التعيين أولاً
    await pool.query(
      `
      DELETE FROM employee_tasks
      WHERE task_id = $1
      `,
      [taskId]
    );


    // حذف المهمة
    const result = await pool.query(
      `
      DELETE FROM tasks
      WHERE task_id = $1
      RETURNING *
      `,
      [taskId]
    );


    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "المهمة غير موجودة",
      });
    }


    return res.json({
      message: "تم حذف المهمة بنجاح",
      task: result.rows[0],
    });

  } catch (error) {

    console.error(
      "DELETE TASK ERROR:",
      error
    );

    return res.status(500).json({
      message:
        "حدث خطأ أثناء حذف المهمة",
      error: error.message,
      code: error.code,
      detail: error.detail,
    });
  }
};