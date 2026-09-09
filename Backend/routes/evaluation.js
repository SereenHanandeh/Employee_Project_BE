const evaluationRouter = require("express").Router();

const {
  createEvaluation,
  getEvaluationById,
  getEvaluations,
  getDeletedEvaluations,
  restoreEvaluation,
  updateNotes,
  getMyEvaluations,
  deleteEvaluation,
  updateEvaluation,
} = require("../controllers/evaluation");

const auth = require("../middleware/auth");
const isAdmin = require("../middleware/isAdmin");

// =========================================================
// CREATE
// =========================================================

evaluationRouter.post(
  "/",
  auth,
  isAdmin,
  createEvaluation
);

// =========================================================
// GET ALL ACTIVE
// =========================================================

evaluationRouter.get(
  "/",
  auth,
  isAdmin,
  getEvaluations
);

// =========================================================
// GET TRASH
// مهم: يجب أن يكون قبل /:id
// =========================================================

evaluationRouter.get(
  "/trash",
  auth,
  isAdmin,
  getDeletedEvaluations
);

// =========================================================
// RESTORE
// مهم: يجب أن يكون قبل /:id
// =========================================================

evaluationRouter.put(
  "/:id/restore",
  auth,
  isAdmin,
  restoreEvaluation
);

// =========================================================
// MY EVALUATIONS
// =========================================================

evaluationRouter.get(
  "/my",
  auth,
  getMyEvaluations
);

// =========================================================
// UPDATE NOTES
// =========================================================

evaluationRouter.put(
  "/:id/notes",
  auth,
  updateNotes
);

// =========================================================
// UPDATE EVALUATION
// =========================================================

evaluationRouter.put(
  "/:id",
  auth,
  isAdmin,
  updateEvaluation
);

// =========================================================
// DELETE -> TRASH
// =========================================================

evaluationRouter.delete(
  "/:id",
  auth,
  isAdmin,
  deleteEvaluation
);

// =========================================================
// GET BY ID
// يجب أن يكون في النهاية
// =========================================================

evaluationRouter.get(
  "/:id",
  auth,
  getEvaluationById
);

module.exports = evaluationRouter;