const express = require("express");
const cors = require("cors");

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: "DAO backend running" });
});

app.get("/proposals", (req, res) => {
  res.json({ message: "DAO backend running" });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
