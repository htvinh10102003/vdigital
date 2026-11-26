#!/usr/bin/env python3
"""Lấy Supabase service_role key qua helper (không in key ra log) rồi chạy
upload script với key chỉ nằm trong env của tiến trình con."""
import json
import os
import subprocess
import sys

HELPER = os.path.expanduser(
    "~/workspace/custom-connectors/custom.supabase-vdigital/bin/supabase_vdigital_api.py"
)
ROOT = os.path.expanduser("~/workspace/vdigital")

res = subprocess.run(
    [sys.executable, HELPER, "api_keys", "otnsavsopgbbzanryijc"],
    capture_output=True, text=True, timeout=120,
)
if res.returncode != 0:
    print("helper api_keys failed:", res.stderr[:300], file=sys.stderr)
    sys.exit(1)
try:
    data = json.loads(res.stdout)
except json.JSONDecodeError:
    print("helper output không phải JSON", file=sys.stderr)
    sys.exit(1)

# Tìm service_role key mà không in giá trị: duyệt đệ quy; dạng phổ biến là
# [{"name": "service_role", "api_key": "..."}] hoặc {"service_role": "..."}.
service_key = None
url = "https://otnsavsopgbbzanryijc.supabase.co"

def walk(obj):
    global service_key
    if service_key:
        return
    if isinstance(obj, dict):
        name = str(obj.get("name", "")).lower()
        if "service_role" in name or "service-role" in name:
            for kf in ("api_key", "key", "value", "secret"):
                if isinstance(obj.get(kf), str) and obj[kf]:
                    service_key = obj[kf]
                    return
        for k, v in obj.items():
            kl = str(k).lower()
            if isinstance(v, str) and ("service_role" in kl or "service-role" in kl or kl in ("secret_key", "service_key")):
                service_key = v
                return
            walk(v)
    elif isinstance(obj, list):
        for item in obj:
            walk(item)
            if service_key:
                return

walk(data)
if not service_key:
    print("không tìm thấy service_role key (chỉ thấy các field:", ", ".join(sorted({str(k) for k in data.keys()})) if isinstance(data, dict) else type(data).__name__, ")", file=sys.stderr)
    sys.exit(1)

env = dict(os.environ)
env["SUPABASE_URL"] = url
env["SUPABASE_SERVICE_ROLE_KEY"] = service_key
r = subprocess.run(["node", "scripts/upload-catalog-images.mjs"], cwd=ROOT, env=env)
sys.exit(r.returncode)
