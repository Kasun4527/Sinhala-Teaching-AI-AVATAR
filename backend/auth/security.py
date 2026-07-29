import bcrypt

def hash_password(password: str) -> str:
    pwd_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed_password = bcrypt.hashpw(pwd_bytes, salt)
    return hashed_password.decode('utf-8')

def verify_password(plain: str, hashed: str) -> bool:
    # Handle potentially broken passlib hashes by ensuring correct encoding
    password_byte_enc = plain.encode('utf-8')
    hashed_password_byte_enc = hashed.encode('utf-8')
    try:
        return bcrypt.checkpw(password_byte_enc, hashed_password_byte_enc)
    except ValueError:
        return False