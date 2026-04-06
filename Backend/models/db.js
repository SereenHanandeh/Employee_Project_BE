const { Pool } = require("pg");
require("dotenv").config();

const connectionString = process.env.DB_URL;

const pool = new Pool({
  connectionString,
});

pool
  .connect()
  .then((client) => {
    console.log(`✅ DB Connected to ${client.database}`);
    client.release();
  })
  .catch((err) => {
    console.error("❌ DB Connection Error:", err);
  });

/* ============================= */
/*         CREATE TABLES         */
/* ============================= */

const createTables = async () => {
  const query = `

  CREATE TABLE IF NOT EXISTS roles(
    role_id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS admins(
    admin_id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role_id INT REFERENCES roles(role_id),
    created_at TIMESTAMP DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS employees(
    employee_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    department VARCHAR(255),
    position VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    is_deleted SMALLINT DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS evaluations(
    evaluation_id SERIAL PRIMARY KEY,
    employee_id INT REFERENCES employees(employee_id) ON DELETE CASCADE,
    performance INT,
    personality INT,
    relations INT,
    total INT,
    percentage DECIMAL(5,2),
    grade VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS leaves(
    leave_id SERIAL PRIMARY KEY,
    employee_id INT REFERENCES employees(employee_id) ON DELETE CASCADE,
    type VARCHAR(50),
    from_date DATE NOT NULL,
    to_date DATE NOT NULL,
    days INT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
  );

  `;

  try {
    await pool.query(query);
    console.log("✅ Tables Created Successfully");
  } catch (error) {
    console.error("❌ Error Creating Tables:", error);
  }
};

// شغليها أول مرة فقط
//createTables();

module.exports = { pool };
