from pydantic import BaseModel


class UserOut(BaseModel):
    id: str
    email: str
    username: str
    role: str
    status: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserOut
