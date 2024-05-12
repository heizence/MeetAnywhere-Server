#  MeetAnywhere server

화상회의 서비스 Zoom 의 기능을 비슷하게 만들어 보는 클론 코딩 프로젝트입니다.

본 Repository 는 서비스 실행에 필요한 다음 서버들이 포함되어 있습니다.

* 메인 서버
* WebRTC 연결 시 정보를 주고받기 위한 signaling server
* 실시간 채팅 메시지를 주고받기 위한 socket 서버

기술 : Node.js, Express, Socket.io

## 실행

1.npm dependencies 설치

```
npm install
```

2.app.js 파일 실행

```
node app.js
```
