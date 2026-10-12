// 원드라이브 동기화 설정. Azure(Microsoft Entra) 앱 등록 후 클라이언트 ID를 넣으세요.
window.LEVELUP_CONFIG = {
  msClientId: 'REPLACE_ME',
  authority: 'https://login.microsoftonline.com/consumers',
  redirectUri: null // null이면 현재 페이지 폴더 주소(예: https://내사이트/)를 사용
};
