import random
import hashlib
import time

def generate_flag():
    random.seed(int(time.time()))  # What can you get out of this? (Note it uses a seeded pseudo-random generator)
    flag = f"flag{{{'%064x' % random.getrandbits(256)}}}"  # 64-char hex
    return flag, hashlib.sha256(flag.encode()).hexdigest()

flag, flag_hash = generate_flag()

print(f"\nFind the flag with SHA-256 hash: \n{flag_hash}")

if input("Enter flag: ").strip() == flag:
    print("Correct! Submit this flag!")
else:
    print("Wrong!")