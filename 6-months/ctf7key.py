import random
import hashlib
import time

target_hash = input("Paste hash: ").strip()
current_time = int(time.time())

for delta in range(-300, 300): # 5 minutes before and after
    random.seed(current_time + delta)
    flag = f"flag{{{'%064x' % random.getrandbits(256)}}}"
    if hashlib.sha256(flag.encode()).hexdigest() == target_hash:
        print(f"Found flag: {flag}")
        exit()

print("Flag not found in time window!")