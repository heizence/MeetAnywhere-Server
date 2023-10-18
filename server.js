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
const Port_number = 8080;

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

app.get("/live/watcher/:id", (req, res) => {
  res.sendFile(__dirname + "/live_watcher.html");
});

app.get("/live/streamer/:id", (req, res) => {
  res.sendFile(__dirname + "/live_streamer.html");
});

app.get("/watch_vod/:id", (req, res) => {
  res.sendFile(__dirname + "/watch_vod.html");
});

// For image rendering. Do not delete!
//app.use("/live/image_files", express.static(__dirname + "/image_files"));
app.use("/get/image_files", express.static(__dirname + "/image_files"));

// 라이브 방송방 목록 객체
let roomListObj = {};

// 각 라이브 방송방 시청자 수
// roomId : (숫자) 형식으로 저장
let numberOfWatchersForEachRoom = {};

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

  const isStreamer = socket.handshake.query.isStreamer;
  const roomName = socket.handshake.query.roomName;
  const roomId = socket.handshake.query.roomId; // 방송방 식별을 위한 고유 id
  const userName = socket.handshake.query.userName;

  let peerConnectionID; // client 에서 RTCPeerConnection 객체를 구분해 줄 고유 ID

  // 로컬 비디오 스트림이 화면에 표시됨. 가장 첫 번째로 발생하는 이벤트
  socket.on("ready", () => {
    console.log("\n#[server.js] ready", "\n", getTime());

    // room 이 존재하는 경우(방송이 진행중인 경우)

    socket.join(roomId); // 방송방 생성 및 입장은 roomId 를 통해서 하기. 이름이 중복되는 경우가 있음.
    // 스트리머일 경우 "Streamer start live" 이벤트 발생, 시청자일 경우 "Watcher join" 이벤트 발생
    if (isStreamer === "true") {
      console.log("\n#[server.js] Streamer start live", "\n", getTime());

      roomListObj[roomName] = {
        streamerSocketId: socket.id,
        roomId: roomId,
      };

      numberOfWatchersForEachRoom[roomId] = 0; // 시청자 수 설정.

      roomListObj[roomName] = {
        streamerSocketId: socket.id,
        roomId: roomId,
      };

      // socket 에서 room 생성 후 DB 에 방송 정보 저장을 위해 roomId 보내주기. 스트리머만 해당.
      io.to(roomId).emit("streamer start live", {
        streamerSocketId: socket.id,
        roomId,
      });
    } else {
      console.log("\n#[server.js] watcher join", "\n", getTime());
      const watcherName = socket.handshake.query.userName;

      peerConnectionID = v4(); // 신규 시청자가 peerConnectionID 를 생성(기존 시청자는 해당 없음)
      console.log("\n# check peerConnectionID : ", peerConnectionID);

      numberOfWatchersForEachRoom[roomId] += 1; // 시청자 수 갱신.
      console.log("\n#[server.js] numberOfWatchers : ", numberOfWatchersForEachRoom[roomId]);

      io.to(roomId).emit("watcher join", {
        watcherName,
        watcherSocketId: socket.id,
        streamerSocketId: roomListObj[roomName].streamerSocketId,
        peerConnectionID, // 스트리머에게 전달
        numberOfWatchers: numberOfWatchersForEachRoom[roomId],
      });
    }
  });

  // 시청자 또는 스트리머가 채팅 입력 시 채팅 내용 전송해 주기
  socket.on("chat message", (data) => {
    console.log("\n#[server.js] chat message : ", data, "\n", getTime());

    io.to(roomId).emit("chat message", {
      senderUserId: data.senderUserId,
      senderProfileImg: data.senderProfileImg,
      senderName: userName,
      chatMessageContents: data.chatMessageContents,
    });
  });

  // 스트리머가 offer 보낸 후 시청자에게 offer 보내기
  socket.on("offer", (data) => {
    console.log("\n#[server.js] offer : ", data, "\n", getTime());
    peerConnectionID = data.peerConnectionID; // offer 를 보내는 주체인 streamer 는 peerConnectionID 를 서버에서 생성하지 않고 local 에서 생성함.
    console.log("\n# check peerConnectionID : ", peerConnectionID);
    io.to(data.to).emit("offer", {
      ...data,
      peerConnectionID,
    });
  });

  // 시청자가 스트리머에게 offer 받고 answer 보냈을 때 처리
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

  // 특정 시청자가 채팅방에서 나갈때
  // disconnecting 이벤트가 먼저 발생하고 disconnect 이벤트가 발생함
  socket.on("disconnect", () => {
    const userName = socket.handshake.query.userName;
    console.log("\n#[server.js] socket disconnect : ", userName, "\n", getTime());
    console.log("#[server.js] socket id : ", socket.id, "\n", getTime());
  });

  // 시청자가 방송방에서 퇴장했을 때
  socket.on("watcher left", () => {
    console.log("\n#[server.js] watcher left", "\n", getTime());
    console.log("#[server.js] watcher name : ", userName);
    console.log("#[server.js] watcher socket id : ", socket.id);

    numberOfWatchersForEachRoom[roomId] -= 1; // 시청자 수 갱신.
    console.log("\n#[server.js] numberOfWatchers : ", numberOfWatchersForEachRoom[roomId]);
    io.to(roomId).emit("watcher left", {
      watcherName: userName,
      watcherSocketId: socket.id,
      peerConnectionID,
      numberOfWatchers: numberOfWatchersForEachRoom[roomId],
    });
  });

  // 스트리머가 방송 종료했을 때
  socket.on("end live", () => {
    console.log("\n#[server.js] quit live", "\n", getTime());
    console.log("#[server.js] streamer name : ", userName, "\n", getTime());
    console.log("#[server.js] streamer socket id : ", socket.id, "\n", getTime());
    console.log("#[server.js] room name : ", roomName, "\n", getTime());

    delete roomListObj[roomName];
    delete numberOfWatchersForEachRoom[roomId];
    io.to(roomId).emit("end live");
  });
});

io.on("disconnect", (socket) => {
  console.log("\n#[server.js] socket disconnected!", "\n", getTime());
});
