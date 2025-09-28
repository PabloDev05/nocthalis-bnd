import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { submitFeedback } from "../controllers/feedback.controller";

const feedbackRouter = Router();

feedbackRouter.post("/feed-submit", requireAuth, submitFeedback);

export default feedbackRouter;
