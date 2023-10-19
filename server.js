/*
webRTC 에서 peer 간 연결을 위한 signaling 서버
node.js 및 socket io 를 사용함.
Android client 에서도 연결이 되도록 설계
*/

const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");
const { v4 } = require("uuid");

// Signaling 서버(본 서버)가 실행되는 port number
// constants.js 파일에 Port_number 로 정의된 변수값과 일치해야 함. 반드시 확인하기.
const Port_number = 8082;

const app = express();
app.use(express.static("public"));
const httpServer = createServer(app);

httpServer.listen(Port_number, () => {
  console.log("\n#[server.js] started at port", Port_number, "\n", getTime());
});

// 시간 생성
function getTime() {
  const now = new Date();
  const hours = now.getHours().toString().padStart(2, "0");
  const minutes = now.getMinutes().toString().padStart(2, "0");
  const seconds = now.getSeconds().toString().padStart(2, "0");
  const milliseconds = now.getMilliseconds().toString().padStart(3, "0");
  return `${hours}:${minutes}:${seconds}:${milliseconds}`;
}

// 회의 ID 생성(11자리 숫자)
function generateConferenceId() {
  // Generate a random number between 0 and 1 (exclusive of 1).
  const randomFraction = Math.random();

  // Multiply the random fraction by 1e11 (10^11) to get an 11-digit number.
  const randomNumber = Math.floor(randomFraction * 1e11);

  return randomNumber.toString().padStart(11, "0");
}

// 회의 암호 생성
function generateConferencePassword() {
  const characters = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  const stringLength = 6;
  let randomString = "";

  for (let i = 0; i < stringLength; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    randomString += characters.charAt(randomIndex);
  }

  return randomString;
}

app.get("/constants.js", (req, res) => {
  res.setHeader("Content-Type", "application/javascript"); // Set MIME type to JavaScript
  res.sendFile(__dirname + "/constants.js");
});

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/signin.html");
});

app.get("/main", (req, res) => {
  res.sendFile(__dirname + "/main.html");
});

app.get("/startLive", (req, res) => {
  res.sendFile(__dirname + "/start_live.html");
});

app.get("/rooms", (req, res) => {
  res.sendFile(__dirname + "/enter_room.html");
});

app.get("/live/participant/:id", (req, res) => {
  res.sendFile(__dirname + "/live_watcher.html");
});

app.get("/live/host/:id", (req, res) => {
  res.sendFile(__dirname + "/live_host.html");
});

app.get("/watch_vod/:id", (req, res) => {
  res.sendFile(__dirname + "/watch_vod.html");
});

// For image rendering. Do not delete!
//app.use("/live/image_files", express.static(__dirname + "/image_files"));
app.use("/get/image_files", express.static(__dirname + "/image_files"));

// 회의실 목록 객체
let conferenceListObj = {};

// 각 회의실 참석자 수
// conferenceId : (숫자) 형식으로 저장
let numberOfParticipantsForEachRoom = {};

// io 생성
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// 현재 접속 되어 있는 클라이언트로부터 메시지를 받을기 위해 사용
io.on("connection", (socket) => {
  console.log("\n#[server.js] connection", "\n", getTime());
  console.log("\n#socket query info : ", { ...socket.handshake.query, socketId: socket.id }, "\n", getTime());

  let conferenceId = socket.handshake.query.conferenceId; // 회의실 식별을 위한 고유 id
  const userName = socket.handshake.query.userName;

  let peerConnectionID; // client 에서 RTCPeerConnection 객체를 구분해 줄 고유 ID

  // 호스트가 회의실 생성하기
  socket.on("create new conference", () => {
    console.log("\n#[server.js] create new conference", "\n", getTime());
    conferenceId = generateConferenceId();
    socket.join(conferenceId); // 회의실 생성 및 입장은 conferenceId 를 통해서 하기. 이름이 중복되는 경우가 있음.

    let conferencePassword = generateConferencePassword();
    conferenceListObj[conferenceId] = {
      hostSocketId: socket.id,
      conferencePassword,
    };

    numberOfParticipantsForEachRoom[conferenceId] = 0; // 참석자 수 설정.
    console.log("conference ID : ", conferenceId);
    // 회의실 생성 완료

    io.to(conferenceId).emit("conference created", {
      hostSocketId: socket.id,
      conferenceId: conferenceId,
      conferencePassword,
    });

    console.log("\n#[server.js] check conferenceListObj : ", conferenceListObj, "\n", getTime());
  });

  // 회의 참석 요청하기
  socket.on("request join", () => {
    console.log("\n#[server.js] request join", "\n", getTime());
    const participantName = socket.handshake.query.userName;
    socket.join(conferenceId); // 방송방 생성 및 입장은 conferenceId 를 통해서 하기. 이름이 중복되는 경우가 있음.

    peerConnectionID = v4(); // 신규 참석자가 peerConnectionID 를 생성(기존 참석자는 해당 없음)
    console.log("\n# check peerConnectionID : ", peerConnectionID);

    numberOfParticipantsForEachRoom[conferenceId] += 1; // 참석자 수 갱신.
    console.log("\n#[server.js] numberOfParticipants : ", numberOfParticipantsForEachRoom[conferenceId]);

    io.to(conferenceId).emit("participant joined", {
      participantName,
      participantSocketId: socket.id,
      hostSocketId: conferenceListObj[conferenceId].hostSocketId,
      peerConnectionID, // 호스트에게 전달
      numberOfParticipants: numberOfParticipantsForEachRoom[conferenceId],
    });
  });

  // 참석자 또는 호스트가 채팅 입력 시 채팅 내용 전송해 주기
  socket.on("new chat message", (data) => {
    console.log("\n#[server.js] new chat message : ", data, "\n", getTime());

    io.to(conferenceId).emit("new chat message", {
      senderUserId: data.senderUserId,
      senderProfileImg: data.senderProfileImg,
      senderName: userName,
      chatMessageContents: data.chatMessageContents,
    });
  });

  // 호스트가 offer 보낸 후 참석자에게 offer 보내기
  socket.on("offer", (data) => {
    console.log("\n#[server.js] offer : ", data, "\n", getTime());
    peerConnectionID = data.peerConnectionID; // offer 를 보내는 주체인 host 는 peerConnectionID 를 서버에서 생성하지 않고 local 에서 생성함.
    console.log("\n# check peerConnectionID : ", peerConnectionID);
    io.to(data.to).emit("offer", {
      ...data,
      peerConnectionID,
    });
  });

  // 참석자가 호스트에게 offer 받고 answer 보냈을 때 처리
  socket.on("answer", (data) => {
    console.log("\n#[server.js] answer : ", data, "\n", getTime());
    console.log("\n# check peerConnectionID : ", peerConnectionID);
    io.to(data.to).emit("answer", {
      ...data,
      peerConnectionID,
    });
  });

  socket.on("iceCandidate", (data) => {
    console.log("\n#[server.js] iceCandidate : ", data, "\n", getTime());
    io.to(data.to).emit("iceCandidate", {
      ...data,
      peerConnectionID,
    });
  });

  // 특정 참석자가 채팅방에서 나갈때
  // disconnecting 이벤트가 먼저 발생하고 disconnect 이벤트가 발생함
  socket.on("disconnect", () => {
    const userName = socket.handshake.query.userName;
    console.log("\n#[server.js] socket disconnect : ", userName, "\n", getTime());
    console.log("#[server.js] socket id : ", socket.id, "\n", getTime());

    numberOfParticipantsForEachRoom[conferenceId] -= 1; // 참석자 수 갱신.
    console.log("\n#[server.js] numberOfParticipants : ", numberOfParticipantsForEachRoom[conferenceId]);
    io.to(conferenceId).emit("participant left", {
      participantName: userName,
      participantSocketId: socket.id,
      peerConnectionID,
      numberOfParticipants: numberOfParticipantsForEachRoom[conferenceId],
    });
  });

  // 참석자가 방송방에서 퇴장했을 때
  socket.on("participant left", () => {
    console.log("\n#[server.js] participant left", "\n", getTime());
    console.log("#[server.js] participant name : ", userName);
    console.log("#[server.js] participant socket id : ", socket.id);

    numberOfParticipantsForEachRoom[conferenceId] -= 1; // 참석자 수 갱신.
    console.log("\n#[server.js] numberOfParticipants : ", numberOfParticipantsForEachRoom[conferenceId]);
    io.to(conferenceId).emit("participant left", {
      participantName: userName,
      participantSocketId: socket.id,
      peerConnectionID,
      numberOfParticipants: numberOfParticipantsForEachRoom[conferenceId],
    });
  });

  // 호스트가 회의 전체 종료했을 때
  socket.on("end conference", () => {
    console.log("\n#[server.js] end conference", "\n", getTime());
    console.log("#[server.js] host name : ", userName, "\n", getTime());
    console.log("#[server.js] host socket id : ", socket.id, "\n", getTime());
    console.log("#[server.js] conferenceId : ", conferenceId, "\n", getTime());

    delete conferenceListObj[conferenceId];
    delete numberOfParticipantsForEachRoom[conferenceId];
    io.to(conferenceId).emit("end conference");
  });

  // 호스트가 혼자만 회의에서 나갔을 때
  socket.on("host left", (data) => {
    console.log("\n#[server.js] host left", "\n", getTime());
    console.log("#[server.js] host name : ", userName, "\n", getTime());
    console.log("#[server.js] host socket id : ", socket.id, "\n", getTime());
    console.log("#[server.js] data : ", data, "\n", getTime());

    numberOfParticipantsForEachRoom[conferenceId] -= 1; // 참석자 수 갱신.
    console.log("\n#[server.js] numberOfParticipants : ", numberOfParticipantsForEachRoom[conferenceId]);

    io.to(conferenceId).emit("host left", {
      newHost: "", // 새로운 호스트 지정해 주기
    });
  });
});

io.on("disconnect", (socket) => {
  console.log("\n#[server.js] socket disconnected!", "\n", getTime());
});
