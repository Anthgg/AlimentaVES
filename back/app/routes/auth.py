"""Registration, login, logout, and current-user routes."""

from fastapi import APIRouter, Depends, HTTPException, Response, status

from .. import database as db
from ..auth import (
    AuthenticatedUser,
    create_access_token,
    dummy_password_hash,
    get_current_user,
    hash_password,
    unauthorized_error,
    verify_password,
)
from ..auth_schemas import LoginIn, RegisterIn, TokenOut, UserOut

router = APIRouter(prefix="/auth", tags=["Autenticación"])


@router.post(
    "/register",
    response_model=UserOut,
    status_code=status.HTTP_201_CREATED,
    summary="Registrar una cuenta donante",
)
def register(payload: RegisterIn):
    user = db.create_donor_user(
        str(payload.email),
        hash_password(payload.password.get_secret_value()),
    )
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe una cuenta con ese correo",
        )
    return user


@router.post(
    "/login",
    response_model=TokenOut,
    summary="Iniciar sesión",
)
def login(payload: LoginIn):
    user = db.get_auth_user_by_email(str(payload.email))
    stored_hash = user["password_hash"] if user is not None else dummy_password_hash()
    password_matches = verify_password(
        payload.password.get_secret_value(), stored_hash
    )
    if user is None or not user["is_active"] or not password_matches:
        raise unauthorized_error()

    token, _token_jti, _expires_at, expires_in = create_access_token(user["id"])
    return {
        "access_token": token,
        "token_type": "bearer",
        "expires_in": expires_in,
    }


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    summary="Cerrar sesión e invalidar el token",
)
def logout(current_user: AuthenticatedUser = Depends(get_current_user)) -> Response:
    db.revoke_auth_token(
        current_user.id,
        current_user.token_jti,
        current_user.token_expires_at,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/me",
    response_model=UserOut,
    summary="Consultar la cuenta autenticada",
)
def me(current_user: AuthenticatedUser = Depends(get_current_user)) -> UserOut:
    return UserOut(
        id=current_user.id,
        email=current_user.email,
        role=current_user.role,
        created_at=current_user.created_at,
    )
