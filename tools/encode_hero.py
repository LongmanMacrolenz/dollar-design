"""Encode the original home film after rendering all frames with render_hero.py.

Example (the renderer's --step 3 yields 8 source frames per second):
    python3 tools/encode_hero.py /tmp/hero-frames --poster /tmp/hero-poster/0840.png
Requires ffmpeg with libx264, libvpx-vp9, libwebp, and minterpolate.
The 36-second, silent film is delivered at 24 fps with a smaller mobile copy.
"""
import argparse
import json
from pathlib import Path
import subprocess

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('frames', type=Path)
parser.add_argument('--poster', type=Path)
parser.add_argument('--source-fps', type=int, default=8, choices=(8, 12, 24))
args = parser.parse_args()
frames = args.frames.resolve()
step = 24 // args.source_fps
expected = {f'{index:04d}.png' for index in range(0, 864, step)}
actual = {path.name for path in frames.glob('*.png')}
if actual != expected:
    parser.error(f'Incomplete frame sequence: missing {len(expected-actual)}, extra {len(actual-expected)}')
poster = (args.poster or frames/'0840.png').resolve()
if not poster.is_file():
    parser.error('The poster file does not exist')
out = Path(__file__).resolve().parents[1]/'docs'/'media'


def encode(arguments, label):
    print(label, flush=True)
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'warning', '-y', *arguments], check=True)


master = out/'boltnote-assembly.mp4'
processing = 'hqdn3d=2:1.5:4:4'
if args.source_fps < 24:
    processing += ',minterpolate=fps=24:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1:scd_threshold=2.5'
# Optical-flow lookahead shifts the first timestamp. Reset it and keep a short
# opening hold so the original chapter/part times remain aligned with the film.
opening_frames = round(48/args.source_fps) if args.source_fps < 24 else 0
processing += f',fps=24,tpad=start_mode=clone:start={opening_frames}:stop_mode=clone:stop=48,setpts=N/(24*TB)'
encode(['-framerate', str(args.source_fps), '-pattern_type', 'glob', '-i', str(frames/'*.png'),
        '-vf', processing, '-frames:v', '864', '-r', '24', '-fps_mode', 'cfr', '-c:v', 'libx264', '-preset', 'slow', '-crf', '19',
        '-pix_fmt', 'yuv420p', '-an', '-map_metadata', '-1', '-movflags', '+faststart', '-threads', '4', str(master)],
       'Encoding the desktop H.264 film')
probe = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=nb_frames,avg_frame_rate:format=duration', '-of', 'json', str(master)]))
if probe['streams'][0]['nb_frames'] != '864' or abs(float(probe['format']['duration'])-36) > .01:
    raise RuntimeError(f'The film must contain 864 frames / 36 seconds: {probe}')
encode(['-i', str(master), '-c:v', 'libvpx-vp9', '-crf', '32', '-b:v', '0', '-deadline', 'good',
        '-cpu-used', '3', '-row-mt', '1', '-threads', '4', '-an', '-map_metadata', '-1', str(out/'boltnote-assembly.webm')],
       'Encoding the desktop WebM film')
encode(['-i', str(master), '-vf', 'scale=640:-2', '-c:v', 'libx264', '-preset', 'slow', '-crf', '23',
        '-pix_fmt', 'yuv420p', '-an', '-map_metadata', '-1', '-movflags', '+faststart', '-threads', '4', str(out/'boltnote-assembly-mobile.mp4')],
       'Encoding the smaller mobile film')
encode(['-i', str(poster), '-frames:v', '1', '-c:v', 'libwebp', '-quality', '88', '-map_metadata', '-1', str(out/'boltnote-assembly-poster.webp')],
       'Encoding the high quality still for reduced motion and data saver')
for path in sorted(out.glob('boltnote-assembly*')):
    print(f'{path.name}: {path.stat().st_size:,} bytes')
