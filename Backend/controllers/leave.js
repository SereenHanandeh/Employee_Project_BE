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

    // =============================
    // VALIDATION
    // =============================

    if (!type) {
      return res.status(400).json({
        message: "نوع الإجازة مطلوب",
      });
    }

    if (!from_date || !to_date) {
      return res.status(400).json({
        message: "تاريخ بداية ونهاية الإجازة مطلوبان",
      });
    }

    const from = new Date(from_date);
    const to = new Date(to_date);

    if (
      Number.isNaN(from.getTime()) ||
      Number.isNaN(to.getTime())
    ) {
      return res.status(400).json({
        message: "التاريخ غير صحيح",
      });
    }

    if (to < from) {
      return res.status(400).json({
        message:
          "تاريخ نهاية الإجازة يجب أن يكون بعد أو مساويًا لتاريخ البداية",
      });
    }

    // =============================
    // EMPLOYEE ID
    // =============================

    let finalEmployeeId = employee_id;

    // الموظف لا يستطيع اختيار موظف آخر
    if (req.user?.role !== "admin") {
      finalEmployeeId = req.user?.employee_id;
    }

    if (!finalEmployeeId) {
      return res.status(400).json({
        message: "لم يتم تحديد الموظف",
      });
    }

    // =============================
    // CALCULATE DAYS
    // =============================

    const days =
      Math.floor(
        (
          Date.UTC(
            to.getFullYear(),
            to.getMonth(),
            to.getDate()
          ) -
          Date.UTC(
            from.getFullYear(),
            from.getMonth(),
            from.getDate()
          )
        ) /
          (1000 * 60 * 60 * 24)
      ) + 1;

    // =============================
    // ATTACHMENT
    // =============================

    let attachment = null;

    if (req.file) {
      attachment = `/uploads/leaves/${req.file.filename}`;
    }

    // =============================
    // INSERT
    // =============================

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
      VALUES ($1,$2,$3,$4,$5,$6,$7,'pending')
      RETURNING *
      `,
      [
        finalEmployeeId,
        type,
        from_date,
        to_date,
        days,
        notes?.trim() || null,
        attachment,
      ]
    );

    return res.status(201).json({
      message: "تم إنشاء طلب الإجازة بنجاح",
      leave: result.rows[0],
    });

  } catch (err) {
    console.error("CREATE LEAVE ERROR:", err);

    return res.status(500).json({
      message: "حدث خطأ أثناء إنشاء طلب الإجازة",
    });
  }
};


// =====================================================
// GET ALL LEAVES
// =====================================================

exports.getLeaves = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        l.*,
        emp.name AS employee_name
      FROM leaves l
      JOIN employees emp
        ON l.employee_id = emp.employee_id
      ORDER BY l.leave_id DESC
    `);

    return res.json(result.rows);

  } catch (err) {
    console.error("GET LEAVES ERROR:", err);

    return res.status(500).json({
      message: "حدث خطأ أثناء جلب الإجازات",
    });
  }
};


// =====================================================
// GET MY LEAVES
// =====================================================

exports.getMyLeaves = async (req, res) => {
  try {

    const employeeId = req.user?.employee_id;

    if (!employeeId) {
      return res.status(401).json({
        message: "لم يتم تحديد الموظف",
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
        status,
        created_at
      FROM leaves
      WHERE employee_id = $1
      ORDER BY leave_id DESC
      `,
      [employeeId]
    );

    return res.json(result.rows);

  } catch (err) {
    console.error("GET MY LEAVES ERROR:", err);

    return res.status(500).json({
      message: "حدث خطأ أثناء جلب إجازات الموظف",
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

    // =============================
    // VALIDATION
    // =============================

    if (!type || !from_date || !to_date) {
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
        message: "التاريخ غير صحيح",
      });
    }

    if (to < from) {
      return res.status(400).json({
        message:
          "تاريخ نهاية الإجازة يجب أن يكون بعد أو مساويًا لتاريخ البداية",
      });
    }

    // =============================
    // CALCULATE DAYS
    // =============================

    const days =
      Math.floor(
        (
          Date.UTC(
            to.getFullYear(),
            to.getMonth(),
            to.getDate()
          ) -
          Date.UTC(
            from.getFullYear(),
            from.getMonth(),
            from.getDate()
          )
        ) /
          (1000 * 60 * 60 * 24)
      ) + 1;

    // =============================
    // OLD ATTACHMENT
    // =============================

    const oldLeave = await pool.query(
      `
      SELECT attachment
      FROM leaves
      WHERE leave_id = $1
      `,
      [id]
    );

    if (oldLeave.rows.length === 0) {
      return res.status(404).json({
        message: "طلب الإجازة غير موجود",
      });
    }

    let attachment =
      oldLeave.rows[0].attachment || null;

    // إذا تم رفع ملف جديد
    if (req.file) {
      attachment = `/uploads/leaves/${req.file.filename}`;
    }

    // =============================
    // UPDATE
    // =============================

    const result = await pool.query(
      `
      UPDATE leaves
      SET
        type = $1,
        from_date = $2,
        to_date = $3,
        days = $4,
        notes = $5,
        attachment = $6
      WHERE leave_id = $7
      RETURNING *
      `,
      [
        type,
        from_date,
        to_date,
        days,
        notes?.trim() || null,
        attachment,
        id,
      ]
    );

    return res.json({
      message: "تم تعديل طلب الإجازة بنجاح",
      leave: result.rows[0],
    });

  } catch (err) {
    console.error("UPDATE LEAVE ERROR:", err);

    return res.status(500).json({
      message: "حدث خطأ أثناء تعديل طلب الإجازة",
    });
  }
};


// =====================================================
// UPDATE LEAVE STATUS
// =====================================================

exports.updateLeaveStatus = async (req, res) => {
  try {

    const { id } = req.params;
    const { status } = req.body;

    // =============================
    // VALID STATUS
    // =============================

    const allowedStatuses = [
      "pending",
      "approved",
      "rejected",
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        message: "حالة الإجازة غير صحيحة",
      });
    }

    // =============================
    // UPDATE
    // =============================

    const result = await pool.query(
      `
      UPDATE leaves
      SET status = $1
      WHERE leave_id = $2
      RETURNING *
      `,
      [
        status,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "طلب الإجازة غير موجود",
      });
    }

    return res.json({
      message: "تم تحديث حالة الإجازة بنجاح",
      leave: result.rows[0],
    });

  } catch (err) {
    console.error(
      "UPDATE LEAVE STATUS ERROR:",
      err
    );

    return res.status(500).json({
      message:
        "حدث خطأ أثناء تحديث حالة الإجازة",
    });
  }
};