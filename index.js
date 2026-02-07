import express from "express";
import { Firestore } from "@google-cloud/firestore";

const app = express();
app.use(express.json());

// Firestore client (must be before routes that use it)
const db = new Firestore();

// --------------------
// Health check
// --------------------
app.get("/", (req, res) => {
  res.status(200).send("OK v1");
});

// --------------------
// Web Portal (UI - manual action form)
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

  <label>Lifting Plan Drive File ID (optional)</label><br/>
  <input id="liftingPlanDriveFileId" style="width:100%; padding:8px" placeholder="DriveFileId..."><br/><br/>

  <button onclick="send()" style="padding:10px 14px">Submit</button>

  <pre id="out" style="background:#111; color:#0f0; padding:12px; margin-top:16px; overflow:auto"></pre>

<script>
async function send() {
  const body = {
    reqId: document.getElementById("reqId").value.trim(),
    pendingAction: document.getElementById("action").value,
    actionBy: document.getElementById("actionBy").value.trim(),
    actionReason: document.getElementById("actionReason").value,
    assigneeEmail: document.getElementById("assigneeEmail").value.trim(),
    liftingPlanDriveFileId: document.getElementById("liftingPlanDriveFileId").value.trim()
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
// API: List requisitions (latest 50)
// Note: requires "updatedAt" to exist on docs for ordering
// --------------------
app.get("/requisitions", async (req, res) => {
  try {
    const snap = await db
      .collection("requisitions")
      .orderBy("updatedAt", "desc")
      .limit(50)
      .get();

    const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    res.json({ ok: true, rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({
      ok: false,
      error: "Failed to list requisitions",
      details: String(e?.message || e),
    });
  }
});

// --------------------
// Dashboard (simple HTML table)
// --------------------
app.get("/dashboard", (req, res) => {
  res.type("html").send(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Lifting Dashboard</title>
</head>
<body style="font-family: Arial; max-width: 1100px; margin: 30px auto;">
  <h2>Lifting Requisitions Dashboard</h2>

  <div style="margin-bottom: 12px;">
    <button onclick="load()">Load latest 50</button>
    <a href="/portal" style="margin-left:10px;">Open Portal</a>
  </div>

  <div id="msg" style="margin: 10px 0; color:#444;"></div>

  <table border="1" cellpadding="8" cellspacing="0" style="width:100%; border-collapse: collapse;">
    <thead>
      <tr>
        <th>Req ID</th>
        <th>Title</th>
        <th>Status</th>
        <th>Assignee</th>
        <th>Assignee Status</th>
        <th>Updated At</th>
        <th>Open</th>
      </tr>
    </thead>
    <tbody id="tbody">
      <tr><td colspan="7">Click "Load latest 50"</td></tr>
    </tbody>
  </table>

<script>
function esc(s) {
  return (s ?? "").toString()
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;");
}

async function load() {
  msg.textContent = "Loading...";
  const res = await fetch("/requisitions");
  const data = await res.json();

  if (!data.ok) {
    msg.textContent = "Failed: " + (data.error || "");
    tbody.innerHTML = "<tr><td colspan='7'>Error</td></tr>";
    return;
  }

  msg.textContent = "Loaded " + data.rows.length + " records";
  const rows = data.rows;

  if (rows.length === 0) {
    tbody.innerHTML = "<tr><td colspan='7'>No data</td></tr>";
    return;
  }

  tbody.innerHTML = rows.map(r => {
    const id = esc(r.id);
    const title = esc(r.title || "");
    const status = esc(r.status || "");
    const assigneeEmail = esc(r.assigneeEmail || "");
    const assigneeStatus = esc(r.assigneeStatus || "");
    const updatedAt = esc(r.updatedAt || "");
    return \`
      <tr>
        <td>\${id}</td>
        <td>\${title}</td>
        <td>\${status}</td>
        <td>\${assigneeEmail}</td>
        <td>\${assigneeStatus}</td>
        <td>\${updatedAt}</td>
        <td><a href="/portal" onclick="localStorage.setItem('reqId','\${id}')">Portal</a></td>
      </tr>
    \`;
  }).join("");
}

window.addEventListener("load", load);
</script>
</body>
</html>
  `);
});

// --------------------
// Firestore + Workflow trigger
// --------------------
app.post("/action", async (req, res) => {
  try {
    const {
      reqId,
      pendingAction,
      actionBy,
      actionReason,
      assigneeEmail,
      liftingPlanDriveFileId,
    } = req.body;

    if (!reqId || !pendingAction || !actionBy) {
      return res.status(400).json({
        error: "Missing required fields: reqId, pendingAction, actionBy",
      });
    }

    const ref = db.collection("requisitions").doc(reqId);

    const updateData = {
      pendingAction,
      actionBy,
      actionReason: actionReason || "",
      updatedAt: new Date(),
    };

    if (assigneeEmail !== undefined && assigneeEmail !== "") {
      updateData.assigneeEmail = assigneeEmail;
    }

    if (liftingPlanDriveFileId !== undefined && liftingPlanDriveFileId !== "") {
      updateData.liftingPlanDriveFileId = liftingPlanDriveFileId;
    }

    await ref.update(updateData);

    res.json({ ok: true, message: "Action sent to workflow" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error", details: String(e?.message || e) });
  }
});

// --------------------
const port = process.env.PORT || 8080;
app.listen(port, () => console.log("Listening on port", port));
