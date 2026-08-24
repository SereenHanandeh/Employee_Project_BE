const { pool } = require("../models/db");

/* ============================= */
/*        CREATE LEAVE           */
/* ============================= */

exports.createLeave = async (req, res) => {
  try {
    let {
      employee_id,
      type,
      from_date,
      to_date,
      notes,
    } = req.body;

    /* =============================
       VALIDATION
    ============================= */

    if (!type || !from_date || !to_date) {
      return res.status(400).json({
        message: "نوع الإجازة وتاريخ البداية والنهاية مطلوبة",
      });
    }

    /* =============================
       GET CURRENT USER
    ============================= */

    const userId = req.user?.id;
    const role = req.user?.role;

    if (!userId) {
      return res.status(401).json({
        message: "غير مصرح",
      });
    }

    /* =============================
       EMPLOYEE
    ============================= */

    if (role !== "admin") {
      /*
       الموظف لا يستطيع إرسال طلب
       لموظف آخر.
       
       نبحث عن employee المرتبط
       بالمستخدم الحالي.
      */

      const employeeResult = await pool.query(
        `
        SELECT employee_id
        FROM employees
        WHERE id = $1
        `,
        [userId]
      );

      if (employeeResult.rows.length === 0) {
        return res.status(404).json({
          message: "لم يتم العثور على بيانات الموظف",
        });
      }

      employee_id = employeeResult.rows[0].employee_id;
    }

    /* =============================
       ADMIN VALIDATION
    ============================= */

    if (role === "admin") {
      if (!employee_id) {
        return res.status(400).json({
          message: "يجب اختيار الموظف",
        });
      }
    }

    /* =============================
       CHECK EMPLOYEE
    ============================= */

    const employeeResult = await pool.query(
      `
      SELECT employee_id
      FROM employees
      WHERE employee_id = $1
      `,
      [employee_id]
    );

    if (employeeResult.rows.length === 0) {
      return res.status(404).json({
        message: "الموظف غير موجود",
      });
    }

    /* =============================
       DATE VALIDATION
    ============================= */

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

    /* =============================
       CALCULATE DAYS
    ============================= */

    const days =
      Math.ceil(
        (to.getTime() - from.getTime()) /
          (1000 * 60 * 60 * 24)
      ) + 1;

    /* =============================
       IMAGE
    ============================= */

    let attachment = null;

    if (req.file) {
      attachment = `/uploads/leaves/${req.file.filename}`;
    }

    /* =============================
       INSERT
    ============================= */

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
        status,
        attachment
      )
      VALUES
      ($1,$2,$3,$4,$5,$6,'pending',$7)
      RETURNING *
      `,
      [
        employee_id,
        type,
        from_date,
        to_date,
        days,
        notes || null,
        attachment,
      ]
    );

    res.status(201).json(result.rows[0]);

  } catch (err) {
    console.error("CREATE LEAVE ERROR:", err);

    res.status(500).json({
      message: "حدث خطأ أثناء إنشاء طلب الإجازة",
    });
  }
};


/* ============================= */
/*          GET LEAVES           */
/*           ADMIN               */
/* ============================= */

exports.getLeaves = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        l.*,
        emp.name,
        emp.email
      FROM leaves l
      INNER JOIN employees emp
        ON l.employee_id = emp.employee_id
      ORDER BY l.leave_id DESC
    `);

    res.json(result.rows);

  } catch (err) {
    console.error("GET LEAVES ERROR:", err);

    res.status(500).json({
      message: "حدث خطأ أثناء جلب الإجازات",
    });
  }
};


/* ============================= */
/*        GET MY LEAVES          */
/* ============================= */

exports.getMyLeaves = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        message: "غير مصرح",
      });
    }

    /*
      مهم:
      id الموجود في التوكن قد يكون users.id
      وليس employees.employee_id.

      لذلك نجيب employee_id أولاً.
    */

    const employeeResult = await pool.query(
      `
      SELECT employee_id
      FROM employees
      WHERE id = $1
      `,
      [userId]
    );

    if (employeeResult.rows.length === 0) {
      return res.status(404).json({
        message: "لم يتم العثور على الموظف",
      });
    }

    const employeeId =
      employeeResult.rows[0].employee_id;

    /* =============================
       GET LEAVES
    ============================= */

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
        status,
        attachment
      FROM leaves
      WHERE employee_id = $1
      ORDER BY leave_id DESC
      `,
      [employeeId]
    );

    res.json(result.rows);

  } catch (err) {
    console.error("GET MY LEAVES ERROR:", err);

    res.status(500).json({
      message: "حدث خطأ أثناء جلب إجازات الموظف",
    });
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

    /* =============================
       GET OLD IMAGE
    ============================= */

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
      oldLeave.rows[0].attachment;

    /* =============================
       NEW IMAGE
    ============================= */

    if (req.file) {
      attachment = `/uploads/leaves/${req.file.filename}`;
    }

    /* =============================
       UPDATE
    ============================= */

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
        notes || null,
        attachment,
        id,
      ]
    );

    res.json(result.rows[0]);

  } catch (err) {
    console.error("UPDATE LEAVE ERROR:", err);

    res.status(500).json({
      message: "حدث خطأ أثناء تعديل الإجازة",
    });
  }
};


/* ============================= */
/*      UPDATE LEAVE STATUS      */
/* ============================= */

exports.updateLeaveStatus = async (req, res) => {
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
        message: "حالة الإجازة غير صالحة",
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
        message: "طلب الإجازة غير موجود",
      });
    }

    res.json(result.rows[0]);

  } catch (err) {
    console.error("UPDATE LEAVE STATUS ERROR:", err);

    res.status(500).json({
      message: "حدث خطأ أثناء تحديث حالة الإجازة",
    });
  }
};