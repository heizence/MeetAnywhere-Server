/*
webRTC 에서 peer 간 연결을 위한 signaling 서버
node.js 및 socket io 를 사용함.
Android client 에서도 연결이 되도록 설계
*/

const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");
const { v4 } = require("uuid");
const { port } = require("./config.js");

const app = express();
const httpServer = createServer(app);

httpServer.listen(port, () => {
  console.log("\n#[server.js] started at port", port, "\n", getTime());
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
  const characters = "0123456789ABCDEFGHJKLMNOPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"; // 알파벳 I와 l은 혼동될 수 있으므로 제외
  const stringLength = 6;
  let randomString = "";

  for (let i = 0; i < stringLength; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    randomString += characters.charAt(randomIndex);
  }

  return randomString;
}

// 참석자 목록에서 참석자 삭제하기
async function removeParticipantFromList(conferenceId, participantId) {
  let participantsList = conferenceListObj[conferenceId].participantsList; // do not delete!
  conferenceListObj[conferenceId].participantsList = await participantsList.filter((each) => each.id !== participantId);

  console.log("check list after remove : " + JSON.stringify(participantsList));
}

// 참석자 목록에서 참석자 삭제하기. type : "mic" or "video"
async function editMicOrVideoStatus(conferenceId, participantId, status, type = "mic") {
  console.log("\neditMicOrVideoStatus. participantId : " + participantId);
  console.log("type : ", type, "status : ", status);

  let participantsList = conferenceListObj[conferenceId].participantsList; // do not delete!
  conferenceListObj[conferenceId].participantsList = await participantsList.map((each) => {
    if (each.id === participantId) {
      console.log("edit participant. check obj : ", {
        ...each,
        isMicOn: type === "mic" ? status : each.micStatus,
        isVideoOn: type === "video" ? status : each.isVideoOn,
      });
      return {
        ...each,
        isMicOn: type === "mic" ? status : each.isMicOn,
        isVideoOn: type === "video" ? status : each.isVideoOn,
      };
    } else return each;
  });

  console.log("check list after edit : " + JSON.stringify(conferenceListObj[conferenceId].participantsList));
}

// 회의실 목록 객체
let conferenceListObj = {};

// 새 참석자 입장 시 연결 상태 확인용 배열
let connectionStatus = [];

// 새 참석자 데이터 임시 저장 변수
let newParticipantObj = {};

// 각 회의실 참석자 수. conferenceId : (숫자) 형식으로 저장

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
  let isHost = socket.handshake.query.isHost === "true";
  let peerConnectionID; // client 에서 RTCPeerConnection 객체를 구분해 줄 고유 ID

  // 호스트가 회의실 생성하기
  socket.on("create new conference", (data) => {
    console.log("\n#[server.js] create new conference. data : ", data, "\n", getTime());
    conferenceId = generateConferenceId();
    socket.join(conferenceId); // 회의실 생성 및 입장은 conferenceId 를 통해서 하기. 이름이 중복되는 경우가 있음.
    console.log("userName : ", userName);

    let conferencePassword = generateConferencePassword();
    conferenceListObj[conferenceId] = {
      hostSocketId: socket.id, // 회의 호스트. 호스트가 퇴장 시 변경됨.
      conferencePassword,
      hostName: userName,
      participantsList: [
        {
          id: socket.id,
          name: userName,
          profileImg: data.profileImg,
          isMicOn: data.isMicOn,
          isVideoOn: data.isVideoOn,
          isHost: true,
        },
      ],
    };

    console.log("conference ID : ", conferenceId);
    // 회의실 생성 완료

    io.to(conferenceId).emit("conference created", {
      hostSocketId: socket.id,
      conferenceId: conferenceId,
      conferencePassword,
    });

    console.log("check conferenceListObj : ", JSON.stringify(conferenceListObj), "\n", getTime());
    console.log("participant list length : ", conferenceListObj[conferenceId].participantsList.length);
  });

  // 회의 참석 요청하기
  socket.on("request join", (data) => {
    console.log("\n#[server.js] request join", data, "\n", getTime());
    socket.join(conferenceId); // 방송방 생성 및 입장은 conferenceId 를 통해서 하기. 이름이 중복되는 경우가 있음.

    //peerConnectionID = v4(); // 신규 참석자가 peerConnectionID 를 생성(기존 참석자는 해당 없음) -> 기존 참석자가 만들어 주는 식으로 변경 해야 됨
    console.log("\n# check peerConnectionID : ", peerConnectionID);

    let hostSocketId = conferenceListObj[conferenceId].hostSocketId;

    newParticipantObj = {
      id: data.participantSocketId,
      name: userName,
      profileImg: data.profileImg,
      isMicOn: data.isMicOn,
      isVideoOn: data.isVideoOn,
    };

    socket.broadcast.to(conferenceId).emit("request join", {
      participantSocketId: socket.id,
      hostSocketId,
      //conferencePassword: conferenceListObj[conferenceId].conferencePassword,
    });

    let allMembersSocketId = conferenceListObj[conferenceId].participantsList.map((each) => each.id);
    console.log("allMembersSocketId : ", allMembersSocketId, "\n");

    // 새 참석자의 경우 기존 참가자들 socket id 보내주기
    socket.to(socket.id).emit("new participant create peerconnection", {
      allMembersSocketId,
    });
  });

  // offer 보내기
  socket.on("offer", (data) => {
    console.log("\n#[server.js] offer : ", data, "\n", getTime());
    peerConnectionID = data.peerConnectionID; // offer 를 보내는 쪽에서 서버에 peerConnectionID 저장
    console.log("\n# check peerConnectionID : ", peerConnectionID);

    socket.to(data.to).emit("offer", {
      ...data,
      peerConnectionID,
    });
  });

  // answer 보내기
  socket.on("answer", (data) => {
    console.log("\n#[server.js] answer : ", data, "\n", getTime());
    peerConnectionID = data.peerConnectionID; // offer 를 받고 answer 를 보내는 쪽에서 서버에 peerConnectionID 저장
    console.log("\n# check peerConnectionID : ", data.peerConnectionID);
    socket.to(data.to).emit("answer", {
      ...data,
      peerConnectionID: data.peerConnectionID,
    });
  });

  // offer_screenShare 보내기
  socket.on("offer_screenShare", (data) => {
    console.log("\n#[server.js] offer_screenShare : ", data, "\n", getTime());
    peerConnectionID = data.peerConnectionID; // offer 를 보내는 쪽에서 서버에 peerConnectionID 저장
    console.log("\n# check peerConnectionID : ", peerConnectionID);

    socket.to(data.to).emit("offer_screenShare", {
      ...data,
    });
  });

  // answer_screenShare 보내기
  socket.on("answer_screenShare", (data) => {
    console.log("\n#[server.js] answer_screenShare : ", data, "\n", getTime());
    peerConnectionID = data.peerConnectionID; // offer 를 받고 answer 를 보내는 쪽에서 서버에 peerConnectionID 저장
    console.log("\n# check peerConnectionID : ", data.peerConnectionID);
    socket.to(data.to).emit("answer_screenShare", {
      ...data,
    });
  });

  // iceCandidate 보내기
  socket.on("iceCandidate", (data) => {
    console.log("\n#[server.js] iceCandidate : ", data, "\n", getTime());
    console.log("\n# check peerConnectionID : ", data.peerConnectionID);
    socket.to(data.to).emit("iceCandidate", {
      ...data,
      peerConnectionID: data.peerConnectionID,
    });
    // io.to(data.to).emit("iceCandidate", {
    //   ...data,
    //   peerConnectionID,
    // });
  });

  // 호스트 및 각 참석자가 새 참석자와 연결 성공 시
  socket.on("connected to peer", async (data) => {
    console.log("\n#[server.js] connected to peer. data : ", data, "\n", getTime());

    await connectionStatus.push(data);
    console.log("push data to connectionStatus : ", connectionStatus);

    let participantsList = conferenceListObj[conferenceId].participantsList;
    let numberOfParticipants = participantsList.length;

    console.log("participantsList : ", JSON.stringify(participantsList));
    console.log("connectionStatus : ", connectionStatus);
    console.log("numberOfParticipants : ", numberOfParticipants, "\n");

    if (numberOfParticipants * 2 <= connectionStatus.length) {
      let isAllConnected = connectionStatus.every((each) => each.isConnected === true);
      console.log("isAllConnected : ", isAllConnected);

      if (isAllConnected) {
        await participantsList.push(newParticipantObj);
        console.log("participantsList : ", participantsList, "\n");
        io.to(conferenceId).emit("participant joined", {
          //newParticipant: newParticipantObj, // 기존 참석자들이 사용할 데이터
          newParticipantSocketId: newParticipantObj.id,

          // 새 참석자가 사용할 데이터
          participantsList,
          conferencePassword: conferenceListObj[conferenceId].conferencePassword,
          hostName: conferenceListObj[conferenceId].hostName,
        });
      }

      connectionStatus = await [];
      newParticipantObj = await null;
      console.log("init connectionStatus : ", connectionStatus);
      console.log("init newParticipantObj : ", newParticipantObj);
      console.log("numberOfParticipants : ", participantsList.length, "\n");
    }
  });

  // 채팅 입력 시 채팅 내용 전송해 주기
  socket.on("new chat message", (data) => {
    console.log("\n#[server.js] new chat message : ", data, "\n", getTime());

    io.to(conferenceId).emit("new chat message", {
      senderSocketId: socket.id,
      senderName: userName,
      senderProfileImg: data.senderProfileImg,
      chatMessageContents: data.chatMessageContents,
    });
  });

  // 참석자가 비디오 on/off 할 때
  socket.on("switch video status", (data) => {
    console.log("\n#[server.js] switch video status : ", data, "\n", getTime());
    let senderSocketId = data.senderSocketId;
    editMicOrVideoStatus(conferenceId, senderSocketId, data.videoStatus, "video");
    io.to(conferenceId).emit("switch video status", {
      senderSocketId,
      videoStatus: data.videoStatus,
    });
  });

  // 참석자가 마이크 on/off 할 때
  socket.on("switch mic status", (data) => {
    console.log("\n#[server.js] switch mic status : ", data, "\n", getTime());
    let senderSocketId = data.senderSocketId;
    editMicOrVideoStatus(conferenceId, senderSocketId, data.micStatus, "mic");
    io.to(conferenceId).emit("switch mic status", {
      senderSocketId,
      micStatus: data.micStatus,
    });
  });

  // 참석자가 회의에서 퇴장했을 때
  socket.on("participant left", async () => {
    console.log("\n#[server.js] participant left", "\n", getTime());
    console.log("#[server.js] participant name : ", userName);
    console.log("#[server.js] participant socket id : ", socket.id);

    //let participantsList = conferenceListObj[conferenceId].participantsList;
    //conferenceListObj[conferenceId].participantsList = await participantsList.filter((each) => each.id !== socket.id);
    removeParticipantFromList(conferenceId, socket.id);
    console.log(
      "\n#[server.js] check participantsList : ",
      JSON.stringify(conferenceListObj[conferenceId].participantsList),
      "\n",
      getTime()
    );

    // just for check
    //let numberOfParticipants = Object.keys(conferenceListObj[conferenceId].participantsList).length;
    let numberOfParticipants = conferenceListObj[conferenceId].participantsList.length;
    console.log("\n#[server.js] numberOfParticipants : ", numberOfParticipants);
    socket.broadcast.to(conferenceId).emit("participant left", {
      participantSocketId: socket.id,
      peerConnectionID,
    });
    // io.to(conferenceId).emit("participant left", {
    //   participantSocketId: socket.id,
    //   peerConnectionID,
    // });
  });

  // 화면 공유 중인 참석자가 화면 공유 중지 시
  socket.on("stopScreenSharing", (data) => {
    console.log("\n#[server.js] stopScreenSharing", "\n", getTime());
    console.log("#[server.js] participant socket id : ", data.participantSocketId);

    socket.broadcast.to(conferenceId).emit("stopScreenSharing", {
      participantSocketId: data.participantSocketId,
    });
  });

  // 호스트가 회의 전체 종료했을 때
  socket.on("end conference", () => {
    console.log("\n#[server.js] end conference", "\n", getTime());
    console.log("#[server.js] host name : ", userName, "\n", getTime());
    console.log("#[server.js] host socket id : ", socket.id, "\n", getTime());
    console.log("#[server.js] conferenceId : ", conferenceId, "\n", getTime());

    delete conferenceListObj[conferenceId];

    console.log("\n# conferenceListObj : ", JSON.stringify(conferenceListObj));
    socket.broadcast.to(conferenceId).emit("end conference");
  });

  // 호스트가 혼자만 회의에서 나갔을 때
  socket.on("host left", async (data) => {
    console.log("\n#[server.js] host left. data : ", data, "\n", getTime());

    // 회의실의 새 호스트 지정
    let participantsList = conferenceListObj[conferenceId].participantsList; // do not delete!
    let newHostObj = participantsList.find((each) => each.id === data.newHostSocketId);
    let newHostName = newHostObj.name;
    console.log("newHostName : ", newHostName, "\n");
    newHostObj.isHost = true;

    conferenceListObj[conferenceId] = {
      hostSocketId: data.newHostSocketId,
      hostName: newHostName,
      ...conferenceListObj[conferenceId],
    };

    removeParticipantFromList(conferenceId, socket.id);
    console.log("check participantsList : ", participantsList);

    socket.broadcast.to(conferenceId).emit("host left", {
      hostSocketId: data.hostSocketId,
      newHostSocketId: data.newHostSocketId,
      newHostName,
      peerConnectionID,
    });
  });

  // 참석자로부터 연결이 끊겼을 때
  // disconnecting 이벤트가 먼저 발생하고 disconnect 이벤트가 발생함
  socket.on("disconnect", async () => {
    console.log("\n#[server.js] socket disconnect : ", userName, "\n", getTime());

    if (conferenceListObj[conferenceId]) {
      //let isHost = socket.id === conferenceListObj[conferenceId].hostSocketId;

      if (isHost) {
        console.log("#[server.js] is host.", getTime());
        // 추후 로직 추가
      } else {
        console.log("#[server.js] is participant.", getTime());
        let userLeft = conferenceListObj[conferenceId].participantsList[socket.id];

        if (userLeft) {
          console.log("#[server.js] participant has been disconnected abnormally", getTime());
          // let participantsList = conferenceListObj[conferenceId].participantsList;
          // conferenceListObj[conferenceId].participantsList = await participantsList.filter(
          //   (each) => each.id !== socket.id
          // );
          removeParticipantFromList(conferenceId, socket.id);
          console.log(
            "\n#[server.js] check participantsList : ",
            JSON.stringify(conferenceListObj[conferenceId].participantsList),
            "\n",
            getTime()
          );

          // just for check
          let numberOfParticipants = conferenceListObj[conferenceId].participantsList.length;
          console.log("\n#[server.js] numberOfParticipants : ", numberOfParticipants);

          // io.to(conferenceId).emit("participant left", {
          //   participantSocketId: socket.id,
          //   peerConnectionID,
          // });
          socket.broadcast.to(conferenceId).emit("participant left", {
            participantSocketId: socket.id,
            peerConnectionID,
          });
        } else {
          console.log("#[server.js] participant has left normally.", getTime());
        }
      }

      // 비정상 종료로 방폭 시 회의실 데이터 삭제해 주기
      let numberOfParticipants = conferenceListObj[conferenceId].participantsList.length;
      if (numberOfParticipants.length === 0) {
        delete conferenceListObj[conferenceId];
      }
    }
  });
});

io.on("disconnect", (socket) => {
  console.log("\n#[server.js] socket disconnected!", "\n", getTime());
});
