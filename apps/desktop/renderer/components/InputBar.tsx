import React, { useState } from "react";

interface Props {
  disabled: boolean;
  onSend: (text: string) => void;
}

export function InputBar({ disabled, onSend }: Props): JSX.Element {
  const [text, setText] = useState("");

  function submit() {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText("");
  }

  return (
    <div className="input-bar">
      <input
        type="text"
        value={text}
        placeholder="질문을 입력하세요..."
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
      />
      <button type="button" onClick={submit} disabled={disabled}>
        전송
      </button>
    </div>
  );
}
