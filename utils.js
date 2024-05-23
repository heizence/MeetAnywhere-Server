// ID 생성(11자리 숫자)
function generateId() {
  // Generate a random number between 0 and 1 (exclusive of 1).
  const randomFraction = Math.random();

  // Multiply the random fraction by 1e11 (10^11) to get an 11-digit number.
  const randomNumber = Math.floor(randomFraction * 1e11);

  return randomNumber.toString().padStart(11, "0");
}

// 암호 생성
function generatePassword() {
  const characters = "0123456789ABCDEFGHJKLMNOPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"; // 알파벳 I와 l은 혼동될 수 있으므로 제외
  const stringLength = 6;
  let randomString = "";

  for (let i = 0; i < stringLength; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    randomString += characters.charAt(randomIndex);
  }

  return randomString;
}

module.exports = {
  generateId,
  generatePassword,
};
