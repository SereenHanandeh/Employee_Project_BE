
const { pool } = require("../models/db");
const cloudinary = require("../config/cloudinary");
const streamifier = require("streamifier");

const uploadToCloudinary = (file) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "leaves",
        resource_type: "image",
      },
      (error, result) => {
        if (error) {
          console.error("CLOUDINARY UPLOAD ERROR:", error);
          return reject(error);
        }

        resolve(result);
      }
    );

    streamifier
      .createReadStream(file.buffer)
      .pipe(uploadStream);
  });
};

// =====================================================
// CREATE LEAVE
// =====================================================

exports.createLeave = async (req, res) => {
  try {
    console.log("======================================");
    console.log("CREATE LEAVE");
    console.log("BODY:", req.body);
    console.log("FILE:", req.file);
    console.log("USER:", req.user);
    console.log("======================================");

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

    if (req.user?.role === "admin") {
      targetEmployeeId = employee_id;
    } else {
      targetEmployeeId =
        req.user?.employee_id ||
        req.user?.id;
    }

    if (!targetEmployeeId) {
      return res.status(400).json({
        message: "employee_id مطلوب",
      });
    }

    // =====================================================
    // التأكد من وجود الموظف
    // =====================================================

    const employeeCheck = await pool.query(
      `
      SELECT employee_id, name
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
    // التحقق من نوع الإجازة
    // =====================================================

    if (!type || !type.trim()) {
      return res.status(400).json({
        message: "نوع الإجازة مطلوب",
      });
    }

    // =====================================================
    // التحقق من التواريخ
    // =====================================================

    if (!from_date || !to_date) {
      return res.status(400).json({
        message:
          "تاريخ بداية ونهاية الإجازة مطلوبان",
      });
    }

    const from = new Date(
      `${from_date}T00:00:00`
    );

    const to = new Date(
      `${to_date}T00:00:00`
    );

    if (
      Number.isNaN(from.getTime()) ||
      Number.isNaN(to.getTime())
    ) {
      return res.status(400).json({
        message: "التاريخ غير صالح",
      });
    }

    // =====================================================
    // التأكد من ترتيب التاريخ
    // =====================================================

    if (to < from) {
      return res.status(400).json({
        message:
          "تاريخ النهاية يجب أن يكون بعد أو يساوي تاريخ البداية",
      });
    }

    // =====================================================
    // حساب عدد الأيام
    // =====================================================

    const difference =
      to.getTime() - from.getTime();

    const days =
      Math.floor(
        difference /
          (1000 * 60 * 60 * 24)
      ) + 1;

    if (days <= 0) {
      return res.status(400).json({
        message: "عدد أيام الإجازة غير صحيح",
      });
    }

    // =====================================================
    // المرفق
    // =====================================================

   let attachment = null;

if (req.file) {
  const cloudinaryResult = await uploadToCloudinary(
    req.file
  );

  attachment = cloudinaryResult.secure_url;

  console.log(
    "Cloudinary URL:",
    attachment
  );
}

    console.log("Employee ID:", targetEmployeeId);
    console.log("Type:", type);
    console.log("From Date:", from_date);
    console.log("To Date:", to_date);
    console.log("Days:", days);
    console.log("Notes:", notes);
    console.log("Attachment:", attachment);

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
      ($1, $2, $3, $4, $5, $6, $7, 'pending')
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

    console.log(
      "Leave created successfully:",
      result.rows[0]
    );

    return res.status(201).json({
      message: "تم إنشاء طلب الإجازة بنجاح",
      leave: result.rows[0],
    });

  } catch (err) {
    console.error("======================================");
    console.error("CREATE LEAVE ERROR:");
    console.error(err);
    console.error("======================================");

    // =====================================================
    // Multer - حجم الملف
    // =====================================================

    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        message:
          "حجم الملف يجب ألا يتجاوز 5 ميجابايت",
      });
    }

    // =====================================================
    // PostgreSQL Error
    // =====================================================

    return res.status(500).json({
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

    return res.json(result.rows);

  } catch (err) {
    console.error(
      "Get Leaves Error:",
      err
    );

    return res.status(500).json({
      message: "Fetch Leaves Error",
    });
  }
};


// =====================================================
// GET MY LEAVES
// =====================================================

exports.getMyLeaves = async (req, res) => {
  try {
    const employeeId =
      req.user?.employee_id ||
      req.user?.id;

    if (!employeeId) {
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
      [employeeId]
    );

    return res.json(result.rows);

  } catch (err) {
    console.error(
      "Get My Leaves Error:",
      err
    );

    return res.status(500).json({
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

    // =====================================================
    // التحقق من البيانات
    // =====================================================

    if (
      !type ||
      !type.trim() ||
      !from_date ||
      !to_date
    ) {
      return res.status(400).json({
        message:
          "نوع الإجازة وتاريخ البداية والنهاية مطلوبة",
      });
    }

    // =====================================================
    // التحقق من التاريخ
    // =====================================================

    const from = new Date(
      `${from_date}T00:00:00`
    );

    const to = new Date(
      `${to_date}T00:00:00`
    );

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
      Math.floor(
        (to.getTime() - from.getTime()) /
          (1000 * 60 * 60 * 24)
      ) + 1;

    // =====================================================
    // UPDATE
    // =====================================================

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

    return res.json({
      message: "تم تعديل الإجازة بنجاح",
      leave: result.rows[0],
    });

  } catch (err) {
    console.error(
      "Update Leave Error:",
      err
    );

    return res.status(500).json({
      message:
        err.message ||
        "Update Leave Error",
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

    // =====================================================
    // الحالات المسموحة
    // =====================================================

    const allowedStatuses = [
      "pending",
      "approved",
      "rejected",
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        message: "Invalid status",
      });
    }

    // =====================================================
    // UPDATE STATUS
    // =====================================================

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

    return res.json({
      message: "تم تحديث حالة الإجازة",
      leave: result.rows[0],
    });

  } catch (err) {
    console.error(
      "Update Status Error:",
      err
    );

    return res.status(500).json({
      message:
        err.message ||
        "Update Status Error",
    });
  }
};
