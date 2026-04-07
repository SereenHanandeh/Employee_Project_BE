const { pool } = require("../models/db");

/* ============================= */
/*      CREATE EVALUATION        */
/* ============================= */
exports.createEvaluation = async (req, res) => {
  try {
    let {
      employee_id,
      performance = {},
      personality = {},
      relations = {},
      notes = "",
      from_date,
      to_date,
    } = req.body;

    // حماية من undefined
    performance = performance || {};
    personality = personality || {};
    relations = relations || {};

    // =========================
    // حساب المجموع لكل قسم
    // =========================
    const totalPerformance = Object.values(performance).reduce(
      (a, b) => a + Number(b || 0),
      0
    );

    const totalPersonality = Object.values(personality).reduce(
      (a, b) => a + Number(b || 0),
      0
    );

    const totalRelations = Object.values(relations).reduce(
      (a, b) => a + Number(b || 0),
      0
    );

    // =========================
    // المجموع النهائي
    // =========================
    const total = totalPerformance + totalPersonality + totalRelations;
    const maxTotal = 100;
    const percentage = (total / maxTotal) * 100;

    // =========================
    // التقدير
    // =========================
    let grade = "ضعيف";
    if (percentage >= 90) grade = "ممتاز";
    else if (percentage >= 75) grade = "جيد جدا";
    else if (percentage >= 60) grade = "جيد";

    // =========================
    // INSERT DB مع RETURNING *
    // =========================
    const result = await pool.query(
      `
      INSERT INTO evaluations
        (employee_id, performance, personality, relations,
         performance_details, personality_details, relations_details,
         total, percentage, grade, notes, from_date, to_date)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING *
      `,
      [
        employee_id,
        totalPerformance,
        totalPersonality,
        totalRelations,
        performance,
        personality,
        relations,
        total,
        percentage,
        grade,
        notes,
        from_date, // الآن تمرر القيمتين
        to_date,
      ]
    );

    // إعادة الصف المضاف مباشرة
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Evaluation Error" });
  }
};
/* ============================= */
/*   GET EVALUATION BY ID        */
/* ============================= */
exports.getEvaluationById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT e.*, emp.name
   FROM evaluations e
   JOIN employees emp
   ON e.employee_id = emp.employee_id
   WHERE e.evaluation_id = $1`,
      [id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Evaluation not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Fetch Evaluation Error" });
  }
};

/* ============================= */
/*      GET EVALUATIONS          */
/* ============================= */
exports.getEvaluations = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT e.*, emp.name
      FROM evaluations e
      JOIN employees emp
      ON e.employee_id = emp.employee_id
      ORDER BY e.evaluation_id DESC
    `);

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Fetch Evaluations Error" });
  }
};

exports.updateNotes = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const result = await pool.query(
      `UPDATE evaluations SET notes=$1 WHERE evaluation_id=$2 RETURNING *`,
      [notes, id],
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Update Notes Error" });
  }
};

exports.getMyEvaluations = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT evaluation_id, performance, personality, relations, total, grade
FROM evaluations
WHERE employee_id=$1
ORDER BY evaluation_id DESC;`,
      [userId],
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Fetch Evaluations Error" });
  }
};

/* ============================= */
/*      DELETE EVALUATION       */
/* ============================= */
exports.deleteEvaluation = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `DELETE FROM evaluations 
       WHERE evaluation_id = $1 
       RETURNING *`,
      [id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Evaluation not found" });
    }

    res.json({
      message: "Evaluation deleted successfully",
      deleted: result.rows[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Delete Evaluation Error" });
  }
};
