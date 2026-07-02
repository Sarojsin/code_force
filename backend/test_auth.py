import requests
import json
import sys

BASE = "http://192.168.0.100:8000/api/v1"

def test_register():
    print("=== Register Test ===")
    payload = {
        "email": "testuser@shecare.app",
        "password": "TestPass123!",
        "display_name": "Test User"
    }
    try:
        r = requests.post(f"{BASE}/auth/register", json=payload, timeout=30)
        print(f"Status: {r.status_code}")
        print(f"Response: {json.dumps(r.json(), indent=2)}")
        return r.status_code, r.json()
    except Exception as e:
        print(f"FAILED: {type(e).__name__}: {e}")
        return None, None

def test_login():
    print("\n=== Login Test ===")
    payload = {
        "email": "testuser@shecare.app",
        "password": "TestPass123!"
    }
    try:
        r = requests.post(f"{BASE}/auth/login", json=payload, timeout=30)
        print(f"Status: {r.status_code}")
        data = r.json()
        print(f"Response: {json.dumps(data, indent=2)}")
        return r.status_code, data
    except Exception as e:
        print(f"FAILED: {type(e).__name__}: {e}")
        return None, None

def test_get_me(access_token):
    print("\n=== Get Me Test ===")
    headers = {"Authorization": f"Bearer {access_token}"}
    try:
        r = requests.get(f"{BASE}/auth/me", headers=headers, timeout=10)
        print(f"Status: {r.status_code}")
        print(f"Response: {json.dumps(r.json(), indent=2)}")
    except Exception as e:
        print(f"FAILED: {type(e).__name__}: {e}")

if __name__ == "__main__":
    status, data = test_register()
    if status == 201 and data:
        tokens = data.get('tokens', data.get('data', {}).get('tokens', {}))
        access = tokens.get('access_token')
        if access:
            test_get_me(access)
    
    status2, data2 = test_login()
    if status2 == 200 and data2:
        tokens = data2.get('tokens', data2.get('data', {}).get('tokens', {}))
        access = tokens.get('access_token')
        if access:
            test_get_me(access)
