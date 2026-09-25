#!/usr/bin/env python3
"""1화 콜드 오픈(0:00–0:33)의 효과음·배경음을 ffmpeg로 합성한다. 외부 음원을 쓰지 않아 저작권 문제가 없다.

사용법: python3 ep01_coldopen_audio.py 출력.wav
"""
import subprocess
import sys

import imageio_ffmpeg

DUR = 33.0
SR = 48000

# (시작초, lavfi 소스, 길이, 소스 뒤에 붙일 필터)
BOOM = "aevalsrc='sin(2*PI*({f}-{s}*t)*t)*exp(-{k}*t)':d={d}:s=48000"
CLICK = "aevalsrc='sin(2*PI*{f}*t)*exp(-{k}*t)':d={d}:s=48000"
NOISE = "anoisesrc=c={c}:d={d}:a=0.6:r=48000"
EVENTS = [
    # 저음 드론 (정지 직전까지)
    (0.0, "aevalsrc='0.5*sin(2*PI*55*t)+0.3*sin(2*PI*82.41*t)+0.12*sin(2*PI*110*t)':d=28:s=48000", "afade=t=in:d=1.5,afade=t=out:st=27.85:d=0.12,volume=0.16"),
    # 엔진 점화
    (0.10, NOISE.format(c="brown", d=2.4), "lowpass=f=380,afade=t=in:d=0.25,afade=t=out:st=2.1:d=0.3,volume=0.9"),
    (0.26, BOOM.format(f=48, s=18, k=3.5, d=1.4), "volume=0.9"),
    # 원두가 떨어지는 소리, 가격 숫자가 올라가는 소리
    (3.35, CLICK.format(f=2300, k=70, d=0.2), "volume=0.5"),
    (3.62, CLICK.format(f=2600, k=90, d=0.15), "volume=0.25"),
    (3.75, "aevalsrc='sin(2*PI*3200*t)*exp(-90*mod(t,0.07))':d=0.95:s=48000", "afade=t=out:st=0.7:d=0.25,volume=0.16"),
    # 활주로 → 머리 위를 지나는 굉음 (10.9초에 정점)
    (5.0, NOISE.format(c="brown", d=8), "lowpass=f=650,volume='0.12+0.95*exp(-pow((t-5.9)/1.5,2))':eval=frame,afade=t=in:d=0.6,afade=t=out:st=7.5:d=0.5"),
    (5.0, NOISE.format(c="pink", d=8), "lowpass=f=2600,volume='0.03+0.35*exp(-pow((t-5.9)/1.1,2))':eval=frame,afade=t=in:d=0.6,afade=t=out:st=7.5:d=0.5"),
    (10.75, BOOM.format(f=40, s=10, k=2.2, d=1.8), "volume=0.6"),
    # 뉴스 패널 세 번, 그리고 '핵'
    (13.06, BOOM.format(f=55, s=20, k=6, d=0.8), "volume=0.75"),
    (13.06, NOISE.format(c="white", d=0.14), "lowpass=f=3500,afade=t=out:d=0.14,volume=0.35"),
    (13.86, BOOM.format(f=55, s=20, k=6, d=0.8), "volume=0.75"),
    (13.86, NOISE.format(c="white", d=0.14), "lowpass=f=3500,afade=t=out:d=0.14,volume=0.35"),
    (14.66, BOOM.format(f=55, s=20, k=6, d=0.8), "volume=0.75"),
    (14.66, NOISE.format(c="white", d=0.14), "lowpass=f=3500,afade=t=out:d=0.14,volume=0.35"),
    (15.0, NOISE.format(c="white", d=0.62), "highpass=f=1800,afade=t=in:d=0.6:curve=exp,volume=0.22"),
    (15.62, BOOM.format(f=40, s=12, k=2.4, d=2.0), "volume=1.0"),
    (15.62, NOISE.format(c="brown", d=0.5), "lowpass=f=900,afade=t=out:d=0.5,volume=0.8"),
    # TV로 빠지는 휙 소리
    (16.9, NOISE.format(c="pink", d=0.9), "bandpass=f=1400:w=1200,afade=t=in:d=0.35,afade=t=out:st=0.4:d=0.5,volume=0.35"),
    # 가게: 실내 공기와 낮은 화음
    (17.0, NOISE.format(c="pink", d=11), "lowpass=f=450,afade=t=in:d=0.8,afade=t=out:st=10.85:d=0.12,volume=0.05"),
    (17.4, "aevalsrc='0.33*sin(2*PI*220*t)+0.25*sin(2*PI*261.63*t)+0.22*sin(2*PI*329.63*t)':d=10.6:s=48000",
     "tremolo=f=0.4:d=0.25,afade=t=in:d=1.4,afade=t=out:st=10.45:d=0.12,volume=0.06"),
    # 계산기 버튼
    *[(t, CLICK.format(f=1700, k=120, d=0.1), "volume=0.35") for t in (19.35, 19.7, 20.05, 20.5, 20.9, 21.3, 21.75)],
    # 서진이 고개를 드는 소리, 질문 글자
    (23.35, NOISE.format(c="pink", d=0.9), "bandpass=f=900:w=700,afade=t=in:d=0.4,afade=t=out:st=0.4:d=0.5,volume=0.18"),
    *[(25.9 + i * 0.22, BOOM.format(f=90, s=30, k=12, d=0.35), "volume=0.35") for i in range(5)],
    # 흑백 정지: 모든 소리가 끊기고 낮은 종소리
    (28.0, "aevalsrc='0.6*sin(2*PI*55*t)*exp(-1.1*t)+0.35*sin(2*PI*110*t)*exp(-1.6*t)+0.12*sin(2*PI*330*t)*exp(-2.5*t)':d=3.1:s=48000",
     "aecho=0.8:0.6:180|360:0.35|0.2,volume=0.8"),
    # 실이 모이는 소리, 로고
    (31.05, NOISE.format(c="white", d=0.9), "highpass=f=1500,afade=t=in:d=0.85:curve=exp,volume=0.2"),
    (31.98, BOOM.format(f=45, s=12, k=2.8, d=1.2), "volume=0.8"),
    (31.98, "aevalsrc='0.45*sin(2*PI*880*t)*exp(-2.2*t)+0.3*sin(2*PI*1318.5*t)*exp(-3*t)+0.2*sin(2*PI*659.25*t)*exp(-1.8*t)':d=1.0:s=48000",
     "aecho=0.8:0.7:120|260:0.4|0.25,volume=0.5"),
]


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else "coldopen.wav"
    args, chains = [imageio_ffmpeg.get_ffmpeg_exe(), "-hide_banner", "-loglevel", "error", "-y"], []
    for i, (start, src, flt) in enumerate(EVENTS):
        args += ["-f", "lavfi", "-i", src]
        ms = int(start * 1000)
        chains.append(f"[{i}:a]aformat=sample_rates={SR}:channel_layouts=mono,{flt},adelay={ms}[e{i}]")
    mix = "".join(f"[e{i}]" for i in range(len(EVENTS)))
    chains.append(f"{mix}amix=inputs={len(EVENTS)}:normalize=0:dropout_transition=0,"
                  f"apad,atrim=0:{DUR},alimiter=limit=0.9,pan=stereo|c0=c0|c1=c0,volume=0.85[out]")
    args += ["-filter_complex", ";".join(chains), "-map", "[out]", "-ar", str(SR), out]
    subprocess.run(args, check=True)
    print(out)


if __name__ == "__main__":
    main()
