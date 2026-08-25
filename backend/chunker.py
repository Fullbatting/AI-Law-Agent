import re
from typing import List, Dict, Any

ARTICLE_RE = re.compile(r'(제\s*\d+\s*조)(?:\s*\((?P<title>[^)]*)\))?', re.M)
CLAUSE_RE = re.compile(r'(제\s*\d+\s*항)')
SECTION_RE = re.compile(r'(제\s*\d+\s*호)')

def split_by_article(text: str) -> List[Dict[str, Any]]:
    matches = list(ARTICLE_RE.finditer(text))
    if not matches:
        return [{'article_tag': None, 'title': None, 'content': text.strip()}]
    articles = []
    for i, m in enumerate(matches):
        start = m.start()
        end = matches[i+1].start() if i+1 < len(matches) else len(text)
        block = text[start:end].strip()
        tag = m.group(1).replace(' ', '')
        title = m.group('title') if m.group('title') else None
        articles.append({'article_tag': tag, 'title': title, 'content': block})
    return articles

def chunk_legal_text(full_text: str) -> List[Dict[str, Any]]:
    chunks = []
    for art in split_by_article(full_text):
        chunks.append({'text': art['content'], 'meta': {'article_tag': art.get('article_tag'), 'title': art.get('title')}})
    return chunks