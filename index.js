import express from "express";
import { Firestore } from "@google-cloud/firestore";

const app = express();
app.use(express.json());

// Health check
app.get("/", (req, res) => {
  res.status(200).send("OK v1");
});

const db = new Firestore();

app.post("/action", async (req, res) => {
  try {
    const {
      reqId,
      pendingAction,
      actionBy,
      actionReason,
      assigneeEmail,
      liftingPlanDriveFileId
    } = req.body;

    if (!reqId || !pendingAction || !actionBy) {
      return res.status(400).json({
        error: "Missing required fields: reqId, pendingAction, actionBy"
      });
    }

    const ref = db.collection("requisitions").doc(reqId);

    const updateData = {
      pendingAction,
      actionBy,
      actionReason: actionReason || "",
      updatedAt: new Date()
    };

    if (assigneeEmail !== undefined) updateData.assigneeEmail = assigneeEmail;
    if (liftingPlanDriveFileId !== undefined)
      updateData.liftingPlanDriveFileId = liftingPlanDriveFileId;

    await ref.update(updateData);

    res.json({ ok: true, message: "Action sent to workflow" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

const port = process.env.PORT || 8080;
app.listen(port, () => console.log("Listening on port", port));
