const express = require("express");
const http = require("http");

const bodyParser = require("body-parser");
const { mainServerRouter } = require("./mainServerRouters.js");
const { runSignalingServer } = require("./socketServer.js");
require("dotenv").config();

const { port } = process.env;

const app = express();

// options when using https
// const options = {
//   key: "./sslKey.pem",
//   cert: "./sslCert.pem",
// };

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use("/", mainServerRouter);

const httpServer = http.createServer(app);

httpServer.listen(port, () => {
  console.log(`[app.js]Server running at http://localhost:${port}`);
});

runSignalingServer(httpServer);
