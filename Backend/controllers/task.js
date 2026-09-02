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
      `
      INSERT INTO tasks (title, description)
      VALUES ($1, $2)
      RETURNING *
      `,
      [
        title.trim(),
        description?.trim() || "",
      ]
    );

    return res.status(201).json(result.rows[0]);

  } catch (err) {
    console.error("Create Task Error:", err);

    return res.status(500).json({
      message: "Create Task Error",
    });
  }
};


/* ============================= */
/*          GET TASKS             */
/* ============================= */
/*
   ADMIN    => جميع المهام + الموظف المعين
   EMPLOYEE => المهام المعينة له فقط
*/

exports.getTasks = async (req, res) => {
  try {

    // =============================
    // ADMIN
    // =============================

    if (req.user?.role === "admin") {

      const result = await pool.query(
        `
        SELECT
          t.task_id,
          t.title,
          t.description,
          et.employee_task_id,
          et.employee_id,
          e.name AS employee_name,
          e.email AS employee_email
        FROM tasks t
        LEFT JOIN employee_tasks et
          ON et.task_id = t.task_id
        LEFT JOIN employees e
          ON e.employee_id = et.employee_id
        ORDER BY t.task_id DESC
        `
      );

      return res.json(result.rows);
    }


    // =============================
    // EMPLOYEE
    // =============================

    if (req.user?.role === "employee") {

      // الهوية تأتي من JWT
      const employeeId =
        req.user.employee_id || req.user.id;

      if (!employeeId) {
        return res.status(401).json({
          message: "لم يتم العثور على هوية الموظف",
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
        INNER JOIN employees e
          ON e.employee_id = et.employee_id
        WHERE et.employee_id = $1
          AND e.is_deleted = 0
        ORDER BY et.employee_task_id DESC
        `,
        [employeeId]
      );

      return res.json(result.rows);
    }


    // =============================
    // UNKNOWN ROLE
    // =============================

    return res.status(403).json({
      message: "غير مسموح",
    });

  }  catch (err) {
  console.error("========== GET TASKS ERROR ==========");
  console.error("Message:", err.message);
  console.error("Code:", err.code);
  console.error("Detail:", err.detail);
  console.error("Hint:", err.hint);
  console.error("Stack:", err.stack);
  console.error("User:", req.user);
  console.error("=====================================");

  return res.status(500).json({
    message: "Fetch Tasks Error",
    error: err.message,
    code: err.code,
  });
}



/* ============================= */
/*      GET ALL EMPLOYEES        */
/*             ADMIN             */
/* ============================= */

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

  } catch (err) {
    console.error("Get Task Employees Error:", err);

    return res.status(500).json({
      message: "Fetch Employees Error",
    });
  }
};


/* ============================= */
/*       ASSIGN TASK (ADMIN)      */
/* ============================= */

exports.assignTask = async (req, res) => {
  try {

    // =============================
    // ADMIN CHECK
    // =============================

    if (req.user?.role !== "admin") {
      return res.status(403).json({
        message: "غير مسموح، هذه العملية للأدمن فقط",
      });
    }

    const {
      employee_id,
      task_id,
    } = req.body;

    // =============================
    // REQUIRED
    // =============================

    if (
      employee_id === undefined ||
      employee_id === null ||
      task_id === undefined ||
      task_id === null
    ) {
      return res.status(400).json({
        message: "employee_id و task_id مطلوبان",
      });
    }

    // =============================
    // NUMBER VALIDATION
    // =============================

    const employeeId = Number(employee_id);
    const taskId = Number(task_id);

    if (
      !Number.isInteger(employeeId) ||
      employeeId <= 0 ||
      !Number.isInteger(taskId) ||
      taskId <= 0
    ) {
      return res.status(400).json({
        message:
          "employee_id و task_id يجب أن يكونا أرقامًا صحيحة",
      });
    }

    // =============================
    // CHECK EMPLOYEE
    // =============================

    const employeeResult = await pool.query(
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
        message: "الموظف غير موجود أو محذوف",
      });
    }

    const employee = employeeResult.rows[0];

    // =============================
    // CHECK TASK
    // =============================

    const taskResult = await pool.query(
      `
      SELECT *
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

    const task = taskResult.rows[0];

    // =============================
    // TRANSACTION
    // =============================

    const client = await pool.connect();

    try {

      await client.query("BEGIN");

      // حذف التعيين القديم لهذه المهمة
      await client.query(
        `
        DELETE FROM employee_tasks
        WHERE task_id = $1
        `,
        [taskId]
      );

      // إضافة التعيين الجديد
      const assignmentResult = await client.query(
        `
        INSERT INTO employee_tasks
        (
          employee_id,
          task_id
        )
        VALUES
        ($1, $2)
        RETURNING *
        `,
        [
          employeeId,
          taskId,
        ]
      );

      await client.query("COMMIT");

      return res.status(201).json({
        message: "تم تعيين المهمة بنجاح",

        task: {
          ...task,
          employee_id: employeeId,
          employee_name: employee.name,
          employee_email: employee.email,
        },

        assignment: assignmentResult.rows[0],
      });

    } catch (transactionError) {

      await client.query("ROLLBACK");

      throw transactionError;

    } finally {

      client.release();
    }

  } catch (err) {

    console.error("Assign Task Error:", err);

    return res.status(500).json({
      message:
        "حدث خطأ في قاعدة البيانات أثناء تعيين المهمة",
    });
  }
};


/* ============================= */
/*     GET EMPLOYEE TASKS        */
/*            ADMIN              */
/* ============================= */

exports.getEmployeeTasks = async (req, res) => {
  try {

    const { employee_id } = req.params;

    const employeeId = Number(employee_id);

    if (
      !Number.isInteger(employeeId) ||
      employeeId <= 0
    ) {
      return res.status(400).json({
        message: "employee_id غير صالح",
      });
    }

    // التأكد من وجود الموظف
    const employeeCheck = await pool.query(
      `
      SELECT employee_id
      FROM employees
      WHERE employee_id = $1
      `,
      [employeeId]
    );

    if (employeeCheck.rows.length === 0) {
      return res.status(404).json({
        message: "الموظف غير موجود",
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

  } catch (err) {

    console.error("Get Employee Tasks Error:", err);

    return res.status(500).json({
      message: "Fetch Employee Tasks Error",
    });
  }
};


/* ============================= */
/*   REMOVE TASK FROM EMPLOYEE   */
/*            ADMIN              */
/* ============================= */

exports.removeTaskFromEmployee = async (req, res) => {
  try {

    const {
      employee_task_id,
    } = req.params;

    const assignmentId =
      Number(employee_task_id);

    if (
      !Number.isInteger(assignmentId) ||
      assignmentId <= 0
    ) {
      return res.status(400).json({
        message: "employee_task_id غير صالح",
      });
    }

    const result = await pool.query(
      `
      DELETE FROM employee_tasks
      WHERE employee_task_id = $1
      RETURNING *
      `,
      [assignmentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "التكليف غير موجود",
      });
    }

    return res.json({
      message:
        "تم إلغاء تعيين المهمة من الموظف بنجاح",
    });

  } catch (err) {

    console.error("Remove Assignment Error:", err);

    return res.status(500).json({
      message: "Remove Assignment Error",
    });
  }
};


/* ============================= */
/*        UPDATE TASK (ADMIN)     */
/* ============================= */

exports.updateTask = async (req, res) => {
  try {

    const { id } = req.params;

    const {
      title,
      description,
    } = req.body;

    const taskId = Number(id);

    if (
      !Number.isInteger(taskId) ||
      taskId <= 0
    ) {
      return res.status(400).json({
        message: "معرف المهمة غير صالح",
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
        description?.trim() || "",
        taskId,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "المهمة غير موجودة",
      });
    }

    return res.json(result.rows[0]);

  } catch (err) {

    console.error("Update Task Error:", err);

    return res.status(500).json({
      message: "Update Task Error",
    });
  }
};


/* ============================= */
/*        DELETE TASK (ADMIN)     */
/* ============================= */

exports.deleteTask = async (req, res) => {
  try {

    const { id } = req.params;

    const taskId = Number(id);

    if (
      !Number.isInteger(taskId) ||
      taskId <= 0
    ) {
      return res.status(400).json({
        message: "معرف المهمة غير صالح",
      });
    }

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
    });

  } catch (err) {

    console.error("Delete Task Error:", err);

    return res.status(500).json({
      message: "Delete Task Error",
    });
  }
};