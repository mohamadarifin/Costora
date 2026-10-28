"""Approval request/sign state + in-app notifications."""

from lib.auth import now_iso
from lib.db import db
from models.schemas import new_id

LINKS = {"hpp": "/hpp/{id}", "packaging": "/packaging/{id}"}
KIND_LABEL = {"hpp": "HPP", "packaging": "Packaging Form"}


async def notify(user_id: str, type_: str, kind: str, doc_id: str, slot: str, title: str, message: str, requested_by: str | None = None):
    await db.notifications.insert_one({
        "id": new_id(), "user_id": user_id, "type": type_, "kind": kind, "doc_id": doc_id, "slot": slot, "title": title,
        "message": message, "link": LINKS[kind].format(id=doc_id), "requested_by": requested_by, "read": False, "created_at": now_iso(),
    })


async def sync_approvals(kind: str, doc_id: str, title: str, slots: list[tuple[str, str]], new: dict, old: dict, old_signed: dict, actor: dict) -> dict:
    """Keep signatures only for unchanged assignees; send a request notification to each newly assigned signer."""
    labels = dict(slots)
    signed = {k: v for k, v in (old_signed or {}).items() if new.get(k) and new.get(k) == (old or {}).get(k)}
    changed = [k for k in labels if new.get(k) and new.get(k) != (old or {}).get(k)]
    removed = [k for k in labels if (old or {}).get(k) and new.get(k) != (old or {}).get(k)]
    if removed:  # stale requests for reassigned/cleared slots
        await db.notifications.update_many({"doc_id": doc_id, "slot": {"$in": removed}, "type": "request", "read": False}, {"$set": {"read": True}})
    if not changed:
        return signed
    sigs = {s["id"]: s for s in await db.signatures.find({"id": {"$in": [new[k] for k in changed]}}, {"_id": 0}).to_list(50)}
    for k in changed:
        sig = sigs.get(new[k])
        if sig and sig.get("user_id"):
            await notify(sig["user_id"], "request", kind, doc_id, k, f"Permintaan tanda tangan · {KIND_LABEL[kind]}",
                         f"{actor['name']} meminta Anda menandatangani sebagai “{labels[k]}” pada {title}.", requested_by=actor["id"])
    return signed
