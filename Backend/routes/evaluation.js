const evaluationRouter = require("express").Router();
const {
  createEvaluation,
  getEvaluations,
  getEvaluationById,
  updateNotes,
  getMyEvaluations,
  deleteEvaluation
} = require("../controllers/evaluation");
const isAdmin = require("../middleware/isAdmin");

const auth = require("../middleware/auth");

evaluationRouter.post("/", auth, createEvaluation);
evaluationRouter.get("/", auth, getEvaluations);
evaluationRouter.get("/my-evaluations", auth, getMyEvaluations);
evaluationRouter.get("/:id", getEvaluationById);
evaluationRouter.put("/:id", auth, updateNotes);
evaluationRouter.delete("/:id",auth,isAdmin, deleteEvaluation);

module.exports = evaluationRouter;
