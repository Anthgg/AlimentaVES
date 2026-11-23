"""Fictitious donations for a local demo, never real VES records."""
from datetime import datetime, timedelta, timezone
from . import database as db

def seed_demo_if_empty() -> None:
    if db.donation_count() > 0:
        return
    expires_at = (datetime.now(timezone.utc) + timedelta(days=5)).isoformat()
    samples = [
        ("Donante ficticio A", "Arroz envasado", 12.0, "Punto de prueba A, Villa El Salvador"),
        ("Donante ficticio B", "Lentejas selladas", 5.0, "Punto de prueba B, Villa El Salvador"),
        ("Donante ficticio C", "Conservas sin abrir", 8.0, "Punto de prueba C, Villa El Salvador"),
    ]
    created = []
    for donor, food, kg, address in samples:
        created.append(db.create_donation({
            "donor_name": donor,
            "food_name": food,
            "quantity_kg": kg,
            "pickup_address": address,
            "expires_at": expires_at,
            "notes": "REGISTRO FICTICIO PARA DEMO",
        }))
    db.transition(created[1]["id"], "available", "reserved", "Comedor ficticio")
    db.transition(created[2]["id"], "available", "reserved", "Comedor ficticio")
    db.transition(created[2]["id"], "reserved", "delivered")
