const { pool } = require("../models/db");

// =============================
// CREATE LEAVE
// =============================

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

    // إذا كان المستخدم موظفًا
    // نأخذ employee_id من بياناته
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