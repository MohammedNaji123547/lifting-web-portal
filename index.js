import express from "express";
import { Firestore } from "@google-cloud/firestore";

const app = express();
app.use(express.json());
app.get("/", (req, res) => {
  res.send("OK");
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
      return res.status(400).json({ error: "Missing required fields" });
    }

    const ref = db.collection("requisitions").doc(reqId);

    await ref.update({
      pendingAction,
      actionBy,
      actionReason: actionReason || "",
      assigneeEmail: assigneeEmail || "",
      liftingPlanDriveFileId: liftingPlanDriveFileId || "",
      updatedAt: new Date()
    });

    res.json({ ok: true, message: "Action sent to workflow" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

const port = process.env.PORT || 8080;
app.listen(port, () =>
  console.log(`API running on port ${port}`)
);
