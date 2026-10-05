"""Encode the original home film after rendering all frames with render_hero.py.

Example (native 24 fps frames, after denoise_hero.py):
    python3 tools/encode_hero.py /tmp/hero-frames --poster /tmp/hero-frames/0818.png
Requires ffmpeg with libx264, libvpx-vp9, and libwebp.
The 36-second, silent film is delivered at 24 fps with a smaller mobile copy.
"""
import argparse
import json
from pathlib import Path
import subprocess

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('frames', type=Path)
parser.add_argument('--poster', type=Path)
parser.add_argument('--source-fps', type=int, default=24, choices=(24,))
args = parser.parse_args()
frames = args.frames.resolve()
step = 24 // args.source_fps
expected = {f'{index:04d}.png' for index in range(0, 864, step)}
actual = {path.name for path in frames.glob('*.png')}
if actual != expected:
    parser.error(f'Incomplete frame sequence: missing {len(expected-actual)}, extra {len(actual-expected)}')
poster = (args.poster or frames/'0818.png').resolve()
if not poster.is_file():
    parser.error('The poster file does not exist')
out = Path(__file__).resolve().parents[1]/'docs'/'media'


def encode(arguments, label):
    print(label, flush=True)
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'warning', '-y', *arguments], check=True)


master = out/'boltnote-precision.mp4'
# Each encoded frame corresponds to an original rendered geometry state.
# No optical flow or temporal filtering across threads and tool contacts.
processing = 'fps=24,setpts=N/(24*TB)'
encode(['-framerate', str(args.source_fps), '-pattern_type', 'glob', '-i', str(frames/'*.png'),
        '-vf', processing, '-frames:v', '864', '-r', '24', '-fps_mode', 'cfr', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18',
        '-pix_fmt', 'yuv420p', '-an', '-map_metadata', '-1', '-movflags', '+faststart', '-threads', '4', str(master)],
       'Encoding the desktop H.264 film')
probe = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=nb_frames,avg_frame_rate:format=duration', '-of', 'json', str(master)]))
if probe['streams'][0]['nb_frames'] != '864' or abs(float(probe['format']['duration'])-36) > .01:
    raise RuntimeError(f'The film must contain 864 frames / 36 seconds: {probe}')
encode(['-i', str(master), '-c:v', 'libvpx-vp9', '-crf', '28', '-b:v', '0', '-deadline', 'good',
        '-cpu-used', '3', '-row-mt', '1', '-threads', '4', '-an', '-map_metadata', '-1', str(out/'boltnote-precision.webm')],
       'Encoding the desktop WebM film')
encode(['-i', str(master), '-vf', 'scale=800:-2', '-c:v', 'libx264', '-preset', 'slow', '-crf', '20',
        '-pix_fmt', 'yuv420p', '-an', '-map_metadata', '-1', '-movflags', '+faststart', '-threads', '4', str(out/'boltnote-precision-mobile.mp4')],
       'Encoding the smaller mobile film')
encode(['-i', str(poster), '-frames:v', '1', '-c:v', 'libwebp', '-quality', '92', '-map_metadata', '-1', str(out/'boltnote-precision-poster.webp')],
       'Encoding the high quality still for reduced motion and data saver')
for name, frame in [('flange', 330), ('shaft', 688)]:
    encode(['-i', str(frames/f'{frame:04d}.png'), '-vf', 'scale=600:450', '-frames:v', '1',
            '-c:v', 'libwebp', '-quality', '90', '-map_metadata', '-1',
            str(out/f'boltnote-application-{name}.webp')],
           f'Encoding the {name} application card from the actual film')
for path in sorted(out.glob('boltnote-precision*')):
    print(f'{path.name}: {path.stat().st_size:,} bytes')
