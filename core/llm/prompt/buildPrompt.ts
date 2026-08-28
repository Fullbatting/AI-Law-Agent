import { FEW_SHOT_EXAMPLES } from "./fewShot";

export function buildUserPrompt(userText: string): string {
  return `${FEW_SHOT_EXAMPLES}

### 실제 질문
질문: "${userText}"
출력:`;
}
