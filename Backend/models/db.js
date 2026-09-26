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

/* =============================
        CREATE TABLES
============================= */

const createTables = async () => {
  const query = `

    /* =============================
            ROLES
    ============================= */

    CREATE TABLE IF NOT EXISTS roles(
      role_id SERIAL PRIMARY KEY,
      name VARCHAR(50) NOT NULL UNIQUE
    );


    /* =============================
            ADMINS
    ============================= */

    CREATE TABLE IF NOT EXISTS admins(
      admin_id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      role_id INT REFERENCES roles(role_id),
      created_at TIMESTAMP DEFAULT NOW()
    );


    /* =============================
          DEPARTMENTS
    ============================= */

    CREATE TABLE IF NOT EXISTS departments(
      department_id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      description TEXT,
      is_deleted SMALLINT DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    );


    /* =============================
            EMPLOYEES
    ============================= */

    CREATE TABLE IF NOT EXISTS employees(
      employee_id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,

      department VARCHAR(255),

      department_id INT
        REFERENCES departments(department_id)
        ON DELETE SET NULL,

      position VARCHAR(255),

      position VARCHAR(255),
job_description TEXT,   
      email VARCHAR(255) UNIQUE,
      password VARCHAR(255),

      role VARCHAR(50) DEFAULT 'employee',

      created_at TIMESTAMP DEFAULT NOW(),

      is_deleted SMALLINT DEFAULT 0
    );


    /* =============================
          EVALUATIONS
    ============================= */

    CREATE TABLE IF NOT EXISTS evaluations(
      evaluation_id SERIAL PRIMARY KEY,

      employee_id INT
        REFERENCES employees(employee_id)
        ON DELETE CASCADE,

      performance INT,
      personality INT,
      relations INT,
      total INT,

      percentage DECIMAL(5,2),

      grade VARCHAR(50),

      created_at TIMESTAMP DEFAULT NOW()
    );


        /* =============================
      JOB DESCRIPTION TRASH
    ============================= */

    CREATE TABLE IF NOT EXISTS job_description_trash(
      trash_id SERIAL PRIMARY KEY,

      employee_id INT NOT NULL
        REFERENCES employees(employee_id)
        ON DELETE CASCADE,

      employee_name VARCHAR(255),

      job_description_points JSONB NOT NULL DEFAULT '[]',

      deleted_at TIMESTAMP DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_jd_trash_employee_id
    ON job_description_trash(employee_id);
    
    /* =============================
            LEAVES
    ============================= */

    CREATE TABLE IF NOT EXISTS leaves(
      leave_id SERIAL PRIMARY KEY,

      employee_id INTEGER NOT NULL
        REFERENCES employees(employee_id)
        ON DELETE CASCADE,

      type VARCHAR(50) NOT NULL,

      from_date DATE NOT NULL,

      to_date DATE NOT NULL,

      days INTEGER NOT NULL,

      notes TEXT,

      attachment TEXT,

      status VARCHAR(20)
        DEFAULT 'pending',

      created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP
    );


    /* =============================
              TASKS
    ============================= */

    CREATE TABLE IF NOT EXISTS tasks(
      task_id SERIAL PRIMARY KEY,

      title VARCHAR(255) NOT NULL,

      description TEXT,

      created_by INT
        REFERENCES admins(admin_id),

      created_at TIMESTAMP DEFAULT NOW()
    );


    /* =============================
          EMPLOYEE TASKS
    ============================= */

    CREATE TABLE IF NOT EXISTS employee_tasks(
      id SERIAL PRIMARY KEY,

      employee_id INT
        REFERENCES employees(employee_id)
        ON DELETE CASCADE,

      task_id INT
        REFERENCES tasks(task_id)
        ON DELETE CASCADE,

      status VARCHAR(50)
        DEFAULT 'pending',

      selected_at TIMESTAMP
        DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS task_stages (
    stage_id SERIAL PRIMARY KEY,

    task_id INTEGER NOT NULL
        REFERENCES tasks(task_id)
        ON DELETE CASCADE,

    title VARCHAR(255) NOT NULL,

    description TEXT,

    due_date DATE,

    completed SMALLINT NOT NULL DEFAULT 0,

    stage_order INTEGER NOT NULL DEFAULT 1,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_task_stages_task_id
ON task_stages(task_id);

CREATE INDEX IF NOT EXISTS idx_task_stages_completed
ON task_stages(completed);



  `;

  
  try {
    await pool.query(query);

    console.log("✅ Tables Created Successfully");

  } catch (error) {

    console.error(
      "❌ Error Creating Tables:",
      error
    );
  }
};

// شغليها أول مرة فقط
// createTables();

module.exports = {
  pool,
};