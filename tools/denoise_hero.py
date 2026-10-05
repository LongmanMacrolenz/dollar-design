"""Denoise native rendered frames with Intel Open Image Denoise (outside the repo).

    python3 tools/denoise_hero.py raw-frames clean-frames --oidn /path/to/oidnDenoise
Requires numpy, Pillow, and the public OIDN CPU release. No motion interpolation.
Use a persistent library device/filter to avoid loading weights for every frame.
"""
import argparse
import ctypes as C
from pathlib import Path
import numpy as np
from PIL import Image

ap=argparse.ArgumentParser(description=__doc__)
ap.add_argument('frames',type=Path);ap.add_argument('out',type=Path)
ap.add_argument('--oidn',required=True,type=Path);ap.add_argument('--threads',type=int,default=4)
a=ap.parse_args();a.out.mkdir(parents=True,exist_ok=True)
root=a.oidn.resolve().parent.parent
lib=C.CDLL(str(root/'lib'/'libOpenImageDenoise.so'))
# OIDN's stable C interface; all parameters and handles are specified explicitly.
lib.oidnNewDevice.argtypes=[C.c_int];lib.oidnNewDevice.restype=C.c_void_p
lib.oidnSetDeviceInt.argtypes=[C.c_void_p,C.c_char_p,C.c_int]
lib.oidnCommitDevice.argtypes=[C.c_void_p]
lib.oidnGetDeviceError.argtypes=[C.c_void_p,C.POINTER(C.c_char_p)];lib.oidnGetDeviceError.restype=C.c_int
lib.oidnNewFilter.argtypes=[C.c_void_p,C.c_char_p];lib.oidnNewFilter.restype=C.c_void_p
lib.oidnSetFilterBool.argtypes=[C.c_void_p,C.c_char_p,C.c_bool]
lib.oidnSetSharedFilterImage.argtypes=[C.c_void_p,C.c_char_p,C.c_void_p,C.c_int,C.c_size_t,C.c_size_t,C.c_size_t,C.c_size_t,C.c_size_t]
lib.oidnCommitFilter.argtypes=[C.c_void_p];lib.oidnExecuteFilter.argtypes=[C.c_void_p]
lib.oidnReleaseFilter.argtypes=[C.c_void_p];lib.oidnReleaseDevice.argtypes=[C.c_void_p]
device=lib.oidnNewDevice(1);lib.oidnSetDeviceInt(device,b'numThreads',a.threads);lib.oidnCommitDevice(device)
filter=lib.oidnNewFilter(device,b'RT');lib.oidnSetFilterBool(filter,b'hdr',False);lib.oidnSetFilterBool(filter,b'srgb',True)
message=C.c_char_p()
for i,path in enumerate(sorted(a.frames.glob('*.png'))):
 target=a.out/path.name
 if target.exists(): continue
 color=np.asarray(Image.open(path).convert('RGB'),dtype=np.float32)/255
 output=np.empty_like(color);h,w,_=color.shape
 for name,array in [(b'color',color),(b'output',output)]:
  lib.oidnSetSharedFilterImage(filter,name,array.ctypes.data,3,w,h,0,12,12*w)
 lib.oidnCommitFilter(filter);lib.oidnExecuteFilter(filter)
 error=lib.oidnGetDeviceError(device,C.byref(message))
 if error: raise RuntimeError(message.value.decode())
 Image.fromarray(np.uint8(np.clip(output,0,1)*255+.5)).save(target)
 print(f'DENOISED {path.name}',flush=True)
lib.oidnReleaseFilter(filter);lib.oidnReleaseDevice(device)
