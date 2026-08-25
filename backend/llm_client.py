import os, httpx

class LLMClient:
    def __init__(self, backend=None, url=None):
        self.backend = backend or os.getenv("LLM_BACKEND", "ollama")
        self.url = url or os.getenv("LLM_URL", "http://localhost:11434")
        self.client = httpx.AsyncClient(timeout=60.0)

    async def generate(self, system: str, prompt: str, max_tokens: int = 512):
        # 실제 LLM 호출 로직(ollama/vllm/openai) 구현 필요
        return "LLM 응답(더미)"