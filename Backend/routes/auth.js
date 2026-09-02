const authrouter = require("express").Router();
const { login } = require("../controllers/auth");

authrouter.post("/login", login);

module.exports = authrouter;
