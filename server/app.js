const Realm = require("realm");
const realmApp = new Realm.App({ id: "application-0-uqcbq" });
const express = require("express");
const cors = require("cors");
const compression = require("compression");
const app = express();

app.use(cors());
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const configRoutes = require("./routes");
configRoutes(app);

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}...`);
});
