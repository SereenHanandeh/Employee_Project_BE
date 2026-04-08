const employeerouter = require("express").Router();

const {
  createEmployee,
  getEmployees,
  deleteEmployee,
  updateEmployee,
  getMe,
  restoreEmployee,
  getDeletedEmployees
} = require("../controllers/employee");

const auth = require("../middleware/auth");
const isAdmin = require("../middleware/isAdmin");
employeerouter.get("/me",auth, getMe);

// فقط الأدمن يضيف موظف
employeerouter.post("/", auth, isAdmin, createEmployee);


// الجميع بعد تسجيل الدخول يشوف الموظفين
employeerouter.get("/", auth, getEmployees);

// فقط الأدمن يحذف
employeerouter.delete("/:id/delete", auth, isAdmin, deleteEmployee);

employeerouter.put("/:id/update", auth, isAdmin, updateEmployee);

employeerouter.post("/:id/restore", auth, isAdmin, restoreEmployee);
employeerouter.post("/deleted", auth, isAdmin, getDeletedEmployees);


module.exports = employeerouter;
