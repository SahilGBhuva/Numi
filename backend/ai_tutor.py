from __future__ import annotations
import base64, json, os
from functools import lru_cache
from typing import Any
import httpx
import note_store

OPENROUTER_URL="https://openrouter.ai/api/v1/chat/completions"; OPENROUTER_MODEL=os.getenv("OPENROUTER_MODEL","openrouter/auto"); OPENROUTER_VISION_MODEL=os.getenv("OPENROUTER_VISION_MODEL",OPENROUTER_MODEL); OPENROUTER_TIMEOUT=float(os.getenv("OPENROUTER_TIMEOUT_SECONDS","12"))
class AITutorError(RuntimeError): pass
@lru_cache(maxsize=1)
def _client()->httpx.Client: return httpx.Client(timeout=httpx.Timeout(OPENROUTER_TIMEOUT,connect=4.0),limits=httpx.Limits(max_keepalive_connections=20,max_connections=50,keepalive_expiry=30.0),http2=True)
def _headers():
    key=os.getenv("OPENROUTER_API_KEY")
    if not key: raise AITutorError("OPENROUTER_API_KEY is not configured")
    return {"Authorization":f"Bearer {key}","Content-Type":"application/json","X-OpenRouter-Title":"bindit"}
def _extract_json(text:str)->dict[str,Any]:
    text=text.strip()
    if text.startswith("```"):
        text=text.strip("`"); text=text[4:].strip() if text.startswith("json") else text
    try: data=json.loads(text)
    except json.JSONDecodeError as exc: raise AITutorError("AI returned invalid JSON") from exc
    if not isinstance(data,dict): raise AITutorError("AI returned an invalid response shape")
    return data
def _post(payload):
    try:
        response=_client().post(OPENROUTER_URL,headers=_headers(),json=payload); response.raise_for_status(); return response.json()
    except (httpx.HTTPError,json.JSONDecodeError) as exc: raise AITutorError("OpenRouter request failed") from exc
def _chat_json(*,system_prompt,data,temperature,max_tokens):
    payload={"model":OPENROUTER_MODEL,"temperature":temperature,"max_tokens":max_tokens,"provider":{"sort":"latency","allow_fallbacks":True},"messages":[{"role":"system","content":system_prompt},{"role":"user","content":json.dumps(data,ensure_ascii=False,separators=(",",":"))}]}
    try: content=_post(payload)["choices"][0]["message"]["content"]
    except (KeyError,IndexError,TypeError) as exc: raise AITutorError("OpenRouter returned an unexpected response") from exc
    return _extract_json(content)
def extract_image_notes(*,image_bytes:bytes,content_type:str)->str:
    encoded=base64.b64encode(image_bytes).decode("ascii")
    payload={"model":OPENROUTER_VISION_MODEL,"temperature":0,"max_tokens":1800,"provider":{"sort":"latency","allow_fallbacks":True},"messages":[{"role":"user","content":[{"type":"text","text":"Read this study-note image carefully. Transcribe useful educational content, headings, labels, equations, and diagram facts. Plain text only. Never invent unreadable text."},{"type":"image_url","image_url":{"url":f"data:{content_type};base64,{encoded}"}}]}]}
    try: text=_post(payload)["choices"][0]["message"]["content"].strip()
    except (KeyError,IndexError,TypeError) as exc: raise AITutorError("Vision model returned an unexpected response") from exc
    if not text: raise AITutorError("No readable notes were found in that image")
    return text[:120000]
def _sources(source_labels:list[str])->tuple[list[str],str]:
    ids=[label.split("::",1)[0] for label in source_labels if "::" in label]
    stored_labels,text=note_store.context_by_ids(ids)
    return (stored_labels or [label.split("::",1)[-1] for label in source_labels],text)
def generate_question(*,course:str,unit:str,source_labels:list[str],focus:str,difficulty:int,personalization:dict[str,Any])->dict[str,str]:
    labels,text=_sources(source_labels); grounded=bool(text)
    prompt="You are Bindit's fast expert quiz writer. Create ONE concise short-answer question. Personalize difficulty. "+("Use supplied note excerpts as primary ground truth; test content actually present and add no unsupported facts. " if grounded else "Use course/unit knowledge; filenames are hints only. ")+"Return ONLY JSON: {\"question\":string,\"correct_answer\":string,\"topic\":string}."
    result=_chat_json(system_prompt=prompt,temperature=.3,max_tokens=220,data={"course":course or "General Studies","unit":unit or "Current Unit","sources":labels[:10],"note_excerpts":text,"focus":focus,"difficulty":difficulty,"performance":personalization})
    required={"question","correct_answer","topic"}
    if set(result)!=required or not all(isinstance(result[k],str) and result[k].strip() for k in required): raise AITutorError("AI question response did not match the required schema")
    return {k:result[k].strip() for k in required}
def generate_flashcards(*,course:str,unit:str,source_labels:list[str],count:int,personalization:dict[str,Any])->list[dict[str,str]]:
    labels,text=_sources(source_labels); grounded=bool(text); requested=max(3,min(30,count))
    prompt="You are Bindit's expert flashcard writer. Make high-value retrieval-practice cards. Avoid duplicates/trivia. "+("Use supplied note excerpts as primary ground truth; invent nothing unsupported. " if grounded else "Filenames are hints only. ")+"Return ONLY JSON {\"cards\":[{\"front\":string,\"back\":string,\"topic\":string}]} ."
    result=_chat_json(system_prompt=prompt,temperature=.3,max_tokens=min(1800,110*requested),data={"course":course or "General Studies","unit":unit or "Current Unit","sources":labels[:10],"note_excerpts":text,"count":requested,"performance":personalization})
    if set(result)!={"cards"} or not isinstance(result["cards"],list): raise AITutorError("AI flashcard response did not match the required schema")
    cards=[]
    for raw in result["cards"]:
        if not isinstance(raw,dict) or set(raw)!={"front","back","topic"} or not all(isinstance(raw.get(k),str) and raw[k].strip() for k in ("front","back","topic")): raise AITutorError("AI returned an invalid flashcard")
        cards.append({k:raw[k].strip() for k in ("front","back","topic")})
    if len(cards)<3: raise AITutorError("AI returned too few flashcards")
    return cards[:requested]
def grade_answer(*,question:str,correct_answer:str,student_answer:str,topic:str,difficulty:int)->dict[str,Any]:
    prompt="You are Bindit's fast school tutor/grader. Use reference as rubric; accept equivalent wording and meaningful partial credit. Be concise. Return ONLY JSON with keys correct:boolean, score:0-100 integer, mistake_type:string|null, explanation:string, hint:string|null, misconception:string|null."
    result=_chat_json(system_prompt=prompt,temperature=.05,max_tokens=260,data={"topic":topic,"difficulty":difficulty,"question":question,"reference":correct_answer,"answer":student_answer}); required={"correct","score","mistake_type","explanation","hint","misconception"}
    if set(result)!=required or not isinstance(result["correct"],bool): raise AITutorError("AI response did not match the required schema")
    try: result["score"]=max(0,min(100,int(result["score"])))
    except (TypeError,ValueError) as exc: raise AITutorError("AI returned an invalid score") from exc
    for key in ("mistake_type","explanation","hint","misconception"):
        if result[key] is not None and not isinstance(result[key],str): raise AITutorError(f"AI returned invalid {key}")
    if not result["explanation"]: raise AITutorError("AI returned an empty explanation")
    return result
