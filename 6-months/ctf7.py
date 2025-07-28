from random import choice

def main():
    keyd, ref = key()
    print("Would you like to encrypt or decrypt?", end=" ")
    ans = input().strip().lower()
    while ans not in ["encrypt", "decrypt"]:
        ans = input("Invalid answer. ").strip().lower()
    if ans == "encrypt":
        end = input("Type message. ").strip()
        if not end:
            print("Message cannot be empty.")
            return
        lenMessage = len(end)
        start = genKey(lenMessage)
        encrypted = genMessage(start, keyd, end, ref)
        print(encrypted)
    else:
        message = input("Enter message! ").strip()
        while not len(message) % 2 == 0 or len(message) == 0:
            message = input("Has to be even and non-empty. ").strip()
        message = message.lower()
        # Validate all characters are in ref before processing
        if all(c in ref for c in message):
            start, end = parse(message, len(message))
            message = decrypt(start, end, keyd, ref)
            print(message)
        else:
            print("Invalid characters in message.")

def parse(message, lenMessage):
    end = ""
    start = ""
    for i in range(0, lenMessage // 2):
        start += message[i]
    for i in range(lenMessage // 2, lenMessage):
        end += message[i]
    return start, end

def decrypt(start, end, keyd, ref):
    keyval = [0, 0]
    message = ""
    secret = "CTF{crypt0_4r1thm3t1c}"  # Hidden arithmetic secret
    secret_idx = 0
    for i in range(len(start)):
        # Curious arithmetic boundary: 54 is a special case
        keyval[0] = ref[start[i]]
        keyval[1] = ref[end[i]]
        tot = keyval[0] + keyval[1]
        if tot == 54 and secret_idx < len(secret):
            message += secret[secret_idx]
            secret_idx += 1
        else:
            try:
                message += keyd[tot]
            except:
                tot -= 27
                message += keyd[tot]
    return message

def key():
    keyd = {
        1: "a",
        2: "b",
        3: "c",
        4: "d",
        5: "e",
        6: "f",
        7: "g",
        8: "h",
        9: "i",
        10: "j",
        11: "k",
        12: "l",
        13: "m",
        14: "n",
        15: "o",
        16: "p",
        17: "q",
        18: "r",
        19: "s",
        20: "t",
        21: "u",
        22: "v",
        23: "w",
        24: "x",
        25: "y",
        26: "z",
        27: " "
    }
    
    ref = {
        "a": 1,
        "b": 2,
        "c": 3,
        'd': 4,
        'e': 5,
        'f': 6,
        'g': 7,
        'h': 8,
        'i': 9,
        'j': 10,
        'k': 11,
        'l': 12,
        'm': 13,
        'n': 14,
        'o': 15,
        'p': 16,
        'q': 17,
        'r': 18,
        's': 19,
        't': 20,
        'u': 21,
        'v': 22,
        'w': 23,
        'x': 24,
        'y': 25,
        'z': 26,
        '.': 27,
        ' ': 27
    }
    return keyd, ref

def genKey(lenMessage):
    choices = 'abcdefghijklmnopqrstuvwxyz'
    end = ''
    for i in range(lenMessage):
        end += choice(choices)
    return end

def genMessage(start, keyd, message, ref):
    message = message.lower()
    keyval = [0, 0]
    encryptedmessage = ""
    for n in range(len(message)):
        if message[n] not in ref:
            return "Invalid character in message."
        keyval[0] = ref[message[n]]
        keyval[1] = ref[start[n]]
        tot = keyval[0] - keyval[1]
        try:
            add = keyd[tot]
        except:
            tot += 27
            add = keyd[tot]
        if add == ' ':
            add = '.'
        encryptedmessage += add
    encryptedmessage = start + encryptedmessage
    return encryptedmessage
        
if __name__ == "__main__":
    main()