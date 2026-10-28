from typing import Literal

from fastapi import APIRouter, Depends, HTTPException

from lib.approvals import KIND_LABEL, notify
from lib.auth import current_user, now_iso
from lib.db import db
from models.schemas import ApprovalRejection, ApprovalState, NotificationList, PendingApproval, RejectIn, SignIn
from routers.signatures import HPP_SLOTS, PACKAGING_SLOTS, approval_status

router = APIRouter(tags=["approvals"])
SLOTS = {"hpp": HPP_SLOTS, "packaging": PACKAGING_SLOTS}


def _coll(kind: str):
    return db.hpp if kind == "hpp" else db.packaging


def _title(kind: str, d: dict) -> str:
    return f"{d.get('code_item', '')} · {d['buyer']}" if kind == "hpp" else f"{d.get('item_name') or 'Packaging'} · {d['buyer']}"


@router.get("/notifications", response_model=NotificationList)
async def my_notifications(user: dict = Depends(current_user)):
    items = await db.notifications.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).limit(30).to_list(30)
    unread = await db.notifications.count_documents({"user_id": user["id"], "read": False})
    return NotificationList(items=items, unread=unread)


@router.post("/notifications/read-all")
async def read_all(user: dict = Depends(current_user)):
    await db.notifications.update_many({"user_id": user["id"], "read": False}, {"$set": {"read": True}})
    return {"ok": True}


@router.post("/notifications/{id}/read")
async def read_one(id: str, user: dict = Depends(current_user)):
    res = await db.notifications.update_one({"id": id, "user_id": user["id"]}, {"$set": {"read": True}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notifikasi tidak ditemukan")
    return {"ok": True}


@router.get("/approvals/pending", response_model=list[PendingApproval])
async def pending(user: dict = Depends(current_user)):
    my_ids = [s["id"] for s in await db.signatures.find({"user_id": user["id"]}, {"_id": 0, "id": 1}).to_list(50)]
    if not my_ids:
        return []
    out: list[PendingApproval] = []
    for kind, slots in SLOTS.items():
        flt = {"$or": [{f"approvals.{k}": {"$in": my_ids}} for k, _ in slots]}
        flt["approval_status"] = {"$ne": "rejected"}
        async for d in _coll(kind).find(flt, {"_id": 0, "lines": 0}).sort("date", -1):
            for k, label in slots:
                if (d.get("approvals") or {}).get(k) in my_ids and not (d.get("approval_signed") or {}).get(k):
                    out.append(PendingApproval(kind=kind, doc_id=d["id"], slot=k, slot_label=label, title=_title(kind, d),
                                               buyer=d["buyer"], date=d["date"], approval_status=d.get("approval_status", "partial")))
    return out


@router.post("/approvals/{kind}/{id}/sign", response_model=ApprovalState)
async def sign(kind: Literal["hpp", "packaging"], id: str, body: SignIn, user: dict = Depends(current_user)):
    slots = SLOTS[kind]
    labels = dict(slots)
    if body.slot not in labels:
        raise HTTPException(status_code=422, detail="Kolom approval tidak valid")
    d = await _coll(kind).find_one({"id": id}, {"_id": 0, "lines": 0})
    if not d:
        raise HTTPException(status_code=404, detail=f"{KIND_LABEL[kind]} tidak ditemukan")
    approvals, signed = d.get("approvals") or {}, dict(d.get("approval_signed") or {})
    sig_id = approvals.get(body.slot)
    if not sig_id:
        raise HTTPException(status_code=409, detail="Penandatangan untuk kolom ini belum dipilih")
    sig = await db.signatures.find_one({"id": sig_id}, {"_id": 0})
    if not sig or sig.get("user_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Hanya pemilik tanda tangan yang dapat menandatangani kolom ini")
    if d.get("approval_status") == "rejected":
        raise HTTPException(status_code=409, detail="Dokumen sedang dikembalikan untuk revisi — tunggu permintaan tanda tangan baru")
    if signed.get(body.slot):
        raise HTTPException(status_code=409, detail="Kolom ini sudah ditandatangani")
    signed[body.slot] = now_iso()
    status = approval_status(approvals, slots, signed)
    await _coll(kind).update_one({"id": id}, {"$set": {"approval_signed": signed, "approval_status": status}})
    await db.notifications.update_many({"user_id": user["id"], "doc_id": id, "slot": body.slot, "type": "request"}, {"$set": {"read": True}})
    req = await db.notifications.find_one({"doc_id": id, "slot": body.slot, "type": "request", "requested_by": {"$ne": None}}, {"_id": 0},
                                          sort=[("created_at", -1)])
    title = _title(kind, d)
    if req and req["requested_by"] != user["id"]:
        msg = f"{user['name']} menandatangani “{labels[body.slot]}” pada {title}."
        if status == "approved":
            msg += " Semua tanda tangan lengkap — status Approved."
        await notify(req["requested_by"], "signed", kind, id, body.slot, f"Tanda tangan diterima · {KIND_LABEL[kind]}", msg)
    return ApprovalState(approval_status=status, approval_signed=signed)


@router.post("/approvals/{kind}/{id}/reject", response_model=ApprovalState)
async def reject(kind: Literal["hpp", "packaging"], id: str, body: RejectIn, user: dict = Depends(current_user)):
    """Signer returns the document for revision: signatures reset, requester + earlier signers notified."""
    slots = SLOTS[kind]
    labels = dict(slots)
    if body.slot not in labels:
        raise HTTPException(status_code=422, detail="Kolom approval tidak valid")
    reason = body.reason.strip()
    if len(reason) < 3:
        raise HTTPException(status_code=422, detail="Alasan penolakan minimal 3 karakter")
    d = await _coll(kind).find_one({"id": id}, {"_id": 0, "lines": 0})
    if not d:
        raise HTTPException(status_code=404, detail=f"{KIND_LABEL[kind]} tidak ditemukan")
    approvals, signed = d.get("approvals") or {}, d.get("approval_signed") or {}
    sig_id = approvals.get(body.slot)
    if not sig_id:
        raise HTTPException(status_code=409, detail="Penandatangan untuk kolom ini belum dipilih")
    sig = await db.signatures.find_one({"id": sig_id}, {"_id": 0})
    if not sig or sig.get("user_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Hanya pemilik tanda tangan yang dapat menolak kolom ini")
    if d.get("approval_status") == "rejected":
        raise HTTPException(status_code=409, detail="Dokumen sudah dikembalikan untuk revisi")
    if signed.get(body.slot):
        raise HTTPException(status_code=409, detail="Kolom ini sudah ditandatangani")
    rejection = ApprovalRejection(slot=body.slot, slot_label=labels[body.slot], reason=reason, by_name=user["name"], by_user_id=user["id"], at=now_iso())
    await _coll(kind).update_one({"id": id}, {"$set": {"approval_status": "rejected", "approval_signed": {}, "approval_rejection": rejection.model_dump()}})
    await db.notifications.update_many({"doc_id": id, "type": "request", "read": False}, {"$set": {"read": True}})
    title = _title(kind, d)
    msg = f"{user['name']} ({labels[body.slot]}) menolak {title}. Alasan: “{reason}”. Silakan revisi lalu simpan untuk mengirim ulang permintaan tanda tangan."
    recipients: set[str] = set()
    async for n in db.notifications.find({"doc_id": id, "type": "request", "requested_by": {"$ne": None}}, {"_id": 0, "requested_by": 1}):
        recipients.add(n["requested_by"])
    signer_ids = [approvals[k] for k in signed if approvals.get(k)]
    async for sg in db.signatures.find({"id": {"$in": signer_ids}, "user_id": {"$ne": None}}, {"_id": 0, "user_id": 1}):
        recipients.add(sg["user_id"])
    recipients.discard(user["id"])
    for uid in recipients:
        await notify(uid, "rejected", kind, id, body.slot, f"Ditolak — perlu revisi · {KIND_LABEL[kind]}", msg)
    return ApprovalState(approval_status="rejected", approval_signed={})
