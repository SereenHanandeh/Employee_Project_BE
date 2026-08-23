const { pool } = require("../models/db");

/* ============================= */
/*        CREATE TASK (ADMIN)    */
/* ============================= */
exports.createTask = async (req, res) => {
  try {
    const { title, description } = req.body;

    const result = await pool.query(
      `INSERT INTO tasks (title, description)
       VALUES ($1,$2)
       RETURNING *`,
      [title, description]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Create Task Error" });
  }
};

/* ============================= */
/*        GET ALL TASKS          */
/* ============================= */
exports.getTasks = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM tasks ORDER BY task_id DESC`
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: "Fetch Tasks Error" });
  }
};

/* ============================= */
/*     ASSIGN TASK TO EMPLOYEE   */
/* ============================= */
exports.assignTask = async (req, res) => {
  try {
    const { employee_id, task_id } = req.body;

    const result = await pool.query(
      `INSERT INTO employee_tasks (employee_id, task_id)
       VALUES ($1,$2)
       RETURNING *`,
      [employee_id, task_id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: "Assign Error" });
  }
};

// =============================
// UPDATE TASK (ADMIN)
// =============================
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
       SET title = $1, description = $2
       WHERE task_id = $3
       RETURNING *`,
      [title.trim(), description || "", id]
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

// =============================
// DELETE TASK (ADMIN)
// =============================
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