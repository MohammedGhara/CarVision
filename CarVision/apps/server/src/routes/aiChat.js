const express = require("express");
const router = express.Router();
const { chatOnce } = require("../services/ai");

const sessions = new Map();

router.post("/", express.json(), async (req, res) => {
  const { message } = req.body || {};
  if (!message) return res.status(400).json({ ok:false, error:"message required" });

  const key = req.ip || "anon";
  const history = sessions.get(key) || [];
  const system = { role: "system",
    content: "You are CarVision AI. Explain OBD-II codes and symptoms clearly and safely." };
  const messages = [system, ...history.slice(-16), { role:"user", content: message }];

  const out = await chatOnce(messages);
  if (!out.ok) return res.status(503).json(out);

  history.push({ role:"user", content: message });
  history.push({ role:"assistant", content: out.reply });
  sessions.set(key, history);

  res.json({ ok:true, reply: out.reply, model: out.model, usage: out.usage });
});

module.exports = router;
