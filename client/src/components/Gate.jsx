import React, { useState } from "react";
import { GATE_HASH } from "../legacy/dashboardLegacy.js";

async function sha256hex(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/* v1 비밀번호 게이트 동작 보존 — 동일 SHA-256 해시 대조 */
export default function Gate({ onUnlock }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");

  async function tryOpen() {
    const hex = await sha256hex(pw);
    if (hex === GATE_HASH) {
      // API 서버 인증용 토큰(비밀번호 원문)을 세션에 보관 → x-access-token 헤더로 전송
      sessionStorage.setItem("on_token", pw);
      setErr(""); onUnlock();
    }
    else { setErr("비밀번호가 올바르지 않습니다."); }
  }
  const onKey = (e) => { if (e.key === "Enter") tryOpen(); };

  return (
    <div id="gate">
      <div className="gbox">
        <div className="glogo">ON</div>
        <h2>영업ON본부 통합 대시보드</h2>
        <div className="gsub">접근 비밀번호를 입력하세요</div>
        <input
          type="password" placeholder="비밀번호" autoComplete="off" autoFocus
          value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={onKey}
        />
        <button type="button" onClick={tryOpen}>확인</button>
        <div className="gerr">{err}</div>
        <div className="gnote">영업ON본부 내부 보고용 · 무단 외부 공유 금지</div>
      </div>
    </div>
  );
}
