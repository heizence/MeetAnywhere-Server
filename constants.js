const Home_ip_address = "172.16.11.213"; // 집 IP 주소. 집에서 작업 시 사용하는 ip 주소
const Other_ip_address = "172.30.112.55"; // 다른 공간에 있을 때 사용하는 ip 주소. 터미널에서 ifconfig 명령어로 확인 후 en0 inet 부분 확인

const Main_server_port_number = 8000; // Main 서버가 실행되는 port number

// Signaling 서버(본 서버)가 실행되는 port number
// server.js 파일에 Port_number 로 정의된 변수값과 일치해야 함. 반드시 확인하기.
const Signaling_server_port_number = 8080;

const isHome = true; // 재택근무 여부

const Main_server_URL = `http://${isHome ? Home_ip_address : Other_ip_address}:${Main_server_port_number}/`; // do not delete last '/' !
const Signaling_server_URL = `http://${isHome ? Home_ip_address : Other_ip_address}:${Signaling_server_port_number}/`;
