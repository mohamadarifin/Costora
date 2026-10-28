"""All Pydantic v2 models. Mirrored by hand in frontend/src/lib/types.ts — keep in sync."""

import uuid
from typing import Literal, Optional

from pydantic import BaseModel, Field

Role = Literal["admin", "marketing", "rnd"]
SectionKey = Literal["material", "additional", "finishing", "packing", "cushion", "upah_kerja", "outsourcing"]


def new_id() -> str:
    return str(uuid.uuid4())


# ---------- auth / users ----------
class LoginIn(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    id: str
    email: str
    name: str
    role: Role
    active: bool = True
    created_at: str = ""


class UserCreate(BaseModel):
    email: str = Field(min_length=3)
    name: str = Field(min_length=1)
    role: Role
    password: str = Field(min_length=6)


class UserUpdate(BaseModel):
    name: str = Field(min_length=1)
    role: Role
    active: bool = True
    password: Optional[str] = None


# ---------- materials ----------
class MaterialIn(BaseModel):
    category: str = Field(min_length=1)
    item: str = Field(min_length=1)
    size: str = ""
    price: float = 0
    price2: Optional[float] = None
    price_raw: Optional[float] = None
    unit: str = ""
    note: str = ""


class Material(MaterialIn):
    id: str = Field(default_factory=new_id)
    order: int = 0


class MaterialPage(BaseModel):
    items: list[Material]
    total: int


class CategoryCount(BaseModel):
    category: str
    count: int


# ---------- labor ----------
class LaborItem(BaseModel):
    id: str = Field(default_factory=new_id)
    label: str
    unit: str = ""
    rates: dict[str, Optional[float]] = {}


class LaborGroupIn(BaseModel):
    name: str = Field(min_length=1)
    increases: dict[str, float] = {}
    items: list[LaborItem] = []


class LaborGroup(LaborGroupIn):
    id: str = Field(default_factory=new_id)
    no: int = 0
    order: int = 0


class AddYearIn(BaseModel):
    year: int = Field(ge=2000, le=2100)


# ---------- HPP ----------
class HppLine(BaseModel):
    id: str = Field(default_factory=new_id)
    section: SectionKey
    spec: str = ""
    item: str = Field(min_length=1)
    material_id: Optional[str] = None
    labor_ref: Optional[str] = None
    volume: float = 0
    unit: str = ""
    price: float = 0
    mode: Literal["mul", "div"] = "mul"
    total: float = 0


class HppTotals(BaseModel):
    sections: dict[str, float] = {}
    net_cost: float = 0
    rounding: float = 0
    ongkos_bahan: float = 0
    hpp_total: float = 0


class HppIn(BaseModel):
    code_item: str = Field(min_length=1)
    colour: str = ""
    buyer: str = Field(min_length=1)
    type: str = ""
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    tw: float = 0
    td: float = 0
    th: float = 0
    labor_year: int = 2026
    markup: float = Field(default=0.32, ge=0, le=5)
    notes: str = ""
    lines: list[HppLine] = []
    approvals: dict[str, Optional[str]] = {}


class Hpp(HppIn):
    id: str = Field(default_factory=new_id)
    month: str = ""
    totals: HppTotals = HppTotals()
    approval_status: str = "draft"
    approval_signed: dict[str, str] = {}
    source: str = "manual"
    created_by: str = ""
    created_at: str = ""
    updated_at: str = ""


class HppSummary(BaseModel):
    id: str
    code_item: str
    colour: str = ""
    buyer: str
    type: str = ""
    date: str
    month: str
    totals: HppTotals
    approval_status: str = "draft"
    source: str = "manual"
    created_by: str = ""
    updated_at: str = ""


# ---------- packaging ----------
class PackagingIn(BaseModel):
    hpp_id: Optional[str] = None
    buyer: str = Field(min_length=1)
    item_name: str = ""
    color: str = ""
    po_no: str = ""
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    etd: str = ""
    produksi_sample: str = ""
    ros_rop: str = ""
    keterangan: str = ""
    checks: list[str] = []
    details: dict[str, str] = {}
    marking: bool = False
    label: bool = False
    notes: str = ""
    sign_marketing: str = ""
    sign_dibuat_rnd: str = ""
    sign_mengetahui_rnd: str = ""
    approvals: dict[str, Optional[str]] = {}


class Packaging(PackagingIn):
    id: str = Field(default_factory=new_id)
    month: str = ""
    approval_status: str = "draft"
    approval_signed: dict[str, str] = {}
    source: str = "manual"
    created_by: str = ""
    created_at: str = ""
    updated_at: str = ""


# ---------- attachments / import ----------
class Attachment(BaseModel):
    id: str = Field(default_factory=new_id)
    owner_type: Literal["hpp", "packaging"]
    owner_id: str
    filename: str
    content_type: str = ""
    size: int = 0
    stored_name: str = ""
    uploaded_by: str = ""
    created_at: str = ""


class ImportResult(BaseModel):
    hpp_id: str
    packaging_id: str
    lines_imported: int
    attachments: int
    warnings: list[str] = []


# ---------- dashboard / reports ----------
class Kpis(BaseModel):
    hpp_count: int
    buyer_count: int
    packaging_count: int
    material_count: int
    total_hpp: float
    avg_hpp: float
    month_hpp_count: int
    current_month: str


class MonthPoint(BaseModel):
    month: str
    count: int
    total_hpp: float


class BuyerPoint(BaseModel):
    buyer: str
    count: int
    total_hpp: float


class SectionPoint(BaseModel):
    section: str
    total: float


class ActivityPoint(BaseModel):
    date: str
    hpp: int
    packaging: int


class Signature(BaseModel):
    id: str = Field(default_factory=new_id)
    name: str
    position: str = ""
    user_id: Optional[str] = None
    stored_name: str = ""
    content_type: str = ""
    created_by: str = ""
    created_at: str = ""


class Dashboard(BaseModel):
    activity: list[ActivityPoint] = []
    approved_count: int = 0
    generated_at: str = ""
    kpis: Kpis
    monthly: list[MonthPoint]
    buyers: list[BuyerPoint]
    sections: list[SectionPoint]
    recent: list[HppSummary]


class BuyerReportRow(BaseModel):
    buyer: str
    count: int
    total_net: float
    total_hpp: float
    avg_hpp: float
    packaging_count: int
    items: list[HppSummary]


class MonthReportRow(BaseModel):
    month: str
    count: int
    buyer_count: int
    total_net: float
    total_hpp: float
    packaging_count: int
    items: list[HppSummary]


class SignatureUpdate(BaseModel):
    name: str = Field(min_length=1)
    position: str = ""
    user_id: Optional[str] = None


class UserBrief(BaseModel):
    id: str
    name: str
    email: str


class Notification(BaseModel):
    id: str
    user_id: str
    type: Literal["request", "signed"]
    kind: Literal["hpp", "packaging"]
    doc_id: str
    slot: str
    title: str
    message: str
    link: str
    requested_by: Optional[str] = None
    read: bool = False
    created_at: str


class NotificationList(BaseModel):
    items: list[Notification]
    unread: int


class PendingApproval(BaseModel):
    kind: Literal["hpp", "packaging"]
    doc_id: str
    slot: str
    slot_label: str
    title: str
    buyer: str
    date: str
    approval_status: str


class SignIn(BaseModel):
    slot: str


class ApprovalState(BaseModel):
    approval_status: str
    approval_signed: dict[str, str]
