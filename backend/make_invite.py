"""
Generate invite codes.

    python make_invite.py maria jonas

prints one code per name, plus the line to put in INVITE_CODES (on Render: Environment tab).
Codes use the `secrets` module (cryptographically random, unlike `random`) and leave out
look-alike characters (0/O, 1/I/L) so they're easy to type.
"""
import secrets
import sys

ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"  # 31 characters -> 31^8 ≈ 850 billion possible codes


def make_code():
    chars = "".join(secrets.choice(ALPHABET) for _ in range(8))
    return f"{chars[:4]}-{chars[4:]}"


if __name__ == "__main__":
    names = sys.argv[1:]
    if not names:
        sys.exit("usage: python make_invite.py NAME [NAME ...]")
    pairs = [(name, make_code()) for name in names]
    for name, code in pairs:
        print(f"{name}: {code}")
    print("\nAdd to INVITE_CODES (comma-separated, keep any existing entries):")
    print(",".join(f"{name}:{code}" for name, code in pairs))
