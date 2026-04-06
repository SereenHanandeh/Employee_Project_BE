const employeerouter = require("express").Router();

const {
  createEmployee,
  getEmployees,
  deleteEmployee,
  updateEmployee,
  getMe,
} = require("../controllers/employee");

const auth = require("../middleware/auth");
const isAdmin = require("../middleware/isAdmin");
employeerouter.get("/me",auth, getMe);

// فقط الأدمن يضيف موظف
employeerouter.post("/", auth, isAdmin, createEmployee);


// الجميع بعد تسجيل الدخول يشوف الموظفين
employeerouter.get("/", auth, getEmployees);

// فقط الأدمن يحذف
employeerouter.delete("/:id", auth, isAdmin, deleteEmployee);

employeerouter.put("/:id", auth, isAdmin, updateEmployee);


module.exports = employeerouter;
