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
    const maxTotal = 104;
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

    let result;

    if (req.user.role === "admin") {
      result = await pool.query(
        `
        SELECT
          e.*,
          emp.name
        FROM evaluations e
        JOIN employees emp
          ON e.employee_id = emp.employee_id
        WHERE e.evaluation_id = $1
        `,
        [id]
      );
    } else {
      result = await pool.query(
        `
        SELECT
          e.*,
          emp.name
        FROM evaluations e
        JOIN employees emp
          ON e.employee_id = emp.employee_id
        WHERE e.evaluation_id = $1
          AND e.employee_id = $2
        `,
        [id, req.user.id]
      );
    }

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Evaluation not found",
      });
    }

    return res.json(result.rows[0]);

  } catch (err) {
    console.error("Get Evaluation By ID Error:", err);

    return res.status(500).json({
      message: "Fetch Evaluation Error",
    });
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

/* ============================= */
/*      UPDATE EVALUATION        */
/* ============================= */


exports.updateEvaluation = async (req, res) => {
  try {
    const { id } = req.params;

    let {
      employee_id,
      performance = {},
      personality = {},
      relations = {},
      notes = "",
      from_date,
      to_date,
    } = req.body;

    performance = performance || {};
    personality = personality || {};
    relations = relations || {};

    // =========================
    // التحقق من الموظف
    // =========================

    if (!employee_id) {
      return res.status(400).json({
        message: "employee_id مطلوب",
      });
    }
    

    // =========================
    // حساب المجموع
    // =========================

    const totalPerformance = Object.values(performance).reduce(
      (sum, value) => sum + Number(value || 0),
      0
    );

    const totalPersonality = Object.values(personality).reduce(
      (sum, value) => sum + Number(value || 0),
      0
    );

    const totalRelations = Object.values(relations).reduce(
      (sum, value) => sum + Number(value || 0),
      0
    );

    const total =
      totalPerformance +
      totalPersonality +
      totalRelations;

    const maxTotal = 100;

    const percentage =
      (total / maxTotal) * 100;

    // =========================
    // التقدير
    // =========================

    let grade = "ضعيف";

    if (percentage >= 90) {
      grade = "ممتاز";
    } else if (percentage >= 75) {
      grade = "جيد جدا";
    } else if (percentage >= 60) {
      grade = "جيد";
    }

    // =========================
    // UPDATE
    // =========================

    const result = await pool.query(
      `
      UPDATE evaluations
      SET
        employee_id = $1,
        performance = $2,
        personality = $3,
        relations = $4,

        performance_details = $5,
        personality_details = $6,
        relations_details = $7,

        total = $8,
        percentage = $9,
        grade = $10,
        notes = $11,
        from_date = $12,
        to_date = $13

      WHERE evaluation_id = $14

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
        from_date,
        to_date,

        id,
      ]
    );

    // =========================
    // NOT FOUND
    // =========================

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Evaluation not found",
      });
    }

    // =========================
    // RESPONSE
    // =========================

    res.json(result.rows[0]);
  } catch (err) {
    console.error("UPDATE EVALUATION ERROR:", err);

    res.status(500).json({
      message: "Update Evaluation Error",
      error: err.message,
    });
  }
};