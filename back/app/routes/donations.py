from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, status

from .. import database as db
from ..schemas import DonationCreate, DonationOut, DonationStatus, ReservationCreate

router = APIRouter(prefix="/donations", tags=["Donaciones"])


def require_donation(donation_id: str) -> dict:
    donation = db.get_donation(donation_id)
    if donation is None:
        raise HTTPException(status_code=404, detail="Donación no encontrada")
    return donation


@router.get("", response_model=list[DonationOut])
def get_all(status: DonationStatus | None = None):
    return db.list_donations(status.value if status is not None else None)


@router.post("", response_model=DonationOut, status_code=status.HTTP_201_CREATED)
def create(payload: DonationCreate):
    return db.create_donation(payload.model_dump())


@router.get("/{donation_id}", response_model=DonationOut)
def get_one(donation_id: str):
    return require_donation(donation_id)


@router.patch("/{donation_id}/reserve", response_model=DonationOut)
def reserve(donation_id: str, payload: ReservationCreate):
    donation = require_donation(donation_id)
    if donation["status"] != "available":
        raise HTTPException(status_code=409, detail="La donación ya no está disponible")
    if donation["expires_at"] <= datetime.now(timezone.utc):
        raise HTTPException(status_code=409, detail="La donación está vencida")
    updated = db.transition(donation_id, "available", "reserved", payload.reserved_by)
    if updated is None:
        raise HTTPException(
            status_code=409,
            detail="La donación fue reservada por otro comedor o está vencida",
        )
    return updated


@router.patch("/{donation_id}/deliver", response_model=DonationOut)
def deliver(donation_id: str):
    require_donation(donation_id)
    updated = db.transition(donation_id, "reserved", "delivered")
    if updated is None:
        raise HTTPException(
            status_code=409, detail="Solo se puede entregar una donación reservada"
        )
    return updated
