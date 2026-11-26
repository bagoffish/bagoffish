#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Compatibility wrapper.

Runs omni_ingest_server.py (Roblox enabled by default).
Ensures local imports resolve even with embeddable/isolated Python.
"""

import os
import sys

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from omni_ingest_server import main  # noqa: E402


if __name__ == "__main__":
    main()
