import os
import uuid
import json
import logging
import asyncio
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal, Dict, Set

import bcrypt
import jwt
import httpx
import stripe
from fastapi import FastAPI, APIRouter, HTTPException, Header, Request, Depends, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr
from dotenv import load_dotenv

from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
EMERGENT_LLM_KEY = os.environ["EMERGENT_LLM_KEY"]
STRIPE_API_KEY = os.environ.get("STRIPE_API_KEY", "sk_test_emergent")

stripe.api_key = STRIPE_API_KEY

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="TaskLocal API")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("tasklocal")


# ---------- Models ----------
def now_utc():
    return datetime.now(timezone.utc)


def uid(prefix="usr"):
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


class RegisterIn(BaseModel):
    email: EmailStr
    password: str
    name: str


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class GoogleSessionIn(BaseModel):
    session_token: str


class UserOut(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    role: Literal["customer", "provider", "admin"] = "customer"
    is_provider: bool = False
    provider_mode: bool = False


class ProviderApplyIn(BaseModel):
    business_name: str
    category_id: str
    bio: str
    hourly_rate: float
    services: List[str] = []
    phone: Optional[str] = None
    city: Optional[str] = None


class BookingIn(BaseModel):
    provider_id: str
    service: str
    scheduled_at: str  # ISO
    address: str
    notes: Optional[str] = None
    estimated_hours: float = 1.0


class BookingStatusIn(BaseModel):
    status: Literal["requested", "accepted", "en_route", "in_progress", "completed", "cancelled"]


class ChatIn(BaseModel):
    session_id: str
    message: str


class StripeCheckoutIn(BaseModel):
    booking_id: str


class ReviewIn(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: Optional[str] = None


# ---------- WebSocket Manager ----------
class BookingWSManager:
    def __init__(self):
        self.rooms: Dict[str, Set[WebSocket]] = {}

    async def connect(self, booking_id: str, ws: WebSocket):
        await ws.accept()
        self.rooms.setdefault(booking_id, set()).add(ws)

    def disconnect(self, booking_id: str, ws: WebSocket):
        room = self.rooms.get(booking_id)
        if room:
            room.discard(ws)
            if not room:
                self.rooms.pop(booking_id, None)

    async def broadcast(self, booking_id: str, payload: dict):
        room = self.rooms.get(booking_id)
        if not room:
            return
        dead = []
        for ws in list(room):
            try:
                await ws.send_json(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(booking_id, ws)


ws_manager = BookingWSManager()


def compute_eta_minutes(status: str, updated_at: Optional[datetime] = None) -> Optional[int]:
    """Simple ETA heuristic based on status."""
    if status == "accepted":
        return 25
    if status == "en_route":
        return 10
    if status == "in_progress":
        return 45  # est time to complete
    return None


# ---------- Auth Helpers ----------
def hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def check_pw(pw: str, h: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), h.encode())
    except Exception:
        return False


def make_jwt(user_id: str) -> str:
    return jwt.encode(
        {"user_id": user_id, "exp": datetime.now(timezone.utc) + timedelta(days=30)},
        JWT_SECRET,
        algorithm="HS256",
    )


async def _load_user(user_id: str) -> Optional[dict]:
    return await db.users.find_one({"user_id": user_id}, {"_id": 0})


async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Missing token")
    token = authorization[7:]

    # Try JWT first
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        user = await _load_user(payload["user_id"])
        if user:
            return user
    except Exception:
        pass

    # Try Emergent session token
    sess = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if sess:
        exp = sess.get("expires_at")
        if exp and exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if exp and exp > now_utc():
            user = await _load_user(sess["user_id"])
            if user:
                return user

    raise HTTPException(401, "Invalid token")


def user_to_out(u: dict) -> UserOut:
    return UserOut(
        user_id=u["user_id"],
        email=u["email"],
        name=u.get("name", ""),
        picture=u.get("picture"),
        role=u.get("role", "customer"),
        is_provider=u.get("is_provider", False),
        provider_mode=u.get("provider_mode", False),
    )


# ---------- Auth Endpoints ----------
@api.post("/auth/register")
async def register(inp: RegisterIn):
    existing = await db.users.find_one({"email": inp.email.lower()})
    if existing:
        raise HTTPException(400, "Email already registered")
    user_id = uid("user")
    doc = {
        "user_id": user_id,
        "email": inp.email.lower(),
        "name": inp.name,
        "password_hash": hash_pw(inp.password),
        "role": "customer",
        "is_provider": False,
        "provider_mode": False,
        "created_at": now_utc(),
    }
    await db.users.insert_one(doc)
    token = make_jwt(user_id)
    return {"token": token, "user": user_to_out(doc).dict()}


@api.post("/auth/login")
async def login(inp: LoginIn):
    u = await db.users.find_one({"email": inp.email.lower()})
    if not u or not check_pw(inp.password, u.get("password_hash", "")):
        raise HTTPException(401, "Invalid credentials")
    token = make_jwt(u["user_id"])
    return {"token": token, "user": user_to_out(u).dict()}


@api.post("/auth/google-session")
async def google_session(inp: GoogleSessionIn):
    """Verify Emergent OAuth session_token, upsert user, return token."""
    async with httpx.AsyncClient(timeout=15.0) as hc:
        r = await hc.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": inp.session_token},
        )
    if r.status_code != 200:
        raise HTTPException(401, "Google auth failed")
    data = r.json()
    email = (data.get("email") or "").lower()
    if not email:
        raise HTTPException(400, "No email from Google")

    existing = await db.users.find_one({"email": email})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"name": data.get("name") or existing.get("name"), "picture": data.get("picture")}},
        )
    else:
        user_id = uid("user")
        await db.users.insert_one({
            "user_id": user_id,
            "email": email,
            "name": data.get("name", email),
            "picture": data.get("picture"),
            "role": "customer",
            "is_provider": False,
            "provider_mode": False,
            "created_at": now_utc(),
        })

    session_token = data.get("session_token") or inp.session_token
    await db.user_sessions.update_one(
        {"session_token": session_token},
        {"$set": {
            "session_token": session_token,
            "user_id": user_id,
            "expires_at": now_utc() + timedelta(days=7),
            "created_at": now_utc(),
        }},
        upsert=True,
    )
    user = await _load_user(user_id)
    return {"token": session_token, "user": user_to_out(user).dict()}


@api.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return user_to_out(user).dict()


@api.post("/auth/logout")
async def logout(authorization: Optional[str] = Header(None)):
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:]
        await db.user_sessions.delete_one({"session_token": token})
    return {"ok": True}


# ---------- Categories & Providers ----------
@api.get("/categories")
async def get_categories():
    cats = await db.categories.find({}, {"_id": 0}).to_list(100)
    return cats


@api.get("/providers")
async def list_providers(category: Optional[str] = None, search: Optional[str] = None):
    q = {}
    if category and category != "all":
        q["category_id"] = category
    if search:
        q["$or"] = [
            {"business_name": {"$regex": search, "$options": "i"}},
            {"services": {"$regex": search, "$options": "i"}},
        ]
    providers = await db.providers.find(q, {"_id": 0}).sort("rating", -1).to_list(200)
    return providers


@api.get("/providers/{provider_id}")
async def get_provider(provider_id: str):
    p = await db.providers.find_one({"provider_id": provider_id}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Not found")
    return p


@api.post("/providers/apply")
async def apply_provider(inp: ProviderApplyIn, user=Depends(get_current_user)):
    existing = await db.providers.find_one({"user_id": user["user_id"]})
    if existing:
        # update
        await db.providers.update_one(
            {"user_id": user["user_id"]},
            {"$set": {**inp.dict(), "updated_at": now_utc()}},
        )
    else:
        pid = uid("prv")
        await db.providers.insert_one({
            "provider_id": pid,
            "user_id": user["user_id"],
            **inp.dict(),
            "rating": 5.0,
            "review_count": 0,
            "verified": False,
            "image": "https://images.pexels.com/photos/8961145/pexels-photo-8961145.jpeg?auto=compress&cs=tinysrgb&h=400",
            "distance_km": 2.5,
            "created_at": now_utc(),
        })
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"is_provider": True, "provider_mode": True}},
    )
    return {"ok": True}


@api.post("/users/provider-mode")
async def toggle_provider_mode(mode: dict, user=Depends(get_current_user)):
    enabled = bool(mode.get("enabled", False))
    if enabled and not user.get("is_provider"):
        raise HTTPException(400, "Not a provider yet")
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"provider_mode": enabled}})
    u = await _load_user(user["user_id"])
    return user_to_out(u).dict()


@api.get("/providers/mine/profile")
async def my_provider_profile(user=Depends(get_current_user)):
    p = await db.providers.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return p


# ---------- Bookings ----------
@api.post("/bookings")
async def create_booking(inp: BookingIn, user=Depends(get_current_user)):
    p = await db.providers.find_one({"provider_id": inp.provider_id}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Provider not found")
    bid = uid("bk")
    total = round(p["hourly_rate"] * inp.estimated_hours, 2)
    doc = {
        "booking_id": bid,
        "customer_id": user["user_id"],
        "customer_name": user.get("name", ""),
        "provider_id": inp.provider_id,
        "provider_name": p["business_name"],
        "service": inp.service,
        "scheduled_at": inp.scheduled_at,
        "address": inp.address,
        "notes": inp.notes,
        "estimated_hours": inp.estimated_hours,
        "hourly_rate": p["hourly_rate"],
        "total_amount": total,
        "status": "requested",
        "payment_status": "unpaid",
        "created_at": now_utc(),
    }
    await db.bookings.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.get("/bookings")
async def my_bookings(user=Depends(get_current_user)):
    docs = await db.bookings.find({"customer_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return docs


@api.get("/bookings/provider")
async def provider_bookings(user=Depends(get_current_user)):
    prv = await db.providers.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not prv:
        return []
    docs = await db.bookings.find({"provider_id": prv["provider_id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return docs


@api.patch("/bookings/{booking_id}/status")
async def update_booking_status(booking_id: str, inp: BookingStatusIn, user=Depends(get_current_user)):
    b = await db.bookings.find_one({"booking_id": booking_id}, {"_id": 0})
    if not b:
        raise HTTPException(404, "Not found")
    # Provider or customer can update; customers can only cancel
    prv = await db.providers.find_one({"user_id": user["user_id"]}, {"_id": 0})
    is_provider_of_booking = prv and prv["provider_id"] == b["provider_id"]
    is_customer = b["customer_id"] == user["user_id"]
    if not (is_provider_of_booking or is_customer):
        raise HTTPException(403, "Forbidden")
    if is_customer and not is_provider_of_booking and inp.status != "cancelled":
        raise HTTPException(403, "Customers can only cancel")
    now = now_utc()
    await db.bookings.update_one({"booking_id": booking_id}, {"$set": {"status": inp.status, "updated_at": now}})
    # Broadcast to WS subscribers
    await ws_manager.broadcast(booking_id, {
        "type": "status",
        "booking_id": booking_id,
        "status": inp.status,
        "eta_minutes": compute_eta_minutes(inp.status),
        "updated_at": now.isoformat(),
    })
    return {"ok": True}


@api.get("/bookings/{booking_id}")
async def get_booking(booking_id: str, user=Depends(get_current_user)):
    b = await db.bookings.find_one({"booking_id": booking_id}, {"_id": 0})
    if not b:
        raise HTTPException(404, "Not found")
    prv = await db.providers.find_one({"user_id": user["user_id"]}, {"_id": 0})
    is_prv = prv and prv["provider_id"] == b["provider_id"]
    if b["customer_id"] != user["user_id"] and not is_prv:
        raise HTTPException(403, "Forbidden")
    b["eta_minutes"] = compute_eta_minutes(b.get("status", "requested"))
    # attach provider snapshot
    prov = await db.providers.find_one({"provider_id": b["provider_id"]}, {"_id": 0})
    if prov:
        b["provider"] = {
            "provider_id": prov["provider_id"],
            "business_name": prov["business_name"],
            "image": prov.get("image"),
            "rating": prov.get("rating"),
            "hourly_rate": prov.get("hourly_rate"),
        }
    return b


# ---------- Reviews ----------
@api.post("/bookings/{booking_id}/review")
async def submit_review(booking_id: str, inp: ReviewIn, user=Depends(get_current_user)):
    b = await db.bookings.find_one({"booking_id": booking_id}, {"_id": 0})
    if not b:
        raise HTTPException(404, "Booking not found")
    if b["customer_id"] != user["user_id"]:
        raise HTTPException(403, "Only the customer can review")
    if b.get("status") != "completed":
        raise HTTPException(400, "Booking must be completed before reviewing")
    if await db.reviews.find_one({"booking_id": booking_id}):
        raise HTTPException(400, "Review already submitted")

    rev = {
        "review_id": uid("rev"),
        "booking_id": booking_id,
        "provider_id": b["provider_id"],
        "customer_id": user["user_id"],
        "customer_name": user.get("name", "Anonymous"),
        "rating": inp.rating,
        "comment": inp.comment,
        "created_at": now_utc(),
    }
    await db.reviews.insert_one(rev)
    await db.bookings.update_one({"booking_id": booking_id}, {"$set": {"review_id": rev["review_id"]}})

    # Recompute provider rating average
    cursor = db.reviews.find({"provider_id": b["provider_id"]}, {"_id": 0, "rating": 1})
    ratings = [r["rating"] async for r in cursor]
    if ratings:
        avg = round(sum(ratings) / len(ratings), 2)
        await db.providers.update_one(
            {"provider_id": b["provider_id"]},
            {"$set": {"rating": avg, "review_count": len(ratings)}},
        )
    rev.pop("_id", None)
    return rev


@api.get("/providers/{provider_id}/reviews")
async def list_reviews(provider_id: str):
    docs = await db.reviews.find({"provider_id": provider_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return docs


# ---------- AI Chat (streaming SSE) ----------
SYSTEM_PROMPT = (
    "You are TaskLocal's friendly AI concierge for a hyper-local service marketplace. "
    "Help users describe their problem and recommend the right service category "
    "(Home Repairs, Mobile EV Charging, or Specialized Tasks). "
    "Ask follow-up questions, be concise (max 3 sentences), warm and helpful. "
    "When appropriate, suggest a specific service like 'Plumber', 'Electrician', "
    "'Cleaning', 'EV Charging', 'Moving Help', 'Tutoring', or 'Pet Care'."
)


@api.post("/chat/stream")
async def chat_stream(inp: ChatIn, user=Depends(get_current_user)):
    session_id = inp.session_id
    await db.chat_messages.insert_one({
        "session_id": session_id, "user_id": user["user_id"],
        "role": "user", "content": inp.message, "created_at": now_utc(),
    })

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message=SYSTEM_PROMPT,
    ).with_model("anthropic", "claude-sonnet-4-6")

    async def gen():
        collected = []
        try:
            async for ev in chat.stream_message(UserMessage(text=inp.message)):
                if isinstance(ev, TextDelta):
                    collected.append(ev.content)
                    yield f"data: {ev.content}\n\n"
                elif isinstance(ev, StreamDone):
                    break
            yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: [ERROR] {str(e)}\n\n"
        finally:
            full = "".join(collected)
            if full:
                await db.chat_messages.insert_one({
                    "session_id": session_id, "user_id": user["user_id"],
                    "role": "assistant", "content": full, "created_at": now_utc(),
                })

    return StreamingResponse(gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@api.post("/chat")
async def chat_once(inp: ChatIn, user=Depends(get_current_user)):
    """Non-streaming version for web/mobile compatibility."""
    await db.chat_messages.insert_one({
        "session_id": inp.session_id, "user_id": user["user_id"],
        "role": "user", "content": inp.message, "created_at": now_utc(),
    })
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=inp.session_id,
        system_message=SYSTEM_PROMPT,
    ).with_model("anthropic", "claude-sonnet-4-6")

    text = ""
    try:
        async for ev in chat.stream_message(UserMessage(text=inp.message)):
            if isinstance(ev, TextDelta):
                text += ev.content
            elif isinstance(ev, StreamDone):
                break
    except Exception as e:
        raise HTTPException(500, f"AI error: {e}")

    await db.chat_messages.insert_one({
        "session_id": inp.session_id, "user_id": user["user_id"],
        "role": "assistant", "content": text, "created_at": now_utc(),
    })
    return {"reply": text}


@api.get("/chat/history/{session_id}")
async def chat_history(session_id: str, user=Depends(get_current_user)):
    msgs = await db.chat_messages.find(
        {"session_id": session_id, "user_id": user["user_id"]}, {"_id": 0}
    ).sort("created_at", 1).to_list(500)
    return msgs


# ---------- Stripe Checkout ----------
@api.post("/payments/checkout")
async def create_checkout(inp: StripeCheckoutIn, request: Request, user=Depends(get_current_user)):
    b = await db.bookings.find_one({"booking_id": inp.booking_id, "customer_id": user["user_id"]}, {"_id": 0})
    if not b:
        raise HTTPException(404, "Booking not found")
    if b.get("payment_status") == "paid":
        return {"already_paid": True}

    origin = request.headers.get("origin") or os.environ.get("EXPO_PACKAGER_HOSTNAME", "https://example.com")

    # Demo mode: placeholder Stripe key isn't a real functional test key.
    # Mark booking paid immediately so the full flow is demoable.
    # When a real sk_test_... key is added to /app/backend/.env, this branch is skipped.
    if not STRIPE_API_KEY or STRIPE_API_KEY == "sk_test_emergent" or not STRIPE_API_KEY.startswith("sk_"):
        await db.bookings.update_one(
            {"booking_id": b["booking_id"]},
            {"$set": {"payment_status": "paid", "paid_at": now_utc(), "payment_provider": "demo"}},
        )
        return {"demo": True, "payment_status": "paid", "message": "Demo payment (add real Stripe key to enable checkout)"}

    try:
        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[{
                "price_data": {
                    "currency": "usd",
                    "product_data": {"name": f"{b['service']} — {b['provider_name']}"},
                    "unit_amount": int(b["total_amount"] * 100),
                },
                "quantity": 1,
            }],
            mode="payment",
            success_url=f"{origin}/payment-return?status=success&booking_id={b['booking_id']}",
            cancel_url=f"{origin}/payment-return?status=cancel&booking_id={b['booking_id']}",
            metadata={"booking_id": b["booking_id"]},
        )
        await db.bookings.update_one(
            {"booking_id": b["booking_id"]},
            {"$set": {"stripe_session_id": session.id}},
        )
        return {"url": session.url, "session_id": session.id}
    except Exception as e:
        raise HTTPException(400, f"Stripe error: {e}")


@api.get("/payments/status/{booking_id}")
async def payment_status(booking_id: str, user=Depends(get_current_user)):
    b = await db.bookings.find_one({"booking_id": booking_id, "customer_id": user["user_id"]}, {"_id": 0})
    if not b:
        raise HTTPException(404, "Not found")
    sess_id = b.get("stripe_session_id")
    if not sess_id:
        return {"payment_status": b.get("payment_status", "unpaid")}
    try:
        s = stripe.checkout.Session.retrieve(sess_id)
        if s.payment_status == "paid" and b.get("payment_status") != "paid":
            await db.bookings.update_one(
                {"booking_id": booking_id},
                {"$set": {"payment_status": "paid", "paid_at": now_utc()}},
            )
        return {"payment_status": s.payment_status}
    except Exception as e:
        return {"payment_status": b.get("payment_status", "unpaid"), "error": str(e)}


# ---------- Admin ----------
@api.get("/admin/stats")
async def admin_stats(user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(403, "Admin only")
    users = await db.users.count_documents({})
    providers = await db.providers.count_documents({})
    bookings = await db.bookings.count_documents({})
    unverified = await db.providers.count_documents({"verified": False})
    return {"users": users, "providers": providers, "bookings": bookings, "unverified": unverified}


@api.get("/admin/providers")
async def admin_providers(user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(403, "Admin only")
    return await db.providers.find({}, {"_id": 0}).to_list(500)


@api.patch("/admin/providers/{provider_id}/verify")
async def admin_verify(provider_id: str, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(403, "Admin only")
    await db.providers.update_one({"provider_id": provider_id}, {"$set": {"verified": True}})
    return {"ok": True}


# ---------- Seed ----------
SEED_CATEGORIES = [
    {"category_id": "home_repairs", "name": "Home Repairs", "icon": "wrench", "color": "#C65D47",
     "image": "https://images.pexels.com/photos/8488035/pexels-photo-8488035.jpeg?auto=compress&cs=tinysrgb&h=650&w=940",
     "services": ["Plumber", "Electrician", "Handyman", "Painter", "Carpenter"]},
    {"category_id": "ev_charging", "name": "Mobile EV Charging", "icon": "bolt", "color": "#4D7C5D",
     "image": "https://images.pexels.com/photos/4678065/pexels-photo-4678065.jpeg?auto=compress&cs=tinysrgb&h=650&w=940",
     "services": ["Emergency Charge", "Scheduled Charging", "Fleet Service"]},
    {"category_id": "specialized", "name": "Specialized Tasks", "icon": "sparkle", "color": "#D99530",
     "image": "https://images.pexels.com/photos/4108714/pexels-photo-4108714.jpeg?auto=compress&cs=tinysrgb&h=650&w=940",
     "services": ["Moving Help", "Tutoring", "Pet Care", "House Cleaning", "Assembly"]},
]

SEED_PROVIDERS = [
    {"business_name": "Rivera Plumbing Co.", "category_id": "home_repairs", "bio": "20+ years fixing leaks, drains, and water heaters across the city.",
     "hourly_rate": 75, "services": ["Plumber", "Handyman"], "rating": 4.9, "review_count": 342, "city": "Downtown",
     "image": "https://images.pexels.com/photos/8486944/pexels-photo-8486944.jpeg?auto=compress&cs=tinysrgb&h=400", "distance_km": 1.2},
    {"business_name": "SparkFix Electric", "category_id": "home_repairs", "bio": "Licensed electricians for outlets, panels, EV chargers, and smart home wiring.",
     "hourly_rate": 90, "services": ["Electrician", "EV Wiring"], "rating": 4.8, "review_count": 218, "city": "Midtown",
     "image": "https://images.pexels.com/photos/5691659/pexels-photo-5691659.jpeg?auto=compress&cs=tinysrgb&h=400", "distance_km": 2.8},
    {"business_name": "HandyPro Solutions", "category_id": "home_repairs", "bio": "Your one-stop shop for small home repairs, mounting, and assembly.",
     "hourly_rate": 55, "services": ["Handyman", "Assembly", "Painter"], "rating": 4.7, "review_count": 156, "city": "Eastside",
     "image": "https://images.pexels.com/photos/834892/pexels-photo-834892.jpeg?auto=compress&cs=tinysrgb&h=400", "distance_km": 3.5},
    {"business_name": "ChargeGo EV", "category_id": "ev_charging", "bio": "Mobile EV charging that comes to you — Tesla, Rivian, and CCS compatible.",
     "hourly_rate": 60, "services": ["Emergency Charge", "Scheduled Charging"], "rating": 5.0, "review_count": 89, "city": "Downtown",
     "image": "https://images.pexels.com/photos/9800030/pexels-photo-9800030.jpeg?auto=compress&cs=tinysrgb&h=400", "distance_km": 0.9},
    {"business_name": "VoltRoam", "category_id": "ev_charging", "bio": "24/7 emergency EV charging service — 30 min average response time.",
     "hourly_rate": 70, "services": ["Emergency Charge", "Fleet Service"], "rating": 4.9, "review_count": 124, "city": "Airport",
     "image": "https://images.pexels.com/photos/4079260/pexels-photo-4079260.jpeg?auto=compress&cs=tinysrgb&h=400", "distance_km": 4.1},
    {"business_name": "PowerUp Roadside", "category_id": "ev_charging", "bio": "Fast mobile charging with real-time tracking. Fleet subscriptions available.",
     "hourly_rate": 65, "services": ["Scheduled Charging", "Fleet Service"], "rating": 4.7, "review_count": 67, "city": "West End",
     "image": "https://images.pexels.com/photos/9800021/pexels-photo-9800021.jpeg?auto=compress&cs=tinysrgb&h=400", "distance_km": 5.6},
    {"business_name": "MoveMates", "category_id": "specialized", "bio": "Two-person moving crews for apartments and small homes. Loaded in an hour.",
     "hourly_rate": 80, "services": ["Moving Help", "Assembly"], "rating": 4.8, "review_count": 245, "city": "Downtown",
     "image": "https://images.pexels.com/photos/7464230/pexels-photo-7464230.jpeg?auto=compress&cs=tinysrgb&h=400", "distance_km": 2.0},
    {"business_name": "BrightLearn Tutors", "category_id": "specialized", "bio": "In-home tutoring K-12: math, science, and test prep from top educators.",
     "hourly_rate": 45, "services": ["Tutoring"], "rating": 4.9, "review_count": 178, "city": "Uptown",
     "image": "https://images.pexels.com/photos/5905921/pexels-photo-5905921.jpeg?auto=compress&cs=tinysrgb&h=400", "distance_km": 3.1},
    {"business_name": "PawPals Pet Care", "category_id": "specialized", "bio": "Walks, sitting, and overnight care. All sitters are background-checked.",
     "hourly_rate": 35, "services": ["Pet Care"], "rating": 5.0, "review_count": 412, "city": "Riverside",
     "image": "https://images.pexels.com/photos/1345191/pexels-photo-1345191.jpeg?auto=compress&cs=tinysrgb&h=400", "distance_km": 1.5},
    {"business_name": "Sparkle Home Cleaning", "category_id": "specialized", "bio": "Eco-friendly deep cleans, weekly service, and move-out cleaning.",
     "hourly_rate": 50, "services": ["House Cleaning"], "rating": 4.8, "review_count": 289, "city": "Midtown",
     "image": "https://images.pexels.com/photos/4108714/pexels-photo-4108714.jpeg?auto=compress&cs=tinysrgb&h=400", "distance_km": 2.4},
    {"business_name": "Peak Paint & Trim", "category_id": "home_repairs", "bio": "Interior and exterior painting with premium brands. Free color consult.",
     "hourly_rate": 65, "services": ["Painter", "Carpenter"], "rating": 4.6, "review_count": 92, "city": "Northside",
     "image": "https://images.pexels.com/photos/8092/pexels-photo.jpg?auto=compress&cs=tinysrgb&h=400", "distance_km": 6.2},
    {"business_name": "AssemblyAce", "category_id": "specialized", "bio": "IKEA, furniture, and gym equipment assembly. Flat-rate pricing available.",
     "hourly_rate": 55, "services": ["Assembly", "Moving Help"], "rating": 4.7, "review_count": 134, "city": "Downtown",
     "image": "https://images.pexels.com/photos/5691656/pexels-photo-5691656.jpeg?auto=compress&cs=tinysrgb&h=400", "distance_km": 1.9},
]


async def seed():
    # Indexes
    try:
        await db.users.create_index("email", unique=True)
        await db.users.create_index("user_id", unique=True)
        await db.user_sessions.create_index("session_token", unique=True)
        await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)
        await db.providers.create_index("provider_id", unique=True)
        await db.bookings.create_index("booking_id", unique=True)
    except Exception as e:
        log.warning(f"Index warn: {e}")

    if await db.categories.count_documents({}) == 0:
        await db.categories.insert_many([{**c} for c in SEED_CATEGORIES])
        log.info("Seeded categories")

    if await db.providers.count_documents({}) == 0:
        docs = []
        for i, p in enumerate(SEED_PROVIDERS):
            docs.append({
                "provider_id": uid("prv"),
                "user_id": None,
                "verified": True,
                "created_at": now_utc(),
                **p,
            })
        await db.providers.insert_many(docs)
        log.info(f"Seeded {len(docs)} providers")

    # Admin user
    admin_email = "admin@tasklocal.app"
    if not await db.users.find_one({"email": admin_email}):
        await db.users.insert_one({
            "user_id": uid("admin"),
            "email": admin_email,
            "name": "Admin",
            "password_hash": hash_pw("Admin@12345"),
            "role": "admin",
            "is_provider": False,
            "provider_mode": False,
            "created_at": now_utc(),
        })
        log.info("Seeded admin user")

    # Demo customer
    demo_email = "demo@tasklocal.app"
    if not await db.users.find_one({"email": demo_email}):
        await db.users.insert_one({
            "user_id": uid("user"),
            "email": demo_email,
            "name": "Demo Customer",
            "password_hash": hash_pw("Demo@12345"),
            "role": "customer",
            "is_provider": False,
            "provider_mode": False,
            "created_at": now_utc(),
        })
        log.info("Seeded demo user")


@app.on_event("startup")
async def startup():
    await seed()


@app.on_event("shutdown")
async def shutdown():
    client.close()


@api.get("/")
async def root():
    return {"ok": True, "app": "TaskLocal API"}


app.include_router(api)


# ---------- WebSocket: booking live status ----------
async def _authenticate_ws_token(token: str) -> Optional[dict]:
    if not token:
        return None
    # JWT first
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return await _load_user(payload["user_id"])
    except Exception:
        pass
    # Session token
    sess = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if sess:
        exp = sess.get("expires_at")
        if exp and exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if exp and exp > now_utc():
            return await _load_user(sess["user_id"])
    return None


@app.websocket("/api/ws/bookings/{booking_id}")
async def ws_booking(websocket: WebSocket, booking_id: str, token: str = ""):
    user = await _authenticate_ws_token(token)
    if not user:
        await websocket.close(code=4401)
        return
    b = await db.bookings.find_one({"booking_id": booking_id}, {"_id": 0})
    if not b:
        await websocket.close(code=4404)
        return
    prv = await db.providers.find_one({"user_id": user["user_id"]}, {"_id": 0})
    is_prv = prv and prv["provider_id"] == b["provider_id"]
    if b["customer_id"] != user["user_id"] and not is_prv:
        await websocket.close(code=4403)
        return

    await ws_manager.connect(booking_id, websocket)
    # send initial snapshot
    try:
        await websocket.send_json({
            "type": "snapshot",
            "booking_id": booking_id,
            "status": b.get("status"),
            "eta_minutes": compute_eta_minutes(b.get("status", "requested")),
        })
        while True:
            # Keep-alive; ignore incoming pings/messages
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        ws_manager.disconnect(booking_id, websocket)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
