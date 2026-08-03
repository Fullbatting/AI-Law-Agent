from chunker import chunk_legal_text

def test_chunker_basic():
    sample = "제1조(목적) 이 법은 ..."
    chunks = chunk_legal_text(sample)
    assert isinstance(chunks, list)