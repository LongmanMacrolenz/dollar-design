"""Pinned, local Korean neural speech. No hosted speech API or API key."""
from __future__ import annotations

import hashlib
import os
import re
import shutil
import tarfile
import tempfile
import urllib.request
import wave
from pathlib import Path

from .content import MarketingError, ROOT
from .media import probe, run, sha256_file

MODEL_NAME = "vits-mimic3-ko_KO-kss_low"
ARCHIVE_SHA256 = "f015d1d15a52ed00d6fe22757c5ef4a74283c53daf829c838fa5c22616ed789c"
MODEL_SHA256 = "552af73776a1c2a705d828e1435592419eb42b1de9cc2bcb3bb5bcf6efb90cd9"
TOKENS_SHA256 = "d2a7e6696166162a0613812a02f23f2f682a12e05a4cc9864193a3c71c1f3ecb"
DICTIONARY_SHA256 = "e9c56f8c7cc79f16b1a2dc482074ed777e5b881da2a215a6f99630284dc4b3b8"
MODEL_URL = f"https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/{MODEL_NAME}.tar.bz2"


def model_directory():
    return Path(os.environ.get("MARKETING_MODEL_DIR", ROOT / "out/models" / MODEL_NAME)).expanduser().resolve()


def check_model(directory):
    directory = Path(directory)
    for name, expected in (("ko_KO-kss_low.onnx", MODEL_SHA256), ("tokens.txt", TOKENS_SHA256)):
        path = directory / name
        if not path.is_file() or sha256_file(path) != expected:
            raise MarketingError("한국어 음성 모델이 없거나 검증에 실패했습니다. python -m marketing setup-model을 실행하세요.")
    if not (directory / "espeak-ng-data/ko_dict").is_file():
        raise MarketingError("한국어 발음 사전이 없습니다. 음성 모델을 다시 설치하세요.")
    data = directory / "espeak-ng-data"
    checksum = hashlib.sha256()
    for path in sorted(data.rglob("*")):
        if path.is_file():
            checksum.update(path.relative_to(data).as_posix().encode() + b"\x00" +
                            bytes.fromhex(sha256_file(path)))
    if checksum.hexdigest() != DICTIONARY_SHA256:
        raise MarketingError("음성 모델의 발음 사전 체크섬이 다릅니다. 생성하지 않습니다.")


def setup_model(directory=None):
    """Download public weights once, verify the archive, then extract safely."""
    destination = Path(directory or model_directory()).resolve()
    if destination.exists():
        check_model(destination)
        return {"status": "model_ready", "directory": str(destination)}
    destination.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="korean-voice-", dir=destination.parent) as temporary:
        temporary = Path(temporary)
        archive = temporary / "model.tar.bz2"
        try:
            with urllib.request.urlopen(MODEL_URL, timeout=60) as response, archive.open("wb") as output:
                size = 0
                for chunk in iter(lambda: response.read(1024 * 1024), b""):
                    size += len(chunk)
                    if size > 100 * 1024 * 1024:
                        raise MarketingError("음성 모델 다운로드가 예상 크기를 넘었습니다.")
                    output.write(chunk)
        except OSError:
            raise MarketingError("한국어 모델 다운로드 실패. GitHub 릴리스 다운로드 접근을 확인하세요.") from None
        if sha256_file(archive) != ARCHIVE_SHA256:
            raise MarketingError("한국어 모델 압축 파일 체크섬이 다릅니다. 설치를 중단합니다.")
        with tarfile.open(archive) as source:
            members = source.getmembers()
            if any(m.issym() or m.islnk() or not (m.isfile() or m.isdir()) or
                   not (temporary / m.name).resolve().is_relative_to(temporary / MODEL_NAME) for m in members):
                raise MarketingError("음성 모델 압축 파일에 예상하지 않은 경로가 있습니다.")
            source.extractall(temporary, filter="data")
        extracted = temporary / MODEL_NAME
        check_model(extracted)
        shutil.copyfile(ROOT / "marketing/third-party/mimic3-ko-CC0.txt", extracted / "LICENSE")
        os.replace(extracted, destination)
    return {"status": "model_ready", "directory": str(destination)}


def pronounce(text):
    # Keep the public script unchanged. Speak Latin abbreviations consistently
    # using Korean phonetics rather than an English phonemizer inside the model.
    terms = {"BOM": "비오엠", "RFQ": "알에프큐", "Sales": "세일즈", "Fasteners": "패스너",
             "PACK": "팩", "SET": "세트", "Heat": "히트", "Lot": "로트"}
    letters = dict(zip("ABCDEFGHIJKLMNOPQRSTUVWXYZ",
                       "에이 비 씨 디 이 에프 지 에이치 아이 제이 케이 엘 엠 엔 오 피 큐 알 에스 티 유 브이 더블유 엑스 와이 제트".split()))
    return re.sub(r"[A-Za-z]+", lambda match: terms.get(match[0], " ".join(letters[c] for c in match[0].upper())), text)


class LocalVoice:
    profile = "mimic3:ko_KO:kss_low:" + MODEL_SHA256[:16] + ":pronunciation-v1"

    def __init__(self, directory=None):
        self.directory = Path(directory or model_directory())
        self.engine = None

    @classmethod
    def from_env(cls):
        return cls()

    def check(self):
        check_model(self.directory)
        try:
            import sherpa_onnx
        except ImportError:
            raise MarketingError("로컬 음성 런타임이 없습니다. marketing/requirements.txt를 설치하세요.") from None
        return {"model": MODEL_NAME, "language": "ko", "speech_api_cost": 0}

    def load(self):
        self.check()
        if self.engine is None:
            import sherpa_onnx
            config = sherpa_onnx.OfflineTtsConfig(model=sherpa_onnx.OfflineTtsModelConfig(
                vits=sherpa_onnx.OfflineTtsVitsModelConfig(model=str(self.directory / "ko_KO-kss_low.onnx"),
                tokens=str(self.directory / "tokens.txt"), data_dir=str(self.directory / "espeak-ng-data")),
                num_threads=2, provider="cpu"), max_num_sentences=1)
            if not config.validate():
                raise MarketingError("한국어 음성 모델 설정을 검증하지 못했습니다.")
            self.engine = sherpa_onnx.OfflineTts(config)
        return self.engine

    def speak(self, episode, target):
        import numpy as np
        engine = self.load()
        target = Path(target).resolve()
        parts = target.parent / "voice-parts"
        parts.mkdir(exist_ok=True)
        durations = []
        for index, scene in enumerate(episode["scenes"]):
            path = parts / f"{index:02d}.wav"
            if not path.is_file():
                audio = engine.generate(pronounce(scene["narration"]), sid=0, speed=1.0)
                samples = np.asarray(audio.samples)
                if not len(samples) or not np.isfinite(samples).all() or np.abs(samples).max() < .005:
                    raise MarketingError("한국어 음성이 비었거나 무음입니다. 게시를 중단합니다.")
                temporary = path.with_suffix(".tmp.wav")
                with wave.open(str(temporary), "wb") as stream:
                    stream.setnchannels(1)
                    stream.setsampwidth(2)
                    stream.setframerate(audio.sample_rate)
                    stream.writeframes((np.clip(samples, -1, 1) * 32767).astype("<i2").tobytes())
                os.replace(temporary, path)
            seconds = float(probe(path)["format"]["duration"])
            if not 3 <= seconds <= 70:
                raise MarketingError("한국어 음성 장면 분량이 예상 범위를 벗어났습니다.")
            durations.append(seconds)
        timeline = parts / "voice.ffconcat"
        timeline.write_text("ffconcat version 1.0\n" + "\n".join(f"file '{i:02d}.wav'" for i in range(len(durations))) + "\n")
        run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i",
             str(timeline), "-c:a", "pcm_s16le", "-ar", "48000", "-ac", "1", str(target)])
        starts, ends, elapsed = [], [], 0.0
        for index, (scene, seconds) in enumerate(zip(episode["scenes"], durations)):
            text = scene["narration"] + ("\n\n" if index < len(durations) - 1 else "")
            for i in range(len(text)):
                starts.append(elapsed + seconds * i / len(text))
                ends.append(elapsed + seconds * (i + 1) / len(text))
            elapsed += seconds
        return {"characters": list(episode["narration"]), "character_start_times_seconds": starts,
                "character_end_times_seconds": ends, "timing_source": "measured-scene-audio"}
