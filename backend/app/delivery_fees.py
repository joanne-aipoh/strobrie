# Delivery pricing by Abuja area, keyed by method — pulled from Strobrie's
# own Loyverse "Bike Delivery" / "Car Delivery" product lists so checkout
# charges the same rates staff already use in person. This is the source of
# truth: the server recomputes the fee from (method, area) instead of
# trusting whatever the client sends, same as it already does for item
# prices. Mirror any changes here in frontend/src/shop/deliveryAreas.js.

BIKE_DELIVERY_FEES: dict[str, int] = {
    "Apo": 4000,
    "Apo Mechanic": 4000,
    "Apo Dutse": 4000,
    "Apo Extension": 4000,
    "Apo Legislative": 3000,
    "Apo Resettlement": 4000,
    "Apo Zone E": 3000,
    "Asokoro": 5000,
    "Baze University": 5000,
    "Citec": 4500,
    "Dawaki": 6000,
    "Durumi": 3000,
    "Gaduwa": 3500,
    "Galadimawa": 4000,
    "Games Village": 3500,
    "Garki": 2500,
    "Gudu": 3000,
    "Guzape": 5000,
    "Gwarimpa A": 6000,
    "Gwarimpa B": 7000,
    "Idu": 5000,
    "Jabi": 4000,
    "Jahi": 5000,
    "Kado": 4500,
    "Karu": 6000,
    "Katampe": 4500,
    "Katampe Extension": 5000,
    "Kubwa": 7000,
    "Kubwa Extension": 7000,
    "Life Camp": 5000,
    "Life Camp Extension": 6500,
    "Lifecamp B&H": 6500,
    "Lifecamp Paradise": 6500,
    "Lokogoma": 4000,
    "Lugbe": 5500,
    "Mabushi": 4000,
    "Maitama": 4000,
    "Mbora": 4500,
    "Mpape": 5000,
    "Nile University": 5000,
    "Prince & Princess": 3500,
    "Sun City": 4000,
    "Sunnyvale": 4500,
    "Three Arms Zone": 3000,
    "Utako": 3500,
    "Wuse": 3500,
    "Wuse II": 3500,
    "Wuye": 3500,
}

CAR_DELIVERY_FEES: dict[str, int] = {
    "Apo": 5000,
    "Apo Resettlement": 6000,
    "Asokoro": 5000,
    "Central Business District (CBD)": 4000,
    "Durumi": 4000,
    "Dutse": 10000,
    "Galadimawa": 5000,
    "Games Village": 5000,
    "Garki": 3500,
    "Gudu": 4000,
    "Guzape": 4000,
    "Gwarimpa": 8000,
    "Jabi": 5000,
    "Jahi": 6000,
    "Karu": 6000,
    "Katampe": 7000,
    "Katampe Extension": 8000,
    "Kubwa": 10000,
    "Life Camp": 7000,
    "Life Camp Extension": 8000,
    "Lokogoma": 6000,
    "Lugbe": 7000,
    "Lugbe Extension": 8000,
    "Mabushi": 5000,
    "Maitama": 5000,
    "Prince & Princess": 5000,
    "Wuse": 5000,
    "Wuye & Utako": 5000,
}

DELIVERY_FEES_BY_METHOD = {"bike": BIKE_DELIVERY_FEES, "car": CAR_DELIVERY_FEES}


def delivery_fee_for(method: str | None, area: str | None) -> int | None:
    """None means we don't deliver there — no unverified/out-of-area
    ("Other") option, delivery is strictly limited to this priced list so an
    order can't be placed for somewhere outside Abuja."""
    if not method or not area:
        return None
    return DELIVERY_FEES_BY_METHOD.get(method, {}).get(area)
