"""Encode the original 42-second / 1008-frame engineering film at native 24 fps.

python3 tools/encode_material_film.py /tmp/denoised-frames
Application-card images stay with their existing assembly film.
"""
import argparse,json,subprocess
from pathlib import Path
from material_film_model import COUNT,FPS,DURATION
p=argparse.ArgumentParser(description=__doc__);p.add_argument('frames',type=Path);a=p.parse_args()
frames=a.frames.resolve();expected={f'{i:04d}.png' for i in range(COUNT)};actual={f.name for f in frames.glob('*.png')}
if actual!=expected:p.error(f'Incomplete frame sequence: missing {len(expected-actual)}, extra {len(actual-expected)}')
out=Path(__file__).resolve().parents[1]/'docs'/'media';master=out/'boltnote-engineering.mp4'
def encode(cmd):subprocess.run(['ffmpeg','-hide_banner','-loglevel','warning','-y',*cmd],check=True)
encode(['-framerate',str(FPS),'-i',str(frames/'%04d.png'),'-frames:v',str(COUNT),'-r',str(FPS),'-fps_mode','cfr','-c:v','libx264','-preset','slow','-crf','18','-pix_fmt','yuv420p','-an','-map_metadata','-1','-movflags','+faststart','-threads','4',str(master)])
probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-select_streams','v:0','-show_entries','stream=nb_frames,avg_frame_rate:format=duration','-of','json',str(master)]))
assert int(probe['streams'][0]['nb_frames'])==COUNT and abs(float(probe['format']['duration'])-DURATION)<.01,probe
encode(['-i',str(master),'-c:v','libvpx-vp9','-crf','28','-b:v','0','-deadline','good','-cpu-used','3','-row-mt','1','-threads','4','-an','-map_metadata','-1',str(out/'boltnote-engineering.webm')])
encode(['-i',str(master),'-vf','scale=800:-2','-c:v','libx264','-preset','slow','-crf','20','-pix_fmt','yuv420p','-an','-map_metadata','-1','-movflags','+faststart','-threads','4',str(out/'boltnote-engineering-mobile.mp4')])
encode(['-i',str(frames/'0091.png'),'-frames:v','1','-c:v','libwebp','-quality','94','-map_metadata','-1',str(out/'boltnote-engineering-poster.webp')])
for f in out.glob('boltnote-engineering*'):print(f.name,f.stat().st_size,flush=True)
