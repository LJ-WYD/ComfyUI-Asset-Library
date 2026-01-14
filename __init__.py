
print("[ComfyUI-Asset-Library] Initializing...")

import os
import shutil
import folder_paths

WEB_DIRECTORY = "./js"

# Import API/Backend logic
from .py import api

NODE_CLASS_MAPPINGS = {}
NODE_DISPLAY_NAME_MAPPINGS = {}

print("[ComfyUI-Asset-Library] Loaded successfully. WEB_DIRECTORY =", WEB_DIRECTORY)

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]

