async def translate_query(question: str):
    return {"keywords": question.split()[:5], "intent": ""}