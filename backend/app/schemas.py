from typing import Literal

from pydantic import BaseModel, Field

Role = Literal["employee", "host", "admin", "guard", "superadmin"]


class LoginRequest(BaseModel):
    role: Role
    identifier: str = Field(min_length=1, max_length=255)
    password: str = Field(min_length=1, max_length=128)
    remember: bool = False


class UserOut(BaseModel):
    id: int
    full_name: str
    email: str
    employee_id: str
    role: Role

    model_config = {"from_attributes": True}


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserOut
