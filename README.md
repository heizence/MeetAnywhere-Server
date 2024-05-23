#  MeetAnywhere server

화상회의 서비스 Zoom 의 기능을 비슷하게 만들어 보는 클론 코딩 프로젝트.

**본 Repository 는 Server side repository 임.** 

[Client side repository 바로가기](https://github.com/heizence/MeetAnywhere-Client)

### Built with

* Node.js
* Socket.io

프로젝트에 대한 상세 설명은 다음 링크를 참고할 것.

[heizence.devlog - Zoom Android 앱 클론코딩](https://heizence.github.io/posts/zoomCloneCoding/)

## Getting started

### Prerequisite

- Node.js version >= 18.4.0
- npm version >= 8.12.1
- google 계정 앱 패스워드(SMTP 서비스에 이용)

### Installation

Repository 클론

```
git clone https://github.com/heizence/MeetAnywhere-Server
```

라이브러리 설치

```
npm install
```

root 경로에서 .env 파일 생성 후 내용 추가하기

```
# 다음 내용들 추가하기
port=0000 # 서버를 실행할 Port 번호
jwtSecretKey="jwtSecretKey"

dbHost="dbHost"
dbPort=0000
dbUser="dbUser"
dbPassword="dbPassword"
dbName="dbName"

nodemailerUser="user@gmail.com"  # gmail SMTP 사용을 위한 google gmail 계정.
nodemailerPassword="password"   # google 앱 패스워드(계정 패스워드 아님)
```

서버 실행하기

```
node app.js
```

## etc

socketServer.js 파일은 기본적으로 WebRTC 연결을 위한 signaling 서버 기능과 회의 중 실시간 요청 처리를 위한 소켓 서버 기능 2가지가 모여 있음.

상호적으로 엮여 있는 이벤트들이 있으므로 수정 및 삭제 시 주의 요망.
