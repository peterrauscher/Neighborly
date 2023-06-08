const userRoutes = require("./user");

module.exports = (app) => {
  app.use("/user", userRoutes);
  app.use("*", (req, res) =>
    res.status(404).json({ error: "Resource not found" })
  );
};
