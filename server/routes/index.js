const userRoutes = require("./user");
const postRoutes = require("./post");

module.exports = (app) => {
  app.use("/user", userRoutes);
  app.use("/posts", postRoutes);
  app.use("*", (req, res) =>
    res.status(404).json({ error: "Resource not found" })
  );
};
