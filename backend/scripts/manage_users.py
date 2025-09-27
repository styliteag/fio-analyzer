#!/usr/bin/env python3
"""
User management script for FIO Analyzer
"""

import argparse
import sys
from pathlib import Path

import bcrypt

# Add parent directory to path to import modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from auth.authentication import parse_htpasswd
from config.settings import settings


def hash_password(password: str) -> str:
    """Hash password using bcrypt"""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def add_user(username: str, password: str, file_path: Path):
    """Add user to htpasswd file"""
    hashed_password = hash_password(password)

    # Read existing users
    users = parse_htpasswd(file_path) or {}

    # Add new user
    users[username] = hashed_password

    # Write back to file
    with open(file_path, "w") as f:
        for user, pwd_hash in users.items():
            f.write(f"{user}:{pwd_hash}\n")

    print(f"User '{username}' added successfully to {file_path}")


def remove_user(username: str, file_path: Path):
    """Remove user from htpasswd file"""
    users = parse_htpasswd(file_path) or {}

    if username not in users:
        print(f"User '{username}' not found in {file_path}")
        return

    del users[username]

    # Write back to file
    with open(file_path, "w") as f:
        for user, pwd_hash in users.items():
            f.write(f"{user}:{pwd_hash}\n")

    print(f"User '{username}' removed successfully from {file_path}")


def list_users(file_path: Path):
    """List all users in htpasswd file"""
    users = parse_htpasswd(file_path) or {}

    if not users:
        print(f"No users found in {file_path}")
        return

    print(f"Users in {file_path}:")
    for username in users.keys():
        print(f"  - {username}")


def main():
    parser = argparse.ArgumentParser(description="Manage FIO Analyzer users")
    parser.add_argument("action", choices=["add", "remove", "list"], help="Action to perform")
    parser.add_argument("--username", "-u", help="Username")
    parser.add_argument("--password", "-p", help="Password")
    parser.add_argument(
        "--uploader",
        action="store_true",
        help="Manage uploader users (default: admin users)",
    )

    args = parser.parse_args()

    # Determine which file to use
    file_path = settings.htuploaders_path if args.uploader else settings.htpasswd_path

    if args.action == "add":
        if not args.username or not args.password:
            print("Username and password are required for adding users")
            sys.exit(1)
        add_user(args.username, args.password, file_path)

    elif args.action == "remove":
        if not args.username:
            print("Username is required for removing users")
            sys.exit(1)
        remove_user(args.username, file_path)

    elif args.action == "list":
        list_users(file_path)


if __name__ == "__main__":
    main()
