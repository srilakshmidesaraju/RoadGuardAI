import os
import sys

print("Redirecting to ai_service/app.py...")
os.chdir('ai_service')
os.system(f"{sys.executable} app.py")
