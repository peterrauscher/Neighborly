const express = require("express");
const router = express.Router();

class AuthError extends Error {
  constructor(message, status) {
    super(`AuthError status code ${status || 400} | ${message}`);
    this.name = "AuthError";
    this.status = status || 400;
  }
}

router.get("/confirm-email", async (req, res) => {
  try {
    let token = req.query.token;
    let tokenId = req.query.tokenId;
    if (!token || !tokenId)
      throw new AuthError("Missing token or tokenId", 400);
    const realmApp = Realm.App.getApp("application-0-uqcbq");
    const result = await realmApp.emailPasswordAuth.confirmUser({
      token,
      tokenId,
    });
    return res.status(200).json(result);
  } catch (err) {
    return res.status(err.status || 400).json({ error: err.message });
  }
});

router.get("/reset-password", async (req, res) => {
  return res.status(200).json({ error: "Not impleneted" });
});

module.exports = router;
