import express from "express";
import { Firestore } from "@google-cloud/firestore";

const app = express();
app.use(express.json());

// --------------------
// Health check
// --------------------
app.get("/", (req, res) => {
  res.status(200).send("OK v1");
});

// --------------------
// Web Portal (UI)
// --------------------
app.get("/portal", (req, res) => {
  res.type("html").send(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Lifting Requisition Portal</title>
</head>
<body style="font-family: Arial; max-width: 720px; margin: 30px auto;">
  <h2>Lifting Requisition Portal</h2>

  <label>Requisition ID</label><br/>
  <input id="reqId" style="width:100%; padding:8px" placeholder="REQ-TEST-001"><br/><br/>

  <label>Action</label><br/>
  <select id="action" style="width:100%; padding:8px">
    <option value="ADMIN_ASSIGN">ADMIN_ASSIGN</option>
    <option value="ADMIN_RETURN">ADMIN_RETURN</option>
    <option value="ADMIN_IN_PROGRESS">ADMIN_IN_PROGRESS</option>
    <option value="ADMIN_HOLD">ADMIN_HOLD</option>
    <option value="ADMIN_COMPLETE">ADMIN_COMPLETE</option>
    <option value="ADMIN_CANCEL">ADMIN_CANCEL</option>

    <option value="ASSIGNEE_IN_PROGRESS">ASSIGNEE_IN_PROGRESS</option>
    <option value="ASSIGNEE_HOLD">ASSIGNEE_HOLD</option>
    <option value="ASSIGNEE_WAITING_CLIENT_APPROVAL">ASSIGNEE_WAITING_CLIENT_APPROVAL</option>
    <option value="ASSIGNEE_COMPLETE">ASSIGNEE_COMPLETE</option>
    <option value="ASSIGNEE_RETURN">ASSIGNEE_RETURN</option>
    <option value="ASSIGNEE_CANCEL">ASSIGNEE_CANCEL</option>
  </select><br/><br/>

  <label>Action By (email)</label><br/>
  <input id="actionBy" style="width:100%; padding:8px" placeholder="admin@test.com"><br/><br/>

  <label>Assignee Email (optional)</label><br/>
  <input id="assigneeEmail" style="width:100%; padding:8px" placeholder="employee@test.com"><br/><br/>

  <label>Reason (optional)</label><br/>
  <textarea id="actionReason" style="width:100%; padding:8px" rows="4"></textarea><br/><br/>

  <button onclick="send()" style="padding:10px 14px">Submit</button>

  <pre id="out" style="background:#111; color:#0f0; padding:12px; margin-top:16px; overflow:auto"></pre>

<script>
async function send() {
  const body = {
    reqId: document.getElementById("reqId").value.trim(),
    pendingAction: document.getElementById("action").value,
    actionBy: document.getElementById("actionBy").value.trim(),
    actionReason: document.getElementById("actionReason").value,
    assigneeEmail: document.getElementById("assigneeEmail").value.trim()
  };

  const res = await fetch("/action", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify(body)
  });

  document.getElementById("out").textContent = await res.text();
}
</script>
</body>
</html>
  `);
});

// --------------------
// Firestore + Workflow trigger
// --------------------
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

// --------------------
const port = process.env.PORT || 8080;
app.listen(port, () => console.log("Listening on port", port));
