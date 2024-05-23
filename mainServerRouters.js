const express = require("express");
const router = express.Router();
const mysql = require("mysql");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const crypto = require("crypto");

require("dotenv").config();

const { dbHost, dbPort, dbUser, dbPassword, dbName, jwtSecretKey, nodemailerUser, nodemailerPassword } = process.env;

const connectionInfo = {
  host: dbHost,
  port: dbPort,
  user: dbUser,
  password: dbPassword,
  database: dbName,
};

const connection = mysql.createConnection(connectionInfo); // DB 커넥션 생성
connection.connect(); // DB 접속

// nodemailer transporter 생성
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: nodemailerUser,
    pass: nodemailerPassword,
  },
  tls: { rejectUnauthorized: false },
});

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

  const token = req.headers.authorization;
  console.log("[mainServerRouters.js]check token : ", token);

  if (!token) {
    console.log("[mainServerRouters.js]no token");
    res.status(401).send();
    return false;
  }

  // Verify the token
  jwt.verify(token, jwtSecretKey, (err, decoded) => {
    if (err) {
      // Token verification failed
      console.log("[mainServerRouters.js]invalid token");
      res.status(401).send();
      return false;
    } else {
      console.log("[mainServerRouters.js]token verified.");
    }
  });
}

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
        res.status(500).send();
      } else {
        console.log("[mainServerRouters.js]results : ", results);
        if (results.length) {
          console.log("[mainServerRouters.js]found user account");

          let data = {
            token: generateJWT({
              email,
              password,
            }),
            U_Id: results[0].U_Id,
            U_Email: results[0].U_Email,
            U_Name: results[0].U_Name,
            U_ProfileImg: results[0].U_ProfileImg,
          };
          res.status(200).send({
            data: JSON.stringify(data),
          });
        } else {
          console.log("[mainServerRouters.js]user not found");
          res.status(404).send();
        }
      }
    });
  } catch (err) {
    console.error("Error executing query:", err);
    res.status(500).send();
  }
});

// 비밀번호 재발급
router.post("/app/users/reissuePassword", async (req, res) => {
  try {
    const params = req.body;
    console.log("\n[mainServerRouters.js]reissuePassword. params : ", params);
    const { email } = params;

    const query = `SELECT U_Id, U_Email, U_Password, U_Name, U_ProfileImg FROM USERS WHERE U_Email="${email}"`;
    connection.query(query, async function (err, results) {
      if (err) {
        console.log(err);
        res.status(500).send();
      } else {
        console.log("[mainServerRouters.js]results : ", results);
        if (results.length) {
          console.log("[mainServerRouters.js]found user account");

          const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
          let newPassword = "";
          const charactersLength = characters.length;
          for (let i = 0; i < 8; i++) {
            newPassword += characters.charAt(Math.floor(Math.random() * charactersLength));
          }

          const hash = crypto.createHash("sha256");
          hash.update(newPassword, "utf8");
          const encodedHash = hash.digest();

          let hashedPassword = "";
          for (let i = 0; i < encodedHash.length; i++) {
            const hex = encodedHash[i].toString(16);
            if (hex.length === 1) {
              hashedPassword += "0";
            }
            hashedPassword += hex;
          }

          console.log("[mainServerRouters.js]hashedPassword : ", hashedPassword);

          const updateQuery = `UPDATE MeetAnywhere.USERS SET U_Password='${hashedPassword}' WHERE U_Email='${email}';`;
          connection.query(updateQuery, async function (err, results) {
            if (err) {
              console.log(err);
              res.status(500).send();
            } else {
              console.log("[mainServerRouters.js]password updated");
              await transporter.sendMail({
                from: "MeetAnywhere<norelpy@meetanywhere.com>",
                to: email,
                subject: "MeetAnywhere 비밀번호 재발급",
                text: `임시 비밀번호가 발급되었습니다. \n ${newPassword}`,
              });

              res.status(200).send({
                data: "",
              });
            }
          });
        } else {
          console.log("[mainServerRouters.js]user not found");
          res.status(404).send();
        }
      }
    });
  } catch (err) {
    console.error("Error executing query:", err);
    res.status(500).send();
  }
});

// 이메일로 인증번호 보내기
router.post("/app/users/sendVerificationCode", async (req, res) => {
  try {
    const params = req.body;
    console.log("\n[mainServerRouters.js]sendVerificationCode. params : ", req.body);
    const { email } = params;

    let code = "";
    for (let i = 0; i < 6; i++) {
      code += Math.floor(Math.random() * 10);
    }

    await transporter.sendMail({
      from: "MeetAnywhere<norelpy@meetanywhere.com>",
      to: email,
      subject: "MeetAnywhere 인증번호 전송",
      text: `다음 인증번호를 입력해주세요. \n ${code}`,
    });

    res.status(200).send({
      data: code,
    });
  } catch (err) {
    console.error("Error executing query:", err);
    res.status(500).send();
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
        res.status(500).send();
      } else {
        console.log("[mainServerRouters.js]results : ", results);
        if (results.length) {
          console.log("[mainServerRouters.js]user already signed up.");
          res.status(400).send();
        } else {
          console.log("[mainServerRouters.js]user not found");

          const insertQuery = `INSERT INTO MeetAnywhere.USERS (U_Id, U_Email, U_Password, U_Name, U_ProfileImg) VALUES(0, '${email}', '${password}', '${name}', '');`;
          connection.query(insertQuery, function (err2, results2) {
            if (err2) {
              console.log(err2);
              res.status(500).send();
            } else {
              if (results2) {
                console.log("[mainServerRouters.js]signup done.");
                res.status(200).send({
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
    res.status(500).send();
  }
});

// 프로필 이미지 변경하기
router.post("/app/users/editProfileImg", async (req, res) => {
  try {
    verifyJWT(req, res);
    const params = req.body;
    console.log("\n[mainServerRouters.js]editProfileImg. params : ", params);
    const { userId, imageFileString } = params;

    const query = `UPDATE MeetAnywhere.USERS SET U_ProfileImg='${imageFileString}' WHERE U_Id=${userId};`;
    connection.query(query, function (err, results) {
      if (err) {
        console.log(err);
        res.status(500).send();
      } else {
        console.log("[mainServerRouters.js]edit profileImg done.");
        res.status(200).send({
          data: imageFileString,
        });
      }
    });
  } catch (err) {
    console.error("Error executing query:", err);
    res.status(500).send();
  }
});

// 계정 삭제하기
router.post("/app/users/deleteAccount", async (req, res) => {
  try {
    verifyJWT(req, res);
    const params = req.body;
    console.log("\n[mainServerRouters.js]deleteAccount. params : ", params);
    const { userId } = params;

    const query = `DELETE FROM USERS WHERE U_Id="${userId}"`;
    connection.query(query, function (err, results) {
      if (err) {
        console.log(err);
        res.status(500).send();
      } else {
        console.log("[mainServerRouters.js]user account deleted");
        res.status(200).send({
          data: "",
        });
      }
    });
  } catch (err) {
    console.error("Error executing query:", err);
    res.status(500).send();
  }
});

// 이름 변경
router.post("/app/users/updateName", async (req, res) => {
  try {
    verifyJWT(req, res);
    const params = req.body;
    console.log("\n[mainServerRouters.js]updateName. params : ", params);
    const { userId, name } = params;

    const query = `UPDATE MeetAnywhere.USERS SET U_Name='${name}' WHERE U_Id=${userId};`;
    connection.query(query, function (err, results) {
      if (err) {
        console.log(err);
        res.status(500).send();
      } else {
        console.log("[mainServerRouters.js]username updated");
        res.status(200).send({
          data: "",
        });
      }
    });
  } catch (err) {
    console.error("Error executing query:", err);
    res.status(500).send();
  }
});

// 비밀번호 변경
router.post("/app/users/updatePassword", async (req, res) => {
  try {
    verifyJWT(req, res);
    const params = req.body;
    console.log("\n[mainServerRouters.js]updatePassword. params : ", params);
    const { userId, prevPassword, newPassword } = params;

    const query = `SELECT U_Id, U_Email, U_Password, U_Name, U_ProfileImg FROM USERS WHERE U_Id="${userId} and U_Password=${prevPassword}"`;
    connection.query(query, function (err, results) {
      if (err) {
        console.log(err);
        res.status(500).send();
      } else {
        console.log("[mainServerRouters.js]results : ", results);
        if (results.length) {
          console.log("[mainServerRouters.js]found user account");

          const updateQuery = `UPDATE MeetAnywhere.USERS SET U_Password='${newPassword}' WHERE U_Id=${userId};`;
          connection.query(updateQuery, function (err, results) {
            if (err) {
              console.log(err);
              res.status(500).send();
            } else {
              console.log("[mainServerRouters.js]password updated");
              res.status(200).send({
                data: "",
              });
            }
          });
        } else {
          console.log("[mainServerRouters.js]user not found");
          res.status(404).send();
        }
      }
    });
  } catch (err) {
    console.error("Error executing query:", err);
    res.status(500).send();
  }
});

// 새 회의 생성하기
router.post("/app/conference/createConferenceData", async (req, res) => {
  try {
    verifyJWT(req, res);
    const params = req.body;
    console.log("\n[mainServerRouters.js]createConferenceData. params : ", params);
    const { conferenceId, password } = params;

    const query = `INSERT INTO CONFERENCES (C_Id, C_ConferenceId, C_ConferencePassword) VALUES(0, '${conferenceId}', '${password}');`;
    connection.query(query, function (err, results) {
      if (err) {
        console.log(err);
        res.status(500).send();
      } else {
        console.log("[mainServerRouters.js]results : ", results);
        console.log("[mainServerRouters.js]conference created.");
        res.status(200).send({
          data: "",
        });
      }
    });
  } catch (err) {
    console.error("Error executing query:", err);
    res.status(500).send();
  }
});

// 회의 종료 후 데이터 삭제
router.post("/app/conference/deleteConferenceData", async (req, res) => {
  try {
    verifyJWT(req, res);
    const params = req.body;
    console.log("\n[mainServerRouters.js]deleteConferenceData. params : ", params);
    const { conferenceId } = params;

    const query = `DELETE FROM CONFERENCES WHERE C_ConferenceId="${conferenceId}";`;
    connection.query(query, function (err, results) {
      if (err) {
        console.log(err);
        res.status(500).send();
      } else {
        console.log("[mainServerRouters.js]results : ", results);
        console.log("[mainServerRouters.js]conference deleted.");
        res.status(200).send({
          data: "",
        });
      }
    });
  } catch (err) {
    console.error("Error executing query:", err);
    res.status(500).send();
  }
});

// 회의 ID 확인하기
router.post("/app/conference/checkConferenceId", async (req, res) => {
  try {
    verifyJWT(req, res);
    const params = req.body;
    console.log("\n[mainServerRouters.js]checkConferenceId. params : ", params);
    const { conferenceId } = params;

    const query = `SELECT C_Id, C_ConferenceId, C_ConferencePassword FROM CONFERENCES WHERE C_ConferenceId="${conferenceId}";`;
    connection.query(query, function (err, results) {
      if (err) {
        console.log(err);
        res.status(500).send();
      } else {
        console.log("[mainServerRouters.js]results : ", results);
        if (results.length) {
          console.log("[mainServerRouters.js]conference id is valid");
          res.status(200).send({
            data: "",
          });
        } else {
          console.log("[mainServerRouters.js]invalid conference id ");
          res.status(404).send();
        }
      }
    });
  } catch (err) {
    console.error("Error executing query:", err);
    res.status(500).send();
  }
});

// 회의 비밀번호 확인하기
router.post("/app/users/checkConferencePassword", async (req, res) => {
  try {
    verifyJWT(req, res);
    const params = req.body;
    console.log("\n[mainServerRouters.js]checkConferencePassword. params : ", params);
    const { conferenceId, password } = params;

    const query = `SELECT C_Id, C_ConferenceId, C_ConferencePassword FROM CONFERENCES WHERE C_ConferenceId="${conferenceId}" AND C_ConferencePassword="${password}";`;
    connection.query(query, function (err, results) {
      if (err) {
        console.log(err);
        res.status(500).send();
      } else {
        console.log("[mainServerRouters.js]results : ", results);
        if (results.length) {
          console.log("[mainServerRouters.js]conference password is valid");
          res.status(200).send({
            data: "",
          });
        } else {
          console.log("[mainServerRouters.js]invalid conference password ");
          res.status(404).send();
        }
      }
    });
  } catch (err) {
    console.error("Error executing query:", err);
    res.status(500).send();
  }
});

module.exports = { mainServerRouter: router };
