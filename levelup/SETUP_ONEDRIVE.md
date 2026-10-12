# 원드라이브 동기화 설정 (Microsoft Entra 앱 등록)

1. https://entra.microsoft.com (또는 portal.azure.com) → **앱 등록(App registrations)** → **새 등록**
   - 이름: `레벨업 라이프` (아무거나)
   - **지원되는 계정 유형**: *개인 Microsoft 계정만* (Personal Microsoft accounts only)
     - 회사·학교 계정도 쓰려면 "모든 조직 디렉터리의 계정 및 개인 Microsoft 계정"을 고르고 config.js의 authority를 `https://login.microsoftonline.com/common`으로 바꾸세요.
   - **리디렉션 URI**: 플랫폼 **단일 페이지 애플리케이션(SPA)** → `https://<site-domain>/`
     (앱이 하위 폴더에 있으면 `https://<site-domain>/<folder>/` — index.html이 있는 폴더 주소, 끝 슬래시 포함)
2. 등록 후 **인증(Authentication)**
   - 플랫폼: Single-page application 하나만 (Web 플랫폼 추가 금지)
   - 암시적 허용(Access tokens / ID tokens) 체크 **불필요** (MSAL v4는 PKCE 인증 코드 흐름 사용)
   - 로컬 테스트용으로 `http://localhost:8765/` 를 SPA 리디렉션 URI에 추가해도 됨
3. **API 권한(API permissions)** → Microsoft Graph → **위임된 권한(Delegated)**
   - `Files.ReadWrite.AppFolder`
   - `offline_access`
   - (기본 `User.Read`는 있어도 되고 지워도 됨)
   - 관리자 동의 **불필요** — 처음 로그인할 때 사용자가 직접 동의
4. **개요(Overview)** 의 *애플리케이션(클라이언트) ID* 를 복사해 `config.js`에 넣기:
   ```js
   window.LEVELUP_CONFIG = { msClientId: '여기에-ID', authority: 'https://login.microsoftonline.com/consumers', redirectUri: null };
   ```
   `redirectUri: null`이면 현재 페이지 폴더 주소를 자동으로 씀 (등록한 URI와 정확히 같아야 함).
5. 클라이언트 시크릿·인증서 **만들지 않음** (SPA는 공개 클라이언트).

## 저장 위치 (원드라이브)
- `앱/레벨업 라이프/levelup-data.json` — 최신 데이터 (Graph: `/me/drive/special/approot:/levelup-data.json`)
- `앱/레벨업 라이프/backups/levelup-YYYY-MM-DD.json` — 하루 1개, 최근 30개 유지
- `backups/conflict-local-*.json`, `conflict-remote-*.json` — 충돌로 덮어쓰기 전 자동 보관본

## 참고
- HTTPS 사이트에서만 로그인 가능 (localhost 제외). `levelup-standalone.html`(파일로 열기)은 동기화 없는 오프라인 전용.
- config.js는 서비스워커가 네트워크 우선으로 받아서, ID를 바꾸면 다음 접속 때 바로 반영됨.
