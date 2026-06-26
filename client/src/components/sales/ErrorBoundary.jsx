/* ErrorBoundary — 한 모듈에서 런타임 오류가 나도 앱 전체가 멈추지 않게 격리.
   오류 메시지와 새로고침 버튼을 보여준다. */
import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error("[module error]", error, info); }
  componentDidUpdate(prev) { if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null }); }
  render() {
    if (this.state.error) {
      return (
        <div className="s-wrap">
          <div className="s-card">
            <h3>화면을 표시하는 중 오류가 발생했습니다</h3>
            <p style={{ color: "var(--text-2)", fontSize: 13 }}>다른 탭은 정상 동작합니다. 이 화면을 새로고침하거나 데이터를 확인하세요.</p>
            <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, color: "var(--danger,#c0392b)", background: "var(--surface-2)", padding: 10, borderRadius: 8, overflow: "auto" }}>
              {String(this.state.error?.message || this.state.error)}
            </pre>
            <button className="run-btn" onClick={() => location.reload()}>새로고침</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
