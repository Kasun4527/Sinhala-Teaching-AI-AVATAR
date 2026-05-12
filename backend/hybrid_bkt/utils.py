import torch
import io
import pickle

def serialize_tensor(t):
    if t is None:
        return None
    buffer = io.BytesIO()
    torch.save(t, buffer)
    return buffer.getvalue()

def deserialize_tensor(b):
    if b is None:
        return None
    buffer = io.BytesIO(b)
    return torch.load(buffer, map_location=torch.device('cpu'))
