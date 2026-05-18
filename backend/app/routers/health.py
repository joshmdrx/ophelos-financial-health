from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health", operation_id="getHealth")
def health() -> dict[str, str]:
    return {"status": "ok"}
