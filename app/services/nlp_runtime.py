from __future__ import annotations
from functools import lru_cache

def _try_load_spacy():
    try:
        import spacy  
    except Exception:
        return None, None
    return spacy, spacy

@lru_cache(maxsize=1)
def load_nlp():
    #dont break if spacy fails
    spacy, _ = _try_load_spacy()
    if spacy is None:
        return None  # caller should guard and degrade if needed

    try:
        nlp = spacy.load("en_core_web_sm")
        if "senter" not in nlp.pipe_names and "sentencizer" not in nlp.pipe_names:
            nlp.add_pipe("sentencizer")
        return nlp
    except Exception:
        nlp = spacy.blank("en")
        nlp.add_pipe("sentencizer")
        return nlp
