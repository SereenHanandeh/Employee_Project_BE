const { pool } = require("../models/db");

/* ============================= */
/*       CREATE TASK (ADMIN)      */
/* ============================= */

exports.createTask = async (req, res) => {
  try {
    const { title, description } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({
        message: "عنوان المهمة مطلوب",
      });
    }

    const result = await pool.query(
      `INSERT INTO tasks (title, description)
       VALUES ($1, $2)
       RETURNING *`,
      [title.trim(), description || ""]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      message: "Create Task Error",
    });
  }
};


/* ============================= */
/*        GET ALL TASKS          */
/* ============================= */
/* ============================= */
/* GET TASKS                     */
/* ADMIN = ALL TASKS             */
/* EMPLOYEE = ASSIGNED TASKS     */
/* ============================= */

exports.getTasks = async (req, res) => {
  try {
    // =============================
    // ADMIN
    // =============================

    if (req.user?.role === "admin") {
      const result = await pool.query(`
        SELECT *
        FROM tasks
        ORDER BY task_id DESC
      `);

      return res.json(result.rows);
    }

    // =============================
    // EMPLOYEE
    // =============================

    if (req.user?.role === "employee") {
      let employeeId = req.user.employee_id;

      // إذا لم يكن employee_id موجوداً داخل التوكن
      // نحاول إيجاده عن طريق email
      if (!employeeId && req.user.email) {
        const employee = await pool.query(
          `
          SELECT id
          FROM employees
          WHERE email = $1
          `,
          [req.user.email]
        );

        if (employee.rows.length === 0) {
          return res.status(404).json({
            message: "الموظف غير موجود",
          });
        }

        employeeId = employee.rows[0].id;
      }

      if (!employeeId) {
        return res.status(400).json({
          message: "لم يتم العثور على الموظف الحالي",
        });
      }

      const result = await pool.query(
        `
        SELECT
          et.employee_task_id,
          et.employee_id,
          et.task_id,
          t.title,
          t.description
        FROM employee_tasks et

        INNER JOIN tasks t
          ON t.task_id = et.task_id

        WHERE et.employee_id = $1

        ORDER BY et.employee_task_id DESC
        `,
        [employeeId]
      );

      return res.json(result.rows);
    }

    return res.status(403).json({
      message: "غير مسموح",
    });

  } catch (err) {
    console.error("Get Tasks Error:", err);

    res.status(500).json({
      message: "Fetch Tasks Error",
    });
  }
};


/* ============================= */
/*      GET ALL EMPLOYEES        */
/* ============================= */

exports.getEmployees = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         id,
         name,
         email
       FROM employees
       ORDER BY name ASC`
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      message: "Fetch Employees Error",
    });
  }
};


/* ============================= */
/*   ASSIGN TASK TO EMPLOYEE     */
/* ============================= */

exports.assignTask = async (req, res) => {
  try {
    console.log("====================================");
    console.log("ASSIGN TASK REQUEST");
    console.log("BODY:", req.body);
    console.log("USER:", req.user);
    console.log("====================================");

    // ==========================================
    // التأكد أن المستخدم Admin
    // ==========================================
    if (req.user?.role !== "admin") {
      return res.status(403).json({
        message: "غير مسموح، هذه العملية للأدمن فقط",
      });
    }

    // ==========================================
    // استقبال البيانات
    // ==========================================
    const { employee_id, task_id } = req.body;

    console.log("employee_id:", employee_id);
    console.log("task_id:", task_id);

    // ==========================================
    // التحقق من وجود البيانات
    // ==========================================
    if (
      employee_id === undefined ||
      employee_id === null ||
      employee_id === ""
    ) {
      return res.status(400).json({
        message: "employee_id مطلوب",
      });
    }

    if (
      task_id === undefined ||
      task_id === null ||
      task_id === ""
    ) {
      return res.status(400).json({
        message: "task_id مطلوب",
      });
    }

    // ==========================================
    // تحويل إلى أرقام
    // ==========================================
    const employeeId = Number(employee_id);
    const taskId = Number(task_id);

    if (!Number.isInteger(employeeId) || employeeId <= 0) {
      return res.status(400).json({
        message: "employee_id غير صحيح",
      });
    }

    if (!Number.isInteger(taskId) || taskId <= 0) {
      return res.status(400).json({
        message: "task_id غير صحيح",
      });
    }

    // ==========================================
    // التأكد من وجود الموظف
    // ==========================================
    const employeeResult = await pool.query(
      `
      SELECT *
      FROM employees
      WHERE id = $1
      `,
      [employeeId]
    );

    console.log(
      "EMPLOYEE RESULT:",
      employeeResult.rows
    );

    if (employeeResult.rows.length === 0) {
      return res.status(404).json({
        message: "الموظف غير موجود",
      });
    }

    // ==========================================
    // التأكد من وجود المهمة
    // ==========================================
    const taskResult = await pool.query(
      `
      SELECT *
      FROM tasks
      WHERE task_id = $1
      `,
      [taskId]
    );

    console.log(
      "TASK RESULT:",
      taskResult.rows
    );

    if (taskResult.rows.length === 0) {
      return res.status(404).json({
        message: "المهمة غير موجودة",
      });
    }

    // ==========================================
    // هل المهمة مرتبطة بموظف من قبل؟
    // ==========================================
    const existingResult = await pool.query(
      `
      SELECT *
      FROM employee_tasks
      WHERE task_id = $1
      `,
      [taskId]
    );

    console.log(
      "EXISTING ASSIGNMENT:",
      existingResult.rows
    );

    // ==========================================
    // إذا كانت المهمة معينة مسبقًا
    // ==========================================
    if (existingResult.rows.length > 0) {
      const existing =
        existingResult.rows[0];

      // نفس الموظف
      if (
        Number(existing.employee_id) === employeeId
      ) {
        return res.status(400).json({
          message:
            "هذه المهمة معينة بالفعل لهذا الموظف",
        });
      }

      // ========================================
      // تغيير الموظف
      // ========================================
      const updateResult = await pool.query(
        `
        UPDATE employee_tasks
        SET employee_id = $1
        WHERE task_id = $2
        RETURNING *
        `,
        [employeeId, taskId]
      );

      console.log(
        "UPDATED ASSIGNMENT:",
        updateResult.rows[0]
      );

      return res.status(200).json({
        message:
          "تم تغيير الموظف المسؤول عن المهمة بنجاح",
        assignment:
          updateResult.rows[0],
      });
    }

    // ==========================================
    // تعيين المهمة لأول مرة
    // ==========================================
    const insertResult = await pool.query(
      `
      INSERT INTO employee_tasks
      (employee_id, task_id)
      VALUES ($1, $2)
      RETURNING *
      `,
      [employeeId, taskId]
    );

    console.log(
      "NEW ASSIGNMENT:",
      insertResult.rows[0]
    );

    // ==========================================
    // SUCCESS
    // ==========================================
    return res.status(201).json({
      message:
        "تم تعيين المهمة للموظف بنجاح",
      assignment:
        insertResult.rows[0],
    });
  } catch (err) {
    console.error(
      "===================================="
    );
    console.error(
      "ASSIGN TASK DATABASE ERROR"
    );
    console.error(
      "MESSAGE:",
      err.message
    );
    console.error(
      "CODE:",
      err.code
    );
    console.error(
      "DETAIL:",
      err.detail
    );
    console.error(
      "HINT:",
      err.hint
    );
    console.error(
      "TABLE:",
      err.table
    );
    console.error(
      "COLUMN:",
      err.column
    );
    console.error(
      "CONSTRAINT:",
      err.constraint
    );
    console.error(
      "STACK:",
      err.stack
    );
    console.error(
      "===================================="
    );

    return res.status(500).json({
      message:
        "حدث خطأ في قاعدة البيانات أثناء تعيين المهمة",
      error: err.message,
      code: err.code,
    });
  }
};

/* ============================= */
/* GET EMPLOYEE TASKS (ADMIN)    */
/* ============================= */

exports.getEmployeeTasks = async (req, res) => {
  try {
    const { employee_id } = req.params;

    const result = await pool.query(
      `SELECT
         et.employee_task_id,
         et.employee_id,
         et.task_id,
         t.title,
         t.description
       FROM employee_tasks et
       INNER JOIN tasks t
         ON t.task_id = et.task_id
       WHERE et.employee_id = $1
       ORDER BY et.employee_task_id DESC`,
      [employee_id]
    );

    res.json(result.rows);

  } catch (err) {
    console.error(err);

    res.status(500).json({
      message: "Fetch Employee Tasks Error",
    });
  }
};


/* ============================= */
/* REMOVE TASK FROM EMPLOYEE     */
/* ============================= */

exports.removeTaskFromEmployee = async (req, res) => {
  try {
    const { employee_task_id } = req.params;

    const result = await pool.query(
      `DELETE FROM employee_tasks
       WHERE employee_task_id = $1
       RETURNING *`,
      [employee_task_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "التكليف غير موجود",
      });
    }

    res.json({
      message: "تم إلغاء تعيين المهمة من الموظف بنجاح",
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      message: "Remove Assignment Error",
    });
  }
};


/* ============================= */
/*       UPDATE TASK (ADMIN)     */
/* ============================= */

exports.updateTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({
        message: "عنوان المهمة مطلوب",
      });
    }

    const result = await pool.query(
      `UPDATE tasks
       SET title = $1,
           description = $2
       WHERE task_id = $3
       RETURNING *`,
      [
        title.trim(),
        description || "",
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "المهمة غير موجودة",
      });
    }

    res.json(result.rows[0]);

  } catch (err) {
    console.error(err);

    res.status(500).json({
      message: "Update Task Error",
    });
  }
};


/* ============================= */
/*       DELETE TASK (ADMIN)     */
/* ============================= */

exports.deleteTask = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `DELETE FROM tasks
       WHERE task_id = $1
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "المهمة غير موجودة",
      });
    }

    res.json({
      message: "تم حذف المهمة بنجاح",
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      message: "Delete Task Error",
    });
  }
};