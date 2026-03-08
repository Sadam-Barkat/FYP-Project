import urllib.request
import json

url = "http://localhost:8000/api/auth/login"
data = json.dumps({"email": "admin@hospital.com", "password": "hashed_password_placeholder"}).encode("utf-8")
req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})

try:
    with urllib.request.urlopen(req) as response:
        print(response.read().decode())
except urllib.error.HTTPError as e:
    print(f"HTTP Error: {e.code}")
    print(e.read().decode())