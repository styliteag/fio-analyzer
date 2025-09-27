"""
User management API endpoints
"""

from typing import List, Optional

import bcrypt
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from auth.authentication import parse_htpasswd
from auth.middleware import require_admin, require_auth
from config.settings import settings
from utils.logging import log_error, log_info, log_warning

router = APIRouter(prefix="/api/users", tags=["users"])


class UserCreate(BaseModel):
    username: str = Field(..., min_length=1, max_length=50, pattern="^[a-zA-Z0-9_-]+$")
    password: str = Field(..., min_length=4, max_length=100)
    role: str = Field(..., pattern="^(admin|uploader)$")


class UserUpdate(BaseModel):
    password: Optional[str] = Field(None, min_length=4, max_length=100)
    role: Optional[str] = Field(None, pattern="^(admin|uploader)$")


class UserResponse(BaseModel):
    username: str
    role: str


class CurrentUserResponse(BaseModel):
    username: str
    role: str


def hash_password(password: str) -> str:
    """Hash password using bcrypt"""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def get_file_path_for_role(role: str) -> Path:
    """Get the appropriate file path for user role"""
    return settings.htpasswd_path if role == "admin" else settings.htuploaders_path


def get_all_users() -> List[UserResponse]:
    """Get all users from both admin and uploader files"""
    users = []

    # Get admin users
    admin_users = parse_htpasswd(settings.htpasswd_path) or {}
    for username in admin_users.keys():
        users.append(UserResponse(username=username, role="admin"))

    # Get uploader users
    uploader_users = parse_htpasswd(settings.htuploaders_path) or {}
    for username in uploader_users.keys():
        users.append(UserResponse(username=username, role="uploader"))

    return sorted(users, key=lambda x: x.username)


def write_users_to_file(users: dict, file_path: Path):
    """Write users dictionary to htpasswd file"""
    try:
        file_path.parent.mkdir(parents=True, exist_ok=True)
        with open(file_path, "w") as f:
            for username, password_hash in users.items():
                f.write(f"{username}:{password_hash}\n")
    except Exception as e:
        log_error(f"Failed to write users to {file_path}", e)
        raise HTTPException(status_code=500, detail="Failed to save user data")


def validate_user_operation(username: str, current_username: str, operation: str):
    """Validate user operations to prevent dangerous actions"""
    if operation == "delete" and username == current_username:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")

    # Check if trying to delete the last admin
    if operation == "delete":
        admin_users = parse_htpasswd(settings.htpasswd_path) or {}
        if len(admin_users) <= 1 and username in admin_users:
            raise HTTPException(status_code=400, detail="Cannot delete the last admin user")


@router.get("/", response_model=List[UserResponse])
async def list_users(current_user=Depends(require_admin)):
    """List all users (admin only)"""
    try:
        users = get_all_users()
        log_info(
            "User list retrieved",
            {"requested_by": current_user.username, "user_count": len(users)},
        )
        return users
    except Exception as e:
        log_error("Failed to list users", e)
        raise HTTPException(status_code=500, detail="Failed to retrieve users")


@router.get("/me", response_model=CurrentUserResponse)
async def get_current_user(current_user=Depends(require_auth)):
    """Get current user information"""
    return CurrentUserResponse(username=current_user.username, role=current_user.role)


@router.post("/", response_model=UserResponse)
async def create_user(user_data: UserCreate, current_user=Depends(require_admin)):
    """Create a new user (admin only)"""
    try:
        # Check if user already exists in either file
        admin_users = parse_htpasswd(settings.htpasswd_path) or {}
        uploader_users = parse_htpasswd(settings.htuploaders_path) or {}

        if user_data.username in admin_users or user_data.username in uploader_users:
            raise HTTPException(status_code=400, detail=f"User '{user_data.username}' already exists")

        # Hash password and add user to appropriate file
        password_hash = hash_password(user_data.password)
        file_path = get_file_path_for_role(user_data.role)

        # Get existing users from the target file
        existing_users = parse_htpasswd(file_path) or {}
        existing_users[user_data.username] = password_hash

        # Write back to file
        write_users_to_file(existing_users, file_path)

        log_info(
            "User created successfully",
            {
                "username": user_data.username,
                "role": user_data.role,
                "created_by": current_user.username,
            },
        )

        return UserResponse(username=user_data.username, role=user_data.role)

    except HTTPException:
        raise
    except Exception as e:
        log_error("Failed to create user", e)
        raise HTTPException(status_code=500, detail="Failed to create user")


@router.get("/{username}", response_model=UserResponse)
async def get_user(username: str, current_user=Depends(require_admin)):
    """Get user details (admin only)"""
    try:
        users = get_all_users()
        user = next((u for u in users if u.username == username), None)

        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        return user

    except HTTPException:
        raise
    except Exception as e:
        log_error("Failed to get user", e)
        raise HTTPException(status_code=500, detail="Failed to retrieve user")


@router.put("/{username}", response_model=UserResponse)
async def update_user(username: str, user_data: UserUpdate, current_user=Depends(require_admin)):
    """Update user (admin only)"""
    try:
        # Find current user and role
        users = get_all_users()
        existing_user = next((u for u in users if u.username == username), None)

        if not existing_user:
            raise HTTPException(status_code=404, detail="User not found")

        current_role = existing_user.role
        new_role = user_data.role if user_data.role else current_role

        # Validate operation
        if new_role != current_role and username == current_user.username:
            raise HTTPException(status_code=400, detail="Cannot change your own role")

        # If role is changing, need to move user between files
        if new_role != current_role:
            # Remove from current file
            current_file_path = get_file_path_for_role(current_role)
            current_users = parse_htpasswd(current_file_path) or {}

            if username not in current_users:
                raise HTTPException(status_code=404, detail="User not found in current role file")

            password_hash = current_users[username]
            del current_users[username]
            write_users_to_file(current_users, current_file_path)

            # Add to new file
            new_file_path = get_file_path_for_role(new_role)
            new_users = parse_htpasswd(new_file_path) or {}
            new_users[username] = password_hash
            write_users_to_file(new_users, new_file_path)

        # Update password if provided
        if user_data.password:
            file_path = get_file_path_for_role(new_role)
            users_dict = parse_htpasswd(file_path) or {}
            users_dict[username] = hash_password(user_data.password)
            write_users_to_file(users_dict, file_path)

        log_info(
            "User updated successfully",
            {
                "username": username,
                "old_role": current_role,
                "new_role": new_role,
                "password_changed": bool(user_data.password),
                "updated_by": current_user.username,
            },
        )

        return UserResponse(username=username, role=new_role)

    except HTTPException:
        raise
    except Exception as e:
        log_error("Failed to update user", e)
        raise HTTPException(status_code=500, detail="Failed to update user")


@router.delete("/{username}")
async def delete_user(username: str, current_user=Depends(require_admin)):
    """Delete user (admin only)"""
    try:
        # Validate operation
        validate_user_operation(username, current_user.username, "delete")

        # Find user and remove from appropriate file
        users = get_all_users()
        user_to_delete = next((u for u in users if u.username == username), None)

        if not user_to_delete:
            raise HTTPException(status_code=404, detail="User not found")

        file_path = get_file_path_for_role(user_to_delete.role)
        users_dict = parse_htpasswd(file_path) or {}

        if username not in users_dict:
            raise HTTPException(status_code=404, detail="User not found in role file")

        del users_dict[username]
        write_users_to_file(users_dict, file_path)

        log_info(
            "User deleted successfully",
            {
                "username": username,
                "role": user_to_delete.role,
                "deleted_by": current_user.username,
            },
        )

        return {"message": f"User '{username}' deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        log_error("Failed to delete user", e)
        raise HTTPException(status_code=500, detail="Failed to delete user")
