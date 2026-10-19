"""Verify two native export files, without trusting screenshot dimensions."""

import pathlib
import struct
import sys

files = list(pathlib.Path(sys.argv[1]).glob("*.png"))
assert len(files) >= 2, f"Expected both scenes, found {len(files)} PNG exports"
for path in files:
    data = path.read_bytes()
    assert data[:8] == b"\x89PNG\r\n\x1a\n", path
    assert struct.unpack(">II", data[16:24]) == (1080, 1920), path
    assert len(data) > 10000, path
    print(path.name, "1080x1920 PNG PASS")
