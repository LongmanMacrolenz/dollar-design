"""Encode the new, native 24fps sourcing film after rendering/denoising.

python3 tools/encode_brand_film.py /tmp/clean-frames --track /tmp/track.json
The previous four-excerpt film is no longer used on the homepage.
"""
import argparse
import json
import math
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MEDIA = ROOT / 'docs' / 'media'

def run(*args):
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'warning', '-y', *args], check=True)

if __name__ == '__main__':
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('frames', type=Path); ap.add_argument('--track', type=Path, required=True)
    args = ap.parse_args()
    expected = {f'{i:04d}.png' for i in range(384)}
    actual = {p.name for p in args.frames.glob('*.png')}
    if actual != expected: ap.error(f'Incomplete frames: missing {len(expected-actual)}, extra {len(actual-expected)}')
    track = json.loads(args.track.read_text())
    if len(track) != 385 or any(len(key)!=15 or not all(math.isfinite(v) for v in key) or abs(key[0]-i/24)>1e-7 for i,key in enumerate(track)):
        ap.error('Annotation track must cover all 16 seconds at native 24fps, with seven projected points')
    master = MEDIA / 'boltnote-sourcing-v2.mp4'
    run('-framerate','24','-i',str(args.frames/'%04d.png'),'-frames:v','384',
        '-r','24','-fps_mode','cfr','-c:v','libx264','-preset','slow','-crf','17',
        '-pix_fmt','yuv420p','-g','48','-an','-map_metadata','-1','-movflags','+faststart',
        '-threads','4',str(master))
    run('-i',str(master),'-vf','scale=720:-2','-c:v','libx264','-preset','slow',
        '-crf','20','-pix_fmt','yuv420p','-g','48','-an','-map_metadata','-1',
        '-movflags','+faststart','-threads','4',str(MEDIA/'boltnote-sourcing-v2-mobile.mp4'))
    run('-i',str(args.frames/'0048.png'),'-frames:v','1','-c:v','libwebp','-quality','94',
        '-map_metadata','-1',str(MEDIA/'boltnote-sourcing-v2-poster.webp'))
    (ROOT/'app/src/v7_sourcing_track.js').write_text(
        '/* Generated from the original camera/part projections by encode_brand_film.py. */\n'
        +'const BN_SOURCING_TRACK = '+json.dumps(track,separators=(',',':'))+';\n')
    # Also replace the old flat/wireframe opening in the optional technical film.
    # Chapters after 6s retain their reviewed geometry, timing and interpretation.
    detailed = MEDIA/'boltnote-engineering-v3.mp4'
    intro = '[0:v]trim=end=6,setpts=PTS-STARTPTS,scale=1200:750,pad=1200:900:0:75:color=0xeef1eb[a];'
    remainder = '[1:v]trim=start=6,setpts=PTS-STARTPTS[b];[a][b]concat=n=2:v=1:a=0[out]'
    run('-i',str(master),'-i',str(MEDIA/'boltnote-engineering.mp4'),'-filter_complex',intro+remainder,
        '-map','[out]','-frames:v','1008','-r','24','-fps_mode','cfr','-c:v','libx264','-preset','slow',
        '-crf','18','-pix_fmt','yuv420p','-g','48','-an','-map_metadata','-1','-movflags','+faststart','-threads','4',str(detailed))
    run('-i',str(detailed),'-vf','scale=800:-2','-c:v','libx264','-preset','slow','-crf','20',
        '-pix_fmt','yuv420p','-an','-map_metadata','-1','-movflags','+faststart','-threads','4',str(MEDIA/'boltnote-engineering-v3-mobile.mp4'))
    run('-i',str(detailed),'-c:v','libvpx-vp9','-crf','28','-b:v','0','-deadline','good','-cpu-used','3',
        '-row-mt','1','-threads','4','-an','-map_metadata','-1',str(MEDIA/'boltnote-engineering-v3.webm'))
    for name in ['boltnote-sourcing-v2.mp4','boltnote-sourcing-v2-mobile.mp4']:
        probe = json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries',
            'stream=codec_type,width,height,nb_frames:format=duration','-of','json',str(MEDIA/name)]))
        assert abs(float(probe['format']['duration'])-16) < .01, probe
        assert all(s['codec_type']=='video' and int(s['nb_frames'])==384 for s in probe['streams']),probe
        print(name,(MEDIA/name).stat().st_size,'bytes, 384 original frames, silent')
    check = json.loads(subprocess.check_output(['ffprobe','-v','error','-select_streams','v:0',
        '-show_entries','stream=nb_frames:format=duration','-of','json',str(detailed)]))
    assert abs(float(check['format']['duration'])-42)<.01 and int(check['streams'][0]['nb_frames'])==1008,check
