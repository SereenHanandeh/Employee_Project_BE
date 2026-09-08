const { pool } = require("../models/db");

// =========================================================
// CREATE TASK WITH STAGES
// =========================================================

exports.createTask = async (req, res) => {
  const client = await pool.connect();

  try {
    console.log("=================================");
    console.log("CREATE TASK REQUEST");
    console.log("BODY:", JSON.stringify(req.body, null, 2));
    console.log("USER:", req.user);
    console.log("=================================");

    const { title, description, due_date, stages } = req.body;

    // =====================================================
    // VALIDATION
    // =====================================================

    if (!title || !title.trim()) {
      return res.status(400).json({
        message: "عنوان المهمة مطلوب",
      });
    }

    if (!due_date) {
      return res.status(400).json({
        message: "تاريخ استحقاق المهمة مطلوب",
      });
    }

    if (!Array.isArray(stages) || stages.length === 0) {
      return res.status(400).json({
        message: "يجب إضافة مرحلة واحدة على الأقل للمهمة",
      });
    }

    // =====================================================
    // VALIDATE STAGES
    // =====================================================

    const cleanedStages = [];

    for (let i = 0; i < stages.length; i++) {
      const stage = stages[i];

      if (!stage?.title || !stage.title.trim()) {
        return res.status(400).json({
          message: `اسم المرحلة ${i + 1} مطلوب`,
        });
      }

      if (!stage?.due_date) {
        return res.status(400).json({
          message: `تاريخ المرحلة ${i + 1} مطلوب`,
        });
      }

      if (stage.due_date > due_date) {
        return res.status(400).json({
          message: `تاريخ المرحلة ${i + 1} لا يمكن أن يكون بعد تاريخ المهمة`,
        });
      }

      cleanedStages.push({
        title: stage.title.trim(),
        description: stage.description?.trim() || null,
        due_date: stage.due_date,
        stage_order: i + 1,
      });
    }

    // =====================================================
    // TRANSACTION
    // =====================================================

    await client.query("BEGIN");

    // =====================================================
    // CREATE TASK
    // =====================================================

    const taskResult = await client.query(
      `
      INSERT INTO tasks (
        title,
        description,
        due_date
      )
      VALUES ($1, $2, $3)
      RETURNING *
      `,
      [title.trim(), description?.trim() || null, due_date],
    );

    const task = taskResult.rows[0];

    // =====================================================
    // CREATE STAGES
    // =====================================================

    const createdStages = [];

    for (const stage of cleanedStages) {
      const stageResult = await client.query(
        `
        INSERT INTO task_stages (
          task_id,
          title,
          description,
          due_date,
          stage_order
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
        `,
        [
          task.task_id,
          stage.title,
          stage.description,
          stage.due_date,
          stage.stage_order,
        ],
      );

      createdStages.push(stageResult.rows[0]);
    }

    await client.query("COMMIT");

    return res.status(201).json({
      message: "تم إنشاء المهمة بنجاح",
      task,
      stages: createdStages,
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("ROLLBACK ERROR:", rollbackError);
    }

    console.error("=================================");
    console.error("CREATE TASK ERROR");
    console.error("message:", error.message);
    console.error("code:", error.code);
    console.error("detail:", error.detail);
    console.error("=================================");

    return res.status(500).json({
      message: "حدث خطأ أثناء إنشاء المهمة",
      error: error.message,
      code: error.code,
      detail: error.detail,
    });
  } finally {
    client.release();
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
          t.due_date,

          COALESCE(
            ARRAY_AGG(DISTINCT et.employee_id)
            FILTER (
              WHERE et.employee_id IS NOT NULL
            ),
            '{}'
          ) AS employee_ids,

          COALESCE(
            JSON_AGG(
              DISTINCT JSONB_BUILD_OBJECT(
                'employee_id', e.employee_id,
                'name', e.name,
                'email', e.email,
                'status', et.status,
                'selected_at', et.selected_at
              )
            )
            FILTER (
              WHERE e.employee_id IS NOT NULL
            ),
            '[]'
          ) AS employees,

          COALESCE(
            (
              SELECT JSON_AGG(
                JSONB_BUILD_OBJECT(
                  'stage_id', ts.stage_id,
                  'title', ts.title,
                  'description', ts.description,
                  'due_date', ts.due_date,
                  'stage_order', ts.stage_order,

                  'assigned_count',
                  (
                    SELECT COUNT(*)
                    FROM employee_tasks et2
                    WHERE et2.task_id = t.task_id
                  ),

                  'completed_count',
                  (
                    SELECT COUNT(*)
                    FROM employee_task_stages ets2
                    INNER JOIN employee_tasks et3
                      ON et3.id = ets2.employee_task_id
                    WHERE et3.task_id = t.task_id
                      AND ets2.stage_id = ts.stage_id
                      AND ets2.completed = 1
                  )
                )
                ORDER BY ts.stage_order ASC
              )
              FROM task_stages ts
              WHERE ts.task_id = t.task_id
            ),
            '[]'
          ) AS stages,

          (
            SELECT COUNT(*)
            FROM task_stages ts
            WHERE ts.task_id = t.task_id
          )::INTEGER AS total_stages,

          (
            SELECT COUNT(*)
            FROM employee_task_stages ets
            INNER JOIN employee_tasks et2
              ON et2.id = ets.employee_task_id
            WHERE et2.task_id = t.task_id
              AND ets.completed = 1
          )::INTEGER AS completed_stage_assignments

        FROM tasks t

        LEFT JOIN employee_tasks et
          ON et.task_id = t.task_id

        LEFT JOIN employees e
          ON e.employee_id = et.employee_id
          AND e.is_deleted = 0

        GROUP BY
          t.task_id,
          t.title,
          t.description,
          t.due_date

        ORDER BY t.task_id DESC
      `);

      return res.json(result.rows);
    }

    // =====================================================
    // EMPLOYEE
    // =====================================================

    if (req.user?.role === "employee") {
      const employeeId = req.user.employee_id || req.user.id;

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
          t.description,
          t.due_date,

          et.status,
          et.selected_at,

          COALESCE(
            (
              SELECT JSON_AGG(
                JSONB_BUILD_OBJECT(
                  'stage_id', ts.stage_id,
                  'title', ts.title,
                  'description', ts.description,
                  'due_date', ts.due_date,
                  'stage_order', ts.stage_order,
                  'completed', ets.completed,
                  'completed_at', ets.completed_at
                )
                ORDER BY ts.stage_order ASC
              )
              FROM employee_task_stages ets
              INNER JOIN task_stages ts
                ON ts.stage_id = ets.stage_id
              WHERE ets.employee_task_id = et.id
            ),
            '[]'
          ) AS stages,

          (
            SELECT COUNT(*)
            FROM employee_task_stages ets
            WHERE ets.employee_task_id = et.id
          )::INTEGER AS total_stages,

          (
            SELECT COUNT(*)
            FROM employee_task_stages ets
            WHERE ets.employee_task_id = et.id
              AND ets.completed = 1
          )::INTEGER AS completed_stages

        FROM employee_tasks et

        INNER JOIN tasks t
          ON t.task_id = et.task_id

        INNER JOIN employees e
          ON e.employee_id = et.employee_id

        WHERE et.employee_id = $1
          AND e.is_deleted = 0

        ORDER BY et.id DESC
        `,
        [employeeId],
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
      message: "فشل تحميل المهام",
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
      `,
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
  const client = await pool.connect();

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
    // SUPPORT OLD + NEW FORMAT
    // =====================================================

    let employeeIds = [];

    if (Array.isArray(employee_ids)) {
      employeeIds = employee_ids;
    } else if (employee_id) {
      employeeIds = [employee_id];
    }

    employeeIds = [
      ...new Set(
        employeeIds
          .map((id) => Number(id))
          .filter((id) => Number.isInteger(id) && id > 0),
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

    if (!Number.isInteger(taskId) || taskId <= 0) {
      return res.status(400).json({
        message: "معرف المهمة غير صحيح",
      });
    }

    // =====================================================
    // CHECK TASK
    // =====================================================

    const taskResult = await client.query(
      `
      SELECT
        task_id,
        title,
        description,
        due_date
      FROM tasks
      WHERE task_id = $1
      `,
      [taskId],
    );

    if (taskResult.rows.length === 0) {
      return res.status(404).json({
        message: "المهمة غير موجودة",
      });
    }

    // =====================================================
    // CHECK STAGES
    // =====================================================

    const stagesResult = await client.query(
      `
      SELECT
        stage_id,
        task_id,
        title,
        description,
        due_date,
        stage_order
      FROM task_stages
      WHERE task_id = $1
      ORDER BY stage_order ASC
      `,
      [taskId],
    );

    if (stagesResult.rows.length === 0) {
      return res.status(400).json({
        message: "المهمة لا تحتوي على مراحل",
      });
    }

    // =====================================================
    // CHECK EMPLOYEES
    // =====================================================

    const employeesResult = await client.query(
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
      [employeeIds],
    );

    if (employeesResult.rows.length !== employeeIds.length) {
      return res.status(400).json({
        message: "بعض الموظفين المحددين غير موجودين أو محذوفين",
      });
    }

    // =====================================================
    // TRANSACTION
    // =====================================================

    await client.query("BEGIN");

    // =====================================================
    // DELETE OLD ASSIGNMENTS
    // =====================================================

    await client.query(
      `
      DELETE FROM employee_tasks
      WHERE task_id = $1
      `,
      [taskId],
    );

    // =====================================================
    // CREATE ASSIGNMENTS + STAGES
    // =====================================================

    const assignments = [];

    for (const employeeId of employeeIds) {
      const assignmentResult = await client.query(
        `
          INSERT INTO employee_tasks (
            employee_id,
            task_id,
            status
          )
          VALUES ($1, $2, 'pending')
          RETURNING
            id,
            employee_id,
            task_id,
            status,
            selected_at
          `,
        [employeeId, taskId],
      );

      const assignment = assignmentResult.rows[0];

      assignments.push(assignment);

      // ===================================================
      // CREATE STAGE RECORDS FOR THIS EMPLOYEE
      // ===================================================

      for (const stage of stagesResult.rows) {
        await client.query(
          `
          INSERT INTO employee_task_stages (
            employee_task_id,
            stage_id,
            completed,
            completed_at
          )
          VALUES ($1, $2, 0, NULL)
          `,
          [assignment.id, stage.stage_id],
        );
      }
    }

    await client.query("COMMIT");

    console.log("ASSIGNMENTS CREATED:", assignments);

    return res.status(201).json({
      message: "تم تعيين المهمة للموظفين بنجاح",

      task: taskResult.rows[0],

      employees: employeesResult.rows,

      assignments,
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("ROLLBACK ERROR:", rollbackError);
    }

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
      message: "حدث خطأ أثناء تعيين المهمة",

      error: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
      constraint: error.constraint,
      table: error.table,
      column: error.column,
    });
  } finally {
    client.release();
  }
};

// =========================================================
// GET EMPLOYEE TASKS
// =========================================================

exports.getEmployeeTasks = async (req, res) => {
  try {
    const employeeId = Number(req.params.employee_id);

    // =====================================================
    // VALIDATION
    // =====================================================

    if (!Number.isInteger(employeeId) || employeeId <= 0) {
      return res.status(400).json({
        message: "معرف الموظف غير صحيح",
      });
    }

    // =====================================================
    // CHECK EMPLOYEE
    // =====================================================

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
      [employeeId],
    );

    if (employeeResult.rows.length === 0) {
      return res.status(404).json({
        message: "الموظف غير موجود",
      });
    }

    // =====================================================
    // GET TASKS + STAGES
    // =====================================================

    const result = await pool.query(
      `
      SELECT
        et.id AS employee_task_id,
        et.employee_id,
        et.task_id,

        t.title,
        t.description,
        t.due_date,

        et.status,
        et.selected_at,

        COALESCE(
          (
            SELECT JSON_AGG(
              JSONB_BUILD_OBJECT(
                'stage_id', ts.stage_id,
                'title', ts.title,
                'description', ts.description,
                'due_date', ts.due_date,
                'stage_order', ts.stage_order,
                'completed', ets.completed,
                'completed_at', ets.completed_at
              )
              ORDER BY ts.stage_order ASC
            )
            FROM employee_task_stages ets
            INNER JOIN task_stages ts
              ON ts.stage_id = ets.stage_id
            WHERE ets.employee_task_id = et.id
          ),
          '[]'
        ) AS stages,

        (
          SELECT COUNT(*)
          FROM employee_task_stages ets
          WHERE ets.employee_task_id = et.id
        )::INTEGER AS total_stages,

        (
          SELECT COUNT(*)
          FROM employee_task_stages ets
          WHERE ets.employee_task_id = et.id
            AND ets.completed = 1
        )::INTEGER AS completed_stages

      FROM employee_tasks et

      INNER JOIN tasks t
        ON t.task_id = et.task_id

      WHERE et.employee_id = $1

      ORDER BY et.id DESC
      `,
      [employeeId],
    );

    return res.json(result.rows);
  } catch (error) {
    console.error("GET EMPLOYEE TASKS ERROR:", error);

    return res.status(500).json({
      message: "فشل تحميل مهام الموظف",

      error: error.message,
      code: error.code,
      detail: error.detail,
    });
  }
};

// =========================================================
// COMPLETE STAGE
// =========================================================

exports.completeStage = async (req, res) => {
  const client = await pool.connect();

  try {
    const stageId = Number(req.params.stage_id);

    const employeeId = Number(req.user?.employee_id || req.user?.id);

    // =====================================================
    // VALIDATION
    // =====================================================

    if (!Number.isInteger(stageId) || stageId <= 0) {
      return res.status(400).json({
        message: "معرف المرحلة غير صحيح",
      });
    }

    if (!Number.isInteger(employeeId) || employeeId <= 0) {
      return res.status(400).json({
        message: "معرف الموظف غير موجود",
      });
    }

    await client.query("BEGIN");

    // =====================================================
    // GET EMPLOYEE STAGE
    // =====================================================

    const stageResult = await client.query(
      `
      SELECT
        ets.id,
        ets.employee_task_id,
        ets.stage_id,
        ets.completed,

        et.employee_id,
        et.task_id,

        ts.title,
        ts.stage_order

      FROM employee_task_stages ets

      INNER JOIN employee_tasks et
        ON et.id = ets.employee_task_id

      INNER JOIN task_stages ts
        ON ts.stage_id = ets.stage_id

      WHERE ets.stage_id = $1
        AND et.employee_id = $2
      `,
      [stageId, employeeId],
    );

    if (stageResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        message: "المرحلة غير موجودة أو غير مرتبطة بهذا الموظف",
      });
    }

    const stage = stageResult.rows[0];

    // =====================================================
    // COMPLETE STAGE
    // =====================================================

    const updateResult = await client.query(
      `
      UPDATE employee_task_stages
      SET
        completed = 1,
        completed_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
      `,
      [stage.id],
    );

    // =====================================================
    // CHECK ALL STAGES
    // =====================================================

    const progressResult = await client.query(
      `
      SELECT
        COUNT(*)::INTEGER AS total_stages,

        COUNT(*) FILTER (
          WHERE completed = 1
        )::INTEGER AS completed_stages

      FROM employee_task_stages
      WHERE employee_task_id = $1
      `,
      [stage.employee_task_id],
    );

    const progress = progressResult.rows[0];

    const totalStages = Number(progress.total_stages);

    const completedStages = Number(progress.completed_stages);

    // =====================================================
    // UPDATE TASK STATUS
    // =====================================================

    const taskStatus =
      totalStages > 0 && completedStages === totalStages
        ? "completed"
        : "pending";

    await client.query(
      `
      UPDATE employee_tasks
      SET status = $1
      WHERE id = $2
      `,
      [taskStatus, stage.employee_task_id],
    );

    await client.query("COMMIT");

    return res.json({
      message:
        taskStatus === "completed"
          ? "تم إنهاء المرحلة وإكمال المهمة بالكامل"
          : "تم إنهاء المرحلة بنجاح",

      stage: updateResult.rows[0],

      task_status: taskStatus,

      total_stages: totalStages,

      completed_stages: completedStages,
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("ROLLBACK ERROR:", rollbackError);
    }

    console.error("COMPLETE STAGE ERROR:", error);

    return res.status(500).json({
      message: "حدث خطأ أثناء إكمال المرحلة",

      error: error.message,
      code: error.code,
      detail: error.detail,
    });
  } finally {
    client.release();
  }
};

// =========================================================
// REOPEN STAGE
// =========================================================

exports.reopenStage = async (req, res) => {
  const client = await pool.connect();

  try {
    const stageId = Number(req.params.stage_id);

    const employeeId = Number(req.user?.employee_id || req.user?.id);

    // =====================================================
    // VALIDATION
    // =====================================================

    if (!Number.isInteger(stageId) || stageId <= 0) {
      return res.status(400).json({
        message: "معرف المرحلة غير صحيح",
      });
    }

    if (!Number.isInteger(employeeId) || employeeId <= 0) {
      return res.status(400).json({
        message: "معرف الموظف غير موجود",
      });
    }

    await client.query("BEGIN");

    // =====================================================
    // GET STAGE
    // =====================================================

    const stageResult = await client.query(
      `
      SELECT
        ets.id,
        ets.employee_task_id,

        et.employee_id,
        et.task_id

      FROM employee_task_stages ets

      INNER JOIN employee_tasks et
        ON et.id = ets.employee_task_id

      WHERE ets.stage_id = $1
        AND et.employee_id = $2
      `,
      [stageId, employeeId],
    );

    if (stageResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        message: "المرحلة غير موجودة أو غير مرتبطة بهذا الموظف",
      });
    }

    const stage = stageResult.rows[0];

    // =====================================================
    // REOPEN
    // =====================================================

    const result = await client.query(
      `
      UPDATE employee_task_stages
      SET
        completed = 0,
        completed_at = NULL
      WHERE id = $1
      RETURNING *
      `,
      [stage.id],
    );

    // =====================================================
    // TASK BECOMES PENDING
    // =====================================================

    await client.query(
      `
      UPDATE employee_tasks
      SET status = 'pending'
      WHERE id = $1
      `,
      [stage.employee_task_id],
    );

    await client.query("COMMIT");

    return res.json({
      message: "تم إعادة المرحلة إلى غير مكتملة",

      stage: result.rows[0],

      task_status: "pending",
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("ROLLBACK ERROR:", rollbackError);
    }

    console.error("REOPEN STAGE ERROR:", error);

    return res.status(500).json({
      message: "حدث خطأ أثناء إعادة فتح المرحلة",

      error: error.message,
      code: error.code,
      detail: error.detail,
    });
  } finally {
    client.release();
  }
};

// =========================================================
// OLD COMPLETE TASK
// =========================================================
// أبقيناه للتوافق، لكن الأفضل استخدام completeStage.
// =========================================================

exports.completeTask = async (req, res) => {
  try {
    const employeeTaskId = Number(req.params.employee_task_id);

    const employeeId = Number(req.user?.employee_id || req.user?.id);

    if (!Number.isInteger(employeeTaskId) || employeeTaskId <= 0) {
      return res.status(400).json({
        message: "معرف تعيين المهمة غير صحيح",
      });
    }

    if (!Number.isInteger(employeeId) || employeeId <= 0) {
      return res.status(400).json({
        message: "معرف الموظف غير موجود",
      });
    }

    // =====================================================
    // CHECK IF ALL STAGES ARE COMPLETED
    // =====================================================

    const progressResult = await pool.query(
      `
      SELECT
        COUNT(*)::INTEGER AS total_stages,

        COUNT(*) FILTER (
          WHERE completed = 1
        )::INTEGER AS completed_stages

      FROM employee_task_stages
      WHERE employee_task_id = $1
      `,
      [employeeTaskId],
    );

    const { total_stages, completed_stages } = progressResult.rows[0];

    if (
      Number(total_stages) === 0 ||
      Number(completed_stages) !== Number(total_stages)
    ) {
      return res.status(400).json({
        message: "لا يمكن إنهاء المهمة قبل إكمال جميع المراحل",

        total_stages: Number(total_stages),

        completed_stages: Number(completed_stages),
      });
    }

    const result = await pool.query(
      `
      UPDATE employee_tasks
      SET status = 'completed'
      WHERE id = $1
        AND employee_id = $2
      RETURNING *
      `,
      [employeeTaskId, employeeId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "المهمة غير موجودة أو غير مرتبطة بهذا الموظف",
      });
    }

    return res.json({
      message: "تم إنهاء المهمة بنجاح",

      task: result.rows[0],
    });
  } catch (error) {
    console.error("COMPLETE TASK ERROR:", error);

    return res.status(500).json({
      message: "حدث خطأ أثناء إنهاء المهمة",

      error: error.message,
      code: error.code,
      detail: error.detail,
    });
  }
};

// =========================================================
// OLD REOPEN TASK
// =========================================================

exports.reopenTask = async (req, res) => {
  try {
    const employeeTaskId = Number(req.params.employee_task_id);

    const employeeId = Number(req.user?.employee_id || req.user?.id);

    if (!Number.isInteger(employeeTaskId) || employeeTaskId <= 0) {
      return res.status(400).json({
        message: "معرف تعيين المهمة غير صحيح",
      });
    }

    if (!Number.isInteger(employeeId) || employeeId <= 0) {
      return res.status(400).json({
        message: "معرف الموظف غير موجود",
      });
    }

    await pool.query(
      `
      UPDATE employee_task_stages
      SET
        completed = 0,
        completed_at = NULL
      WHERE employee_task_id = $1
      `,
      [employeeTaskId],
    );

    const result = await pool.query(
      `
      UPDATE employee_tasks
      SET status = 'pending'
      WHERE id = $1
        AND employee_id = $2
      RETURNING *
      `,
      [employeeTaskId, employeeId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "المهمة غير موجودة أو غير مرتبطة بهذا الموظف",
      });
    }

    return res.json({
      message: "تم إعادة المهمة إلى غير مكتملة",

      task: result.rows[0],
    });
  } catch (error) {
    console.error("REOPEN TASK ERROR:", error);

    return res.status(500).json({
      message: "حدث خطأ أثناء إعادة فتح المهمة",

      error: error.message,
      code: error.code,
      detail: error.detail,
    });
  }
};

// =========================================================
// REMOVE TASK FROM EMPLOYEE
// =========================================================

exports.removeTaskFromEmployee = async (req, res) => {
  try {
    const employeeTaskId = Number(req.params.employee_task_id);

    if (!Number.isInteger(employeeTaskId) || employeeTaskId <= 0) {
      return res.status(400).json({
        message: "معرف تعيين المهمة غير صحيح",
      });
    }

    const result = await pool.query(
      `
      DELETE FROM employee_tasks
      WHERE id = $1
      RETURNING *
      `,
      [employeeTaskId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "تعيين المهمة غير موجود",
      });
    }

    return res.json({
      message: "تم إزالة المهمة من الموظف بنجاح",

      assignment: result.rows[0],
    });
  } catch (error) {
    console.error("REMOVE TASK ERROR:", error);

    return res.status(500).json({
      message: "حدث خطأ أثناء إزالة المهمة",

      error: error.message,
      code: error.code,
      detail: error.detail,
    });
  }
};

// =========================================================
// UPDATE TASK WITH STAGES
// =========================================================

exports.updateTask = async (req, res) => {
  const client = await pool.connect();

  try {
    const taskId = Number(req.params.id);

    const { title, description, due_date, stages } = req.body;

    // =====================================================
    // VALIDATION
    // =====================================================

    if (!Number.isInteger(taskId) || taskId <= 0) {
      return res.status(400).json({
        message: "معرف المهمة غير صحيح",
      });
    }

    if (!title || !title.trim()) {
      return res.status(400).json({
        message: "عنوان المهمة مطلوب",
      });
    }

    if (!due_date) {
      return res.status(400).json({
        message: "تاريخ استحقاق المهمة مطلوب",
      });
    }

    if (!Array.isArray(stages) || stages.length === 0) {
      return res.status(400).json({
        message: "يجب إضافة مرحلة واحدة على الأقل",
      });
    }

    // =====================================================
    // VALIDATE STAGES
    // =====================================================

    const cleanedStages = [];

    for (let i = 0; i < stages.length; i++) {
      const stage = stages[i];

      if (!stage?.title || !stage.title.trim()) {
        return res.status(400).json({
          message: `اسم المرحلة ${i + 1} مطلوب`,
        });
      }

      if (!stage?.due_date) {
        return res.status(400).json({
          message: `تاريخ المرحلة ${i + 1} مطلوب`,
        });
      }

      if (stage.due_date > due_date) {
        return res.status(400).json({
          message: `تاريخ المرحلة ${i + 1} لا يمكن أن يكون بعد تاريخ المهمة`,
        });
      }

      cleanedStages.push({
        title: stage.title.trim(),

        description: stage.description?.trim() || null,

        due_date: stage.due_date,

        stage_order: i + 1,
      });
    }

    // =====================================================
    // TRANSACTION
    // =====================================================

    await client.query("BEGIN");

    // =====================================================
    // UPDATE TASK
    // =====================================================

    const taskResult = await client.query(
      `
        UPDATE tasks
        SET
          title = $1,
          description = $2,
          due_date = $3
        WHERE task_id = $4
        RETURNING *
        `,
      [title.trim(), description?.trim() || null, due_date, taskId],
    );

    if (taskResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        message: "المهمة غير موجودة",
      });
    }

    // =====================================================
    // GET CURRENT STAGES
    // =====================================================

    const oldStagesResult = await client.query(
      `
        SELECT
          stage_id
        FROM task_stages
        WHERE task_id = $1
        `,
      [taskId],
    );

    const oldStageIds = oldStagesResult.rows.map((row) => Number(row.stage_id));

    // =====================================================
    // DELETE OLD EMPLOYEE STAGE RECORDS
    // =====================================================

    if (oldStageIds.length > 0) {
      await client.query(
        `
        DELETE FROM employee_task_stages
        WHERE stage_id = ANY($1::int[])
        `,
        [oldStageIds],
      );
    }

    // =====================================================
    // DELETE OLD STAGES
    // =====================================================

    await client.query(
      `
      DELETE FROM task_stages
      WHERE task_id = $1
      `,
      [taskId],
    );

    // =====================================================
    // CREATE NEW STAGES
    // =====================================================

    const createdStages = [];

    for (const stage of cleanedStages) {
      const stageResult = await client.query(
        `
          INSERT INTO task_stages (
            task_id,
            title,
            description,
            due_date,
            stage_order
          )
          VALUES ($1, $2, $3, $4, $5)
          RETURNING *
          `,
        [
          taskId,
          stage.title,
          stage.description,
          stage.due_date,
          stage.stage_order,
        ],
      );

      createdStages.push(stageResult.rows[0]);
    }

    // =====================================================
    // IMPORTANT:
    // RE-CREATE EMPLOYEE STAGES
    // =====================================================

    const assignmentsResult = await client.query(
      `
        SELECT
          id
        FROM employee_tasks
        WHERE task_id = $1
        `,
      [taskId],
    );

    for (const assignment of assignmentsResult.rows) {
      for (const stage of createdStages) {
        await client.query(
          `
          INSERT INTO employee_task_stages (
            employee_task_id,
            stage_id,
            completed,
            completed_at
          )
          VALUES ($1, $2, 0, NULL)
          `,
          [assignment.id, stage.stage_id],
        );
      }

      // إعادة المهمة إلى pending
      await client.query(
        `
        UPDATE employee_tasks
        SET status = 'pending'
        WHERE id = $1
        `,
        [assignment.id],
      );
    }

    await client.query("COMMIT");

    return res.json({
      message: "تم تعديل المهمة بنجاح",

      task: taskResult.rows[0],

      stages: createdStages,
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("ROLLBACK ERROR:", rollbackError);
    }

    console.error("UPDATE TASK ERROR:", error);

    return res.status(500).json({
      message: "حدث خطأ أثناء تعديل المهمة",

      error: error.message,
      code: error.code,
      detail: error.detail,
    });
  } finally {
    client.release();
  }
};

// =========================================================
// DELETE TASK
// =========================================================

exports.deleteTask = async (req, res) => {
  const client = await pool.connect();

  try {
    const taskId = Number(req.params.id);

    // =====================================================
    // VALIDATION
    // =====================================================

    if (!Number.isInteger(taskId) || taskId <= 0) {
      return res.status(400).json({
        message: "معرف المهمة غير صحيح",
      });
    }

    await client.query("BEGIN");

    // =====================================================
    // DELETE EMPLOYEE STAGE RECORDS
    // =====================================================

    await client.query(
      `
      DELETE FROM employee_task_stages
      WHERE employee_task_id IN (
        SELECT id
        FROM employee_tasks
        WHERE task_id = $1
      )
      `,
      [taskId],
    );

    // =====================================================
    // DELETE ASSIGNMENTS
    // =====================================================

    await client.query(
      `
      DELETE FROM employee_tasks
      WHERE task_id = $1
      `,
      [taskId],
    );

    // =====================================================
    // DELETE STAGES
    // =====================================================

    await client.query(
      `
      DELETE FROM task_stages
      WHERE task_id = $1
      `,
      [taskId],
    );

    // =====================================================
    // DELETE TASK
    // =====================================================

    const result = await client.query(
      `
        DELETE FROM tasks
        WHERE task_id = $1
        RETURNING *
        `,
      [taskId],
    );

    if (result.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        message: "المهمة غير موجودة",
      });
    }

    await client.query("COMMIT");

    return res.json({
      message: "تم حذف المهمة بنجاح",

      task: result.rows[0],
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("ROLLBACK ERROR:", rollbackError);
    }

    console.error("DELETE TASK ERROR:", error);

    return res.status(500).json({
      message: "حدث خطأ أثناء حذف المهمة",

      error: error.message,
      code: error.code,
      detail: error.detail,
    });
  } finally {
    client.release();
  }
};
