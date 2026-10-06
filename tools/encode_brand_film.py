"""Make the silent 16-second company introduction from our original 3D film.

The seven-chapter engineering film remains available in the detailed viewer.
Run: python3 tools/encode_brand_film.py
"""
import json
import subprocess
from pathlib import Path

MEDIA = Path(__file__).resolve().parents[1] / 'docs' / 'media'
# Four 4-second excerpts: components, threads, heavy nuts, protective layers.
CLIPS = [(2, 6), (8, 12), (13, 17), (38, 42)]


def run(*args):
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'warning', '-y', *args], check=True)


if __name__ == '__main__':
    segments = ';'.join(
        f'[0:v]trim=start={start}:end={end},setpts=PTS-STARTPTS[v{i}]'
        for i, (start, end) in enumerate(CLIPS)
    )
    filters = segments + ';' + ''.join(f'[v{i}]' for i in range(4)) + 'concat=n=4:v=1:a=0,fade=t=in:st=0:d=0.18,fade=t=out:st=15.82:d=0.18[out]'
    master = MEDIA / 'boltnote-brand.mp4'
    run('-i', str(MEDIA / 'boltnote-engineering.mp4'), '-filter_complex', filters,
        '-map', '[out]', '-r', '24', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18',
        '-pix_fmt', 'yuv420p', '-an', '-map_metadata', '-1', '-movflags', '+faststart',
        '-threads', '4', str(master))
    run('-i', str(master), '-vf', 'scale=800:-2', '-c:v', 'libx264', '-preset', 'slow',
        '-crf', '21', '-pix_fmt', 'yuv420p', '-an', '-map_metadata', '-1',
        '-movflags', '+faststart', '-threads', '4', str(MEDIA / 'boltnote-brand-mobile.mp4'))
    # The poster is an unaltered frame from the original rendered film.
    run('-ss', '3.8', '-i', str(MEDIA / 'boltnote-engineering.mp4'), '-frames:v', '1',
        '-c:v', 'libwebp', '-quality', '94', '-map_metadata', '-1', str(MEDIA / 'boltnote-brand-poster.webp'))
    for name in ['boltnote-brand.mp4', 'boltnote-brand-mobile.mp4']:
        probe = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries',
            'stream=codec_type,width,height:format=duration', '-of', 'json', str(MEDIA / name)]))
        assert abs(float(probe['format']['duration']) - 16) < .01, probe
        assert all(s['codec_type'] == 'video' for s in probe['streams']), probe
        print(name, (MEDIA / name).stat().st_size, 'bytes, 16s, silent')
