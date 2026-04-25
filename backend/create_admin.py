from db import users_collection
from auth.security import hash_password

admin = {
    "name": "Admin",
    "email": "admin@ids.com",
    "password": hash_password("admin123"),
    "role": "admin"
}

existing = users_collection.find_one({"email": "admin@ids.com"})

if existing:
    print("⚠️ Admin already exists")
else:
    users_collection.insert_one(admin)
    print("✅ Admin created successfully")
    print("📧 Email: admin@ids.com")
    print("🔑 Password: admin123")