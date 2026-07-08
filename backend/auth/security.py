import bcrypt

def hash_password(password: str) -> str:
    # Hash a password for the first time
    # (Using bcrypt, the salt is saved into the hash itself)
    pwd_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed_password = bcrypt.hashpw(pwd_bytes, salt)
    return hashed_password.decode('utf-8')

def verify_password(plain: str, hashed: str) -> bool:
    # Check hashed password. Using bcrypt, the salt is extracted from the hash.
    plain_bytes = plain.encode('utf-8')
    hashed_bytes = hashed.encode('utf-8')
    return bcrypt.checkpw(plain_bytes, hashed_bytes)