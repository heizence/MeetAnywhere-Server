const express = require("express");
const http = require("http"); // for test on local

const bodyParser = require("body-parser");
const { mainServerRouter } = require("./mainServerRouters.js");

require("dotenv").config();

const { port } = process.env;

const app = express();

app.use(bodyParser.json());
// Register the route
app.use("/", mainServerRouter);

// Create server
http.createServer(options, app).listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
