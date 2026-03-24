import os
from typing import List

import torch
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

MODEL_NAME = os.getenv("NLLB_MODEL", "facebook/nllb-200-distilled-1.3B")
BATCH_SIZE = int(os.getenv("NLLB_BATCH_SIZE", "6"))

app = FastAPI()

class TranslateRequest(BaseModel):
    texts: List[str]
    sourceLang: str
    targetLang: str

class TranslateResponse(BaseModel):
    texts: List[str]


def get_device():
    return "cuda" if torch.cuda.is_available() else "cpu"


def load_model():
    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
    model = AutoModelForSeq2SeqLM.from_pretrained(MODEL_NAME)
    device = get_device()
    model = model.to(device)
    model.eval()
    return tokenizer, model, device


tokenizer, model, device = load_model()


@app.get("/health")
async def health():
    return {
        "ok": True,
        "model": MODEL_NAME,
        "device": device
    }


def translate_batch(texts: List[str], src_lang: str, tgt_lang: str) -> List[str]:
    tokenizer.src_lang = src_lang
    forced_bos_token_id = tokenizer.convert_tokens_to_ids(tgt_lang)

    inputs = tokenizer(texts, return_tensors="pt", padding=True, truncation=True).to(device)
    with torch.no_grad():
        generated_tokens = model.generate(
            **inputs,
            forced_bos_token_id=forced_bos_token_id,
            max_new_tokens=256
        )
    return tokenizer.batch_decode(generated_tokens, skip_special_tokens=True)


@app.post("/translate", response_model=TranslateResponse)
async def translate(req: TranslateRequest):
    if not req.texts:
        raise HTTPException(status_code=400, detail="texts is required")

    outputs: List[str] = []
    for i in range(0, len(req.texts), BATCH_SIZE):
        batch = req.texts[i : i + BATCH_SIZE]
        outputs.extend(translate_batch(batch, req.sourceLang, req.targetLang))

    return TranslateResponse(texts=outputs)
