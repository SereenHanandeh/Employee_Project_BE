const { pool } = require("../config/db");

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