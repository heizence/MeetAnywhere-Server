const express = require("express");
const router = express.Router();
const mysql = require("mysql");
const jwt = require("jsonwebtoken");

require("dotenv").config();

const { dbHost, dbPort, dbUser, dbPassword, dbName, jwtSecretKey } = process.env;

const connectionInfo = {
  host: dbHost,
  port: dbPort,
  user: dbUser,
  password: dbPassword,
  database: dbName,
};

const connection = mysql.createConnection(connectionInfo); // DB 커넥션 생성
connection.connect(); // DB 접속

// jwt 생성
function generateJWT(user) {
  const payload = {
    email: user.email,
    password: user.password,
  };
  // Generate JWT token with the payload and secret key
  const token = jwt.sign(payload, process.env.jwtSecretKey, {
    expiresIn: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365,
  }); // Expires after 1 year
  return token;
}

// jwt 검증
function verifyJWT(req, res) {
  console.log("\n[mainServerRouters.js]verifyJWT");
  // Get the token from the request headers
  const token = req.headers.authorization;
  console.log("[mainServerRouters.js]check token : ", token);
  // Check if token is provided
  if (!token) {
    console.log("[mainServerRouters.js]no token");
    res.send({
      statusCode: 401,
      data: "",
    });

    return false;
  }

  // Verify the token
  jwt.verify(token, jwtSecretKey, (err, decoded) => {
    if (err) {
      // Token verification failed
      console.log("[mainServerRouters.js]invalid token");
      res.send({
        statusCode: 401,
        data: "",
      });
      return false;
    } else {
      console.log("[mainServerRouters.js]token verified.");
      return true;
    }
  });
}

// Define a simple route
router.get("/", (req, res) => {
  res.send("Hello world!");
});

// 로그인
router.post("/app/users/signin", async (req, res) => {
  try {
    const params = req.body;
    console.log("\n[mainServerRouters.js]signin. params : ", params);
    const { email, password } = params;

    const query = `SELECT U_Id, U_Email, U_Password, U_Name, U_ProfileImg FROM USERS WHERE U_Email="${email}" and U_Password="${password}"`;
    connection.query(query, function (err, results) {
      if (err) {
        console.log(err);
        res.send({
          statusCode: 500,
          data: "",
        });
      } else {
        console.log("[mainServerRouters.js]results : ", results);
        if (results.length) {
          console.log("[mainServerRouters.js]found user account");
          res.send({
            statusCode: 200,
            data: {
              token: generateJWT({
                email,
                password,
              }),
              U_Id: results[0].U_Id,
              U_Email: results[0].U_Email,
              U_Name: results[0].U_Name,
              U_ProfileImg: results[0].U_ProfileImg,
            },
          });
        } else {
          console.log("[mainServerRouters.js]user not found");
          res.send({
            statusCode: 404,
            data: "",
          });
        }
      }
    });
  } catch (err) {
    console.error("Error executing query:", err);
    res.send({
      statusCode: 500,
      data: "",
    });
  }
});

// 비밀번호 재발급
router.post("/app/users/reissuePassword", async (req, res) => {
  try {
    const params = req.body;
    console.log("\n[mainServerRouters.js]reissuePassword. params : ", params);
    const { email } = params;

    const query = `SELECT U_Id, U_Email, U_Password, U_Name, U_ProfileImg FROM USERS WHERE U_Email="${email}"`;
    connection.query(query, function (err, results) {
      if (err) {
        console.log(err);
        res.send({
          statusCode: 500,
          data: "",
        });
      } else {
        console.log("[mainServerRouters.js]results : ", results);
        if (results.length) {
          console.log("[mainServerRouters.js]found user account");
          res.send({
            statusCode: 200,
            data: "",
          });
        } else {
          console.log("[mainServerRouters.js]user not found");
          res.send({
            statusCode: 404,
            data: "",
          });
        }
      }
    });
  } catch (err) {
    console.error("Error executing query:", err);
    res.send({
      statusCode: 500,
      data: "",
    });
  }
});

// 이메일로 인증번호 보내기
router.post("/app/users/sendVerificationCode", async (req, res) => {
  try {
    const params = req.body;
    console.log("\n[mainServerRouters.js]sendVerificationCode. params : ", params);
    const { email } = params;

    const query = `SELECT U_Id, U_Email, U_Password, U_Name, U_ProfileImg FROM USERS WHERE U_Email="${email}"`;
    connection.query(query, function (err, results) {
      if (err) {
        console.log(err);
        res.send({
          statusCode: 500,
          data: "",
        });
      } else {
        console.log("[mainServerRouters.js]results : ", results);
        if (results.length) {
          console.log("[mainServerRouters.js]found user account");
          res.send({
            statusCode: 200,
            data: "verification code", // mailgun 연동
          });
        } else {
          console.log("[mainServerRouters.js]user not found");
          res.send({
            statusCode: 404,
            data: "",
          });
        }
      }
    });
  } catch (err) {
    console.error("Error executing query:", err);
    res.send({
      statusCode: 500,
      data: "",
    });
  }
});

// 회원가입
router.post("/app/users/signup", async (req, res) => {
  try {
    const params = req.body;
    console.log("\n[mainServerRouters.js]signup. params : ", params);
    const { email, password, name } = params;

    const query = `SELECT U_Id, U_Email, U_Password, U_Name, U_ProfileImg FROM USERS WHERE U_Email="${email}" and U_Password="${password}"`;
    connection.query(query, function (err, results) {
      if (err) {
        console.log(err);
        res.send({
          statusCode: 500,
          data: "",
        });
      } else {
        console.log("[mainServerRouters.js]results : ", results);
        if (results.length) {
          console.log("[mainServerRouters.js]user already signed up.");
          res.send({
            statusCode: 400,
            data: "",
          });
        } else {
          console.log("[mainServerRouters.js]user not found");

          const insertQuery = `INSERT INTO MeetAnywhere.USERS (U_Id, U_Email, U_Password, U_Name, U_ProfileImg) VALUES(0, '${email}', '${password}', '${name}', '');`;
          connection.query(insertQuery, function (err2, results2) {
            if (err2) {
              console.log(err2);
              res.send({
                statusCode: 500,
                data: "",
              });
            } else {
              if (results2) {
                console.log("[mainServerRouters.js]signup done.");
                res.send({
                  statusCode: 200,
                  data: "",
                });
              }
            }
          });
        }
      }
    });
  } catch (err) {
    console.error("Error executing query:", err);
    res.send({
      statusCode: 500,
      data: "",
    });
  }
});

// 프로필 이미지 변경하기
router.post("/app/users/editProfileImg", async (req, res) => {
  try {
    if (!verifyJWT(req, res)) return;

    const params = req.body;
    console.log("\n[mainServerRouters.js]editProfileImg. params : ", params);
    const { userId, imageFileString } = params;

    const query = `UPDATE MeetAnywhere.USERS SET U_ProfileImg='${imageFileString}' WHERE U_Id=${userId};`;
    connection.query(query, function (err, results) {
      if (err) {
        console.log(err);
        res.send({
          statusCode: 500,
          data: "",
        });
      } else {
        console.log("[mainServerRouters.js]results : ", results);
        if (results.length) {
          console.log("[mainServerRouters.js]edit profileImg done.");
          res.send({
            statusCode: 200,
            data: results[0].U_ProfileImg,
          });
        } else {
          console.log("[mainServerRouters.js]update failed");
          res.send({
            statusCode: 500,
            data: "",
          });
        }
      }
    });
  } catch (err) {
    console.error("Error executing query:", err);
    res.send({
      statusCode: 500,
      data: "",
    });
  }
});

// 계정 삭제하기
router.post("/app/users/deleteAccount", async (req, res) => {
  try {
    if (!verifyJWT(req, res)) return;

    const params = req.body;
    console.log("\n[mainServerRouters.js]deleteAccount. params : ", params);
    const { userId } = params;

    const query = `DELETE FROM USERS WHERE U_Id="${userId}"`;
    connection.query(query, function (err, results) {
      if (err) {
        console.log(err);
        res.send({
          statusCode: 500,
          data: "",
        });
      } else {
        console.log("[mainServerRouters.js]results : ", results);
        if (results.length) {
          console.log("[mainServerRouters.js]user account deleted");
          res.send({
            statusCode: 200,
            data: "",
          });
        } else {
          console.log("[mainServerRouters.js]user not found");
          res.send({
            statusCode: 404,
            data: "",
          });
        }
      }
    });
  } catch (err) {
    console.error("Error executing query:", err);
    res.send({
      statusCode: 500,
      data: "",
    });
  }
});

// 이름 변경
router.post("/app/users/updateName", async (req, res) => {
  try {
    if (!verifyJWT(req, res)) return;

    const params = req.body;
    console.log("\n[mainServerRouters.js]updateName. params : ", params);
    const { userId, name } = params;

    const query = `UPDATE MeetAnywhere.USERS SET U_Name='${name}' WHERE U_Id=${userId};`;
    connection.query(query, function (err, results) {
      if (err) {
        console.log(err);
        res.send({
          statusCode: 500,
          data: "",
        });
      } else {
        console.log("[mainServerRouters.js]results : ", results);
        if (results.length) {
          console.log("[mainServerRouters.js]username updated");
          res.send({
            statusCode: 200,
            data: "",
          });
        } else {
          console.log("[mainServerRouters.js]update failed");
          res.send({
            statusCode: 404,
            data: "",
          });
        }
      }
    });
  } catch (err) {
    console.error("Error executing query:", err);
    res.send({
      statusCode: 500,
      data: "",
    });
  }
});

// 비밀번호 변경
router.post("/app/users/updatePassword", async (req, res) => {
  try {
    if (!verifyJWT(req, res)) return;
    const params = req.body;
    console.log("\n[mainServerRouters.js]updatePassword. params : ", params);
    const { userId, prevPassword, newPassword } = params;

    const query = `SELECT U_Id, U_Email, U_Password, U_Name, U_ProfileImg FROM USERS WHERE U_Id="${userId} and U_Password=${prevPassword}"`;
    connection.query(query, function (err, results) {
      if (err) {
        console.log(err);
        res.send({
          statusCode: 500,
          data: "",
        });
      } else {
        console.log("[mainServerRouters.js]results : ", results);
        if (results.length) {
          console.log("[mainServerRouters.js]found user account");

          const updateQuery = `UPDATE MeetAnywhere.USERS SET U_Password='${newPassword}' WHERE U_Id=${userId};`;
          connection.query(updateQuery, function (err, results) {
            if (err) {
              console.log(err);
              res.send({
                statusCode: 500,
                data: "",
              });
            } else {
              console.log("[mainServerRouters.js]results : ", results);
              if (results.length) {
                console.log("[mainServerRouters.js]password updated");
                res.send({
                  statusCode: 200,
                  data: "",
                });
              } else {
                console.log("[mainServerRouters.js]update failed");
                res.send({
                  statusCode: 404,
                  data: "",
                });
              }
            }
          });
        } else {
          console.log("[mainServerRouters.js]user not found");
          res.send({
            statusCode: 404,
            data: "",
          });
        }
      }
    });
  } catch (err) {
    console.error("Error executing query:", err);
    res.send({
      statusCode: 500,
      data: "",
    });
  }
});

// 새 회의 생성하기
router.post("/app/users/createConferenceData", async (req, res) => {
  try {
    if (!verifyJWT(req, res)) return;
    const params = req.body;
    console.log("\n[mainServerRouters.js]createConferenceData. params : ", params);
    const { conferenceId, password } = params;

    const query = `INSERT INTO CONFERENCES (C_Id, C_ConferenceId, C_ConferencePassword) VALUES(0, '${conferenceId}', '${password}');`;
    connection.query(query, function (err, results) {
      if (err) {
        console.log(err);
        res.send({
          statusCode: 500,
          data: "",
        });
      } else {
        console.log("[mainServerRouters.js]results : ", results);
        console.log("[mainServerRouters.js]conference created.");
        res.send({
          statusCode: 200,
          data: "",
        });
      }
    });
  } catch (err) {
    console.error("Error executing query:", err);
    res.send({
      statusCode: 500,
      data: "",
    });
  }
});

// 회의 종료 후 데이터 삭제
router.post("/app/users/deleteConferenceData", async (req, res) => {
  try {
    if (!verifyJWT(req, res)) return;
    const params = req.body;
    console.log("\n[mainServerRouters.js]deleteConferenceData. params : ", params);
    const { conferenceId } = params;

    const query = `DELETE FROM CONFERENCES WHERE C_ConferenceId="${conferenceId}";`;
    connection.query(query, function (err, results) {
      if (err) {
        console.log(err);
        res.send({
          statusCode: 500,
          data: "",
        });
      } else {
        console.log("[mainServerRouters.js]results : ", results);
        console.log("[mainServerRouters.js]conference deleted.");
        res.send({
          statusCode: 200,
          data: "",
        });
      }
    });
  } catch (err) {
    console.error("Error executing query:", err);
    res.send({
      statusCode: 500,
      data: "",
    });
  }
});

// 회의 ID 확인하기
router.post("/app/users/checkConferenceId", async (req, res) => {
  try {
    if (!verifyJWT(req, res)) return;
    const params = req.body;
    console.log("\n[mainServerRouters.js]checkConferenceId. params : ", params);
    const { conferenceId } = params;

    const query = `SELECT C_Id, C_ConferenceId, C_ConferencePassword FROM CONFERENCES WHERE C_ConferenceId="${conferenceId}";`;
    connection.query(query, function (err, results) {
      if (err) {
        console.log(err);
        res.send({
          statusCode: 500,
          data: "",
        });
      } else {
        console.log("[mainServerRouters.js]results : ", results);
        if (results.length) {
          console.log("[mainServerRouters.js]conference id is valid");
          res.send({
            statusCode: 200,
            data: "",
          });
        } else {
          console.log("[mainServerRouters.js]invalid conference id ");
          res.send({
            statusCode: 404,
            data: "",
          });
        }
      }
    });
  } catch (err) {
    console.error("Error executing query:", err);
    res.send({
      statusCode: 500,
      data: "",
    });
  }
});

// 회의 비밀번호 확인하기
router.post("/app/users/checkConferencePassword", async (req, res) => {
  try {
    if (!verifyJWT(req, res)) return;
    const params = req.body;
    console.log("\n[mainServerRouters.js]checkConferencePassword. params : ", params);
    const { conferenceId, password } = params;

    const query = `SELECT C_Id, C_ConferenceId, C_ConferencePassword FROM CONFERENCES WHERE C_ConferenceId="${conferenceId}" AND C_ConferencePassword="${password}";`;
    connection.query(query, function (err, results) {
      if (err) {
        console.log(err);
        res.send({
          statusCode: 500,
          data: "",
        });
      } else {
        console.log("[mainServerRouters.js]results : ", results);
        if (results.length) {
          console.log("[mainServerRouters.js]conference password is valid");
          res.send({
            statusCode: 200,
            data: "",
          });
        } else {
          console.log("[mainServerRouters.js]invalid conference password ");
          res.send({
            statusCode: 404,
            data: "",
          });
        }
      }
    });
  } catch (err) {
    console.error("Error executing query:", err);
    res.send({
      statusCode: 500,
      data: "",
    });
  }
});

module.exports = { mainServerRouter: router };
