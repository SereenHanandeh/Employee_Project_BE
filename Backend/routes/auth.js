const authrouter = require("express").Router();
const { login } = require("../controllers/auth");

authrouter.post("/login", login);
//authrouter.post("/logout", logout);

module.exports = authrouter;
