/* api.js — 사내 API 호출 헬퍼.
   게이트 통과 시 sessionStorage 에 보관된 접근 토큰(비밀번호)을
   x-access-token 헤더로 실어 보낸다. 서버가 해시 대조로 인증.
   (/api/health 처럼 공개 엔드포인트는 토큰 없이도 동작) */
export function apiFetch(path, opts = {}) {
  const token = sessionStorage.getItem("on_token") || "";
  const headers = { ...(opts.headers || {}) };
  if (token) headers["x-access-token"] = token;
  return fetch(path, { ...opts, headers });
}
