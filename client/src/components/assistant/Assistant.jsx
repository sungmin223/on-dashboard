import React, { useEffect, useRef, useState } from "react";

const SUGGESTIONS = [
  "FRBX006 재고와 가격 알려줘",
  "샤또 라뚜르 빈티지별 재고",
  "신동창고에 재고 많은 레드와인 top 5",
  "10만원 이하 공급가 화이트와인 추천",
];

export default function Assistant({ onClose }) {
  const [messages, setMessages] = useState([]); // {role:'user'|'assistant'|'error', content}
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bodyRef = useRef(null);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [messages, loading]);

  async function send(text) {
    const q = (text ?? input).trim();
    if (!q || loading) return;
    const convo = [...messages.filter((m) => m.role === "user" || m.role === "assistant"), { role: "user", content: q }];
    setMessages((m) => [...m, { role: "user", content: q }]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: convo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "오류가 발생했습니다.");
      setMessages((m) => [...m, { role: "assistant", content: data.answer || "(빈 응답)" }]);
    } catch (e) {
      setMessages((m) => [...m, { role: "error", content: e.message || "AI 응답 실패" }]);
    } finally {
      setLoading(false);
    }
  }

  const onKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <div className="ai-panel">
      <div className="ai-head">
        <span className="ai-dot" />
        <div>
          <h3>AI 어시스턴트</h3>
          <div className="ai-sub">실재고 데이터 기반 · 한국어 응답</div>
        </div>
        {onClose && <button className="ai-x" onClick={onClose} title="닫기">×</button>}
      </div>

      <div className="ai-body" ref={bodyRef}>
        {messages.length === 0 && !loading && (
          <div className="ai-empty">
            재고·가격·견적을 물어보세요.<br />답변은 실제 재고 데이터에 근거합니다.
            <div>
              {SUGGESTIONS.map((s) => (
                <span key={s} className="chip" onClick={() => send(s)}>{s}</span>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={"msg " + (m.role === "user" ? "user" : m.role === "error" ? "ai err" : "ai")}>
            {m.content}
          </div>
        ))}
        {loading && (
          <div className="msg ai">
            <span className="typing"><i /><i /><i /></span>
          </div>
        )}
      </div>

      <div className="ai-foot">
        <textarea
          rows={1} placeholder="메시지를 입력하세요…(Enter 전송, Shift+Enter 줄바꿈)"
          value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={onKey}
        />
        <button onClick={() => send()} disabled={loading || !input.trim()} title="전송">↑</button>
      </div>
    </div>
  );
}
