const evaluationRouter = require("express").Router();

const {
  createEvaluation,
  getEvaluations,
  getEvaluationById,
  updateNotes,
  getMyEvaluations,
  updateEvaluation,
  deleteEvaluation,
} = require("../controllers/evaluation");

const isAdmin = require("../middleware/isAdmin");
const auth = require("../middleware/auth");

// =====================================================
// CREATE EVALUATION
// Admin + Employee
// =====================================================

evaluationRouter.post(
  "/",
  auth,
  createEvaluation
);

// =====================================================
// GET ALL EVALUATIONS
// Admin فقط
// =====================================================

evaluationRouter.get(
  "/",
  auth,
  isAdmin,
  getEvaluations
);

// =====================================================
// GET MY EVALUATIONS
// Employee + Admin
// =====================================================

evaluationRouter.get(
  "/my-evaluations",
  auth,
  getMyEvaluations
);

// =====================================================
// GET EVALUATION BY ID
// يجب أن يكون محميًا
// =====================================================

evaluationRouter.get(
  "/:id",
  auth,
  getEvaluationById
);

// =====================================================
// UPDATE NOTES
// Admin فقط
// =====================================================

evaluationRouter.put(
  "/:id/notes",
  auth,
  isAdmin,
  updateNotes
);

// =====================================================
// UPDATE EVALUATION
// Admin فقط
// =====================================================

evaluationRouter.put(
  "/:id",
  auth,
  isAdmin,
  updateEvaluation
);

// =====================================================
// DELETE EVALUATION
// Admin فقط
// =====================================================

evaluationRouter.delete(
  "/:id",
  auth,
  isAdmin,
  deleteEvaluation
);

module.exports = evaluationRouter;