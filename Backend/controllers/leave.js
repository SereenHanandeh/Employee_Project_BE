const { pool } = require("../models/db");

/* ============================= */
/*        CREATE LEAVE           */
/* ============================= */
exports.createLeave = async (req, res) => {
  try {
    const { employee_id, type, from_date, to_date, notes } = req.body;

    const from = new Date(from_date);
    const to = new Date(to_date);

    // ❌ validation مهم
    if (to < from) {
      return res.status(400).json({
        message: "To date must be greater than or equal from date",
      });
    }

    // ✅ حساب الأيام بشكل صحيح
    const days =
      Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    const result = await pool.query(
      `INSERT INTO leaves
       (employee_id, type, from_date, to_date, days, notes, status)
       VALUES ($1,$2,$3,$4,$5,$6,'pending')
       RETURNING *`,
      [employee_id, type, from_date, to_date, days, notes]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Create Leave Error" });
  }
};

/* ============================= */
/*          GET LEAVES           */
/* ============================= */
exports.getLeaves = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT l.*, emp.name
      FROM leaves l
      JOIN employees emp
      ON l.employee_id = emp.employee_id
      ORDER BY l.leave_id DESC
    `);

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Fetch Leaves Error" });
  }
};

/* ============================= */
/*       GET MY LEAVES          */
/* ============================= */
exports.getMyLeaves = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const result = await pool.query(
      `SELECT leave_id, type, from_date, to_date, days, status
       FROM leaves
       WHERE employee_id=$1
       ORDER BY leave_id DESC`,
      [userId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Fetch My Leaves Error" });
  }
};

/* ============================= */
/*     UPDATE LEAVE STATUS      */
/* ============================= */
exports.updateLeaveStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // ❌ validate status
    const allowed = ["pending", "approved", "rejected"];
    if (!allowed.includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const result = await pool.query(
      `UPDATE leaves
       SET status=$1
       WHERE leave_id=$2
       RETURNING *`,
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Leave not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Update Status Error" });
  }
};