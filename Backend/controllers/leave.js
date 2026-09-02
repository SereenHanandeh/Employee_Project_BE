const { pool } = require("../models/db");

/* ============================= */
/*        CREATE LEAVE           */
/* ============================= */

const { pool } = require("../models/db");

// =====================================================
// CREATE LEAVE
// =====================================================

exports.createLeave = async (req, res) => {
  try {
    const {
      employee_id,
      type,
      from_date,
      to_date,
      notes,
    } = req.body;

    // =====================================================
    // تحديد الموظف
    // =====================================================

    let targetEmployeeId;

    if (req.user.role === "admin") {
      targetEmployeeId = employee_id;
    } else {
      targetEmployeeId =
        req.user.employee_id || req.user.id;
    }

    if (!targetEmployeeId) {
      return res.status(400).json({
        message: "employee_id مطلوب",
      });
    }

    // =====================================================
    // التأكد من الموظف
    // =====================================================

    const employeeCheck = await pool.query(
      `
      SELECT employee_id
      FROM employees
      WHERE employee_id = $1
        AND is_deleted = 0
      `,
      [targetEmployeeId]
    );

    if (employeeCheck.rows.length === 0) {
      return res.status(404).json({
        message: "الموظف غير موجود",
      });
    }

    // =====================================================
    // التحقق من البيانات
    // =====================================================

    if (!type || !type.trim()) {
      return res.status(400).json({
        message: "نوع الإجازة مطلوب",
      });
    }

    if (!from_date || !to_date) {
      return res.status(400).json({
        message:
          "تاريخ بداية ونهاية الإجازة مطلوبان",
      });
    }

    // =====================================================
    // التحقق من التاريخ
    // =====================================================

    const from = new Date(from_date);
    const to = new Date(to_date);

    if (
      Number.isNaN(from.getTime()) ||
      Number.isNaN(to.getTime())
    ) {
      return res.status(400).json({
        message: "التاريخ غير صالح",
      });
    }

    if (to < from) {
      return res.status(400).json({
        message:
          "تاريخ النهاية يجب أن يكون بعد أو يساوي تاريخ البداية",
      });
    }

    // =====================================================
    // حساب الأيام
    // =====================================================

    const days =
      Math.ceil(
        (to.getTime() - from.getTime()) /
          (1000 * 60 * 60 * 24)
      ) + 1;

    // =====================================================
    // ATTACHMENT
    // =====================================================

    const attachment = req.file
      ? `/uploads/leaves/${req.file.filename}`
      : null;

    console.log("Uploaded Leave File:", req.file);
    console.log("Saved Attachment:", attachment);

    // =====================================================
    // INSERT
    // =====================================================

    const result = await pool.query(
      `
      INSERT INTO leaves
      (
        employee_id,
        type,
        from_date,
        to_date,
        days,
        notes,
        attachment,
        status
      )
      VALUES
      ($1,$2,$3,$4,$5,$6,$7,'pending')
      RETURNING *
      `,
      [
        targetEmployeeId,
        type.trim(),
        from_date,
        to_date,
        days,
        notes?.trim() || null,
        attachment,
      ]
    );

    // =====================================================
    // RESPONSE
    // =====================================================

    res.status(201).json({
      message: "تم إنشاء طلب الإجازة بنجاح",
      leave: result.rows[0],
    });
  } catch (err) {
    console.error(
      "Create Leave Error:",
      err
    );

    // Multer errors
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        message:
          "حجم الملف يجب ألا يتجاوز 5MB",
      });
    }

    res.status(500).json({
      message:
        err.message ||
        "فشل إنشاء طلب الإجازة",
    });
  }
};

// =====================================================
// GET ALL LEAVES
// =====================================================

exports.getLeaves = async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        l.leave_id,
        l.employee_id,
        l.type,
        l.from_date,
        l.to_date,
        l.days,
        l.notes,
        l.attachment,
        l.status,
        emp.name
      FROM leaves l
      JOIN employees emp
        ON l.employee_id = emp.employee_id
      WHERE emp.is_deleted = 0
      ORDER BY l.leave_id DESC
      `
    );

    res.json(result.rows);
  } catch (err) {
    console.error(
      "Get Leaves Error:",
      err
    );

    res.status(500).json({
      message: "Fetch Leaves Error",
    });
  }
};

// =====================================================
// GET MY LEAVES
// =====================================================

exports.getMyLeaves = async (req, res) => {
  try {
    const userId = req.user?.employee_id || req.user?.id;

    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    const result = await pool.query(
      `
      SELECT
        leave_id,
        employee_id,
        type,
        from_date,
        to_date,
        days,
        notes,
        attachment,
        status
      FROM leaves
      WHERE employee_id = $1
      ORDER BY leave_id DESC
      `,
      [userId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(
      "Get My Leaves Error:",
      err
    );

    res.status(500).json({
      message: "Fetch My Leaves Error",
    });
  }
};

// =====================================================
// UPDATE LEAVE
// =====================================================

exports.updateLeave = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      type,
      from_date,
      to_date,
      notes,
    } = req.body;

    if (
      !type ||
      !from_date ||
      !to_date
    ) {
      return res.status(400).json({
        message:
          "نوع الإجازة وتاريخ البداية والنهاية مطلوبة",
      });
    }

    const from = new Date(from_date);
    const to = new Date(to_date);

    if (
      Number.isNaN(from.getTime()) ||
      Number.isNaN(to.getTime())
    ) {
      return res.status(400).json({
        message: "التاريخ غير صالح",
      });
    }

    if (to < from) {
      return res.status(400).json({
        message:
          "تاريخ النهاية يجب أن يكون بعد أو يساوي تاريخ البداية",
      });
    }

    const days =
      Math.ceil(
        (to.getTime() - from.getTime()) /
          (1000 * 60 * 60 * 24)
      ) + 1;

    const result = await pool.query(
      `
      UPDATE leaves
      SET
        type = $1,
        from_date = $2,
        to_date = $3,
        days = $4,
        notes = $5
      WHERE leave_id = $6
      RETURNING *
      `,
      [
        type.trim(),
        from_date,
        to_date,
        days,
        notes?.trim() || null,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "الإجازة غير موجودة",
      });
    }

    res.json({
      message: "تم تعديل الإجازة بنجاح",
      leave: result.rows[0],
    });
  } catch (err) {
    console.error(
      "Update Leave Error:",
      err
    );

    res.status(500).json({
      message: "Update Leave Error",
    });
  }
};

// =====================================================
// UPDATE LEAVE STATUS
// =====================================================

exports.updateLeaveStatus = async (
  req,
  res
) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const allowed = [
      "pending",
      "approved",
      "rejected",
    ];

    if (!allowed.includes(status)) {
      return res.status(400).json({
        message: "Invalid status",
      });
    }

    const result = await pool.query(
      `
      UPDATE leaves
      SET status = $1
      WHERE leave_id = $2
      RETURNING *
      `,
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Leave not found",
      });
    }

    res.json({
      message: "تم تحديث حالة الإجازة",
      leave: result.rows[0],
    });
  } catch (err) {
    console.error(
      "Update Status Error:",
      err
    );

    res.status(500).json({
      message: "Update Status Error",
    });
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
/*        UPDATE LEAVE           */
/* ============================= */

exports.updateLeave = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      type,
      from_date,
      to_date,
      notes,
    } = req.body;

    if (!type || !from_date || !to_date) {
      return res.status(400).json({
        message: "Type, from date and to date are required",
      });
    }

    const from = new Date(from_date);
    const to = new Date(to_date);

    if (
      Number.isNaN(from.getTime()) ||
      Number.isNaN(to.getTime())
    ) {
      return res.status(400).json({
        message: "Invalid date",
      });
    }

    if (to < from) {
      return res.status(400).json({
        message: "To date must be greater than or equal from date",
      });
    }

    const days =
      Math.ceil(
        (to.getTime() - from.getTime()) /
          (1000 * 60 * 60 * 24)
      ) + 1;

    const result = await pool.query(
      `UPDATE leaves
       SET
         type = $1,
         from_date = $2,
         to_date = $3,
         days = $4,
         notes = $5
       WHERE leave_id = $6
       RETURNING *`,
      [
        type,
        from_date,
        to_date,
        days,
        notes || null,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Leave not found",
      });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      message: "Update Leave Error",
    });
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
