"""Contract and recovery checks: no external requests or paid generation."""
import copy
import json
import os
import tempfile
import unittest
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import Mock, patch

from PIL import Image, ImageDraw, ImageFont

from marketing import content, media, oauth, pipeline, services
from marketing import voice as local_voice


def reply(status=200, value=None, headers=None):
    return services.Reply(status, headers or {}, json.dumps(value or {}).encode())


class QueueTransport:
    def __init__(self, *responses):
        self.responses = list(responses)
        self.calls = []

    def request(self, method, url, headers=None, body=None):
        self.calls.append((method, url, headers or {}, body))
        result = self.responses.pop(0)
        if isinstance(result, Exception):
            raise result
        return result


def youtube(transport=None):
    return services.YouTube({"client_id": "test-id", "client_secret": "test-secret",
                            "refresh_token": "test-refresh", "channel_id": "UC-test"}, transport)


def remote(episode, video_id="test-video"):
    return {"id": video_id, "snippet": {"channelId": episode["channel_id"],
            "description": episode["description"]}, "status": {"privacyStatus": "private",
            "publishAt": episode["publish_at"], "uploadStatus": "uploaded"}}


class ContentTests(unittest.TestCase):
    def setUp(self):
        self.catalog = content.load_catalog()
        self.day = date(2030, 1, 2)

    def test_reviewed_catalog_has_30_distinct_source_checked_topics(self):
        self.assertEqual(len(self.catalog["topics"]), 30)
        for topic in self.catalog["topics"]:
            episode = content.build_episode(topic, self.day)
            self.assertEqual(len(episode["scenes"]), 18)
            self.assertAlmostEqual(sum(episode["scene_seconds"]), 330)
            self.assertIn("AI 음성", episode["description"])
            self.assertIn("#list", episode["description"])
            self.assertNotIn(".입니다", episode["narration"])

    def test_changed_source_blocks_generation(self):
        catalog = copy.deepcopy(self.catalog)
        catalog["topics"][0]["source_sha256"] = "changed"
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "catalog.json"
            path.write_text(json.dumps(catalog))
            with self.assertRaises(content.MarketingError):
                content.load_catalog(path)

    def test_queue_exhaustion_never_repeats_topics(self):
        with self.assertRaises(content.MarketingError):
            content.select_topic(self.catalog, {t["id"] for t in self.catalog["topics"]})

    def test_publication_uses_korean_date_at_20(self):
        self.assertEqual(content.publish_at(self.day).isoformat(), "2030-01-02T11:00:00+00:00")
        self.assertEqual(content.next_day(datetime(2030, 1, 1, 16, tzinfo=timezone.utc)), self.day + timedelta(days=1))

    def test_private_terms_fail_without_echoing_term(self):
        episode = content.build_episode(self.catalog["topics"][0], self.day)
        with patch.dict(os.environ, {"BN_PRIVATE_BANNED": "PrivateTestValue"}):
            episode["description"] += "PrivateTestValue"
            with self.assertRaises(content.MarketingError) as error:
                content.validate_copy(episode)
        self.assertNotIn("PrivateTestValue", str(error.exception))

    def test_captions_preserve_all_narration_and_target_duration(self):
        episode = content.build_episode(self.catalog["topics"][0], self.day)
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "captions.srt"
            media.subtitles(episode, path)
            cues = path.read_text().strip().split("\n\n")
            narrated = "".join("".join(c.splitlines()[2:]) for c in cues)
            self.assertEqual("".join(narrated.split()), "".join(episode["narration"].split()))
            self.assertIn("00:05:30,000", cues[-1])
            self.assertIn("PlayResY: 1080", path.with_suffix(".ass").read_text())

    def test_word_wrap_preserves_spaces_even_for_single_char_words(self):
        draw = ImageDraw.Draw(Image.new("RGB", (10, 10)))
        font = ImageFont.truetype(str(media.FONT), 30)
        self.assertEqual(media.wrap(draw, "볼트 와 너트", font, 1000), ["볼트 와 너트"])
        lines = media.wrap(draw, "아주긴단어입니다", font, 65)
        self.assertEqual("".join(lines), "아주긴단어입니다")

    def test_preview_refused_before_upload_validation(self):
        with tempfile.TemporaryDirectory() as d:
            (Path(d) / "media.json").write_text('{"preview":true}')
            with self.assertRaisesRegex(content.MarketingError, "미리보기"):
                media.verify_media(d)

    def test_bad_alignment_is_not_silently_accepted(self):
        episode = content.build_episode(self.catalog["topics"][0], self.day)
        with self.assertRaises(content.MarketingError):
            media.align_scenes(episode, {"characters": ["wrong"]}, 330)


class YouTubeTests(unittest.TestCase):
    def setUp(self):
        self.episode = content.build_episode(content.load_catalog()["topics"][0], date(2030, 1, 2), "UC-test")
        self.url = "https://www.googleapis.com/upload/youtube/v3/videos?upload_id=test-only"

    def test_session_encrypted_and_bound_to_refresh_credential(self):
        encrypted = services.seal_session(self.url, "test-refresh")
        self.assertNotIn("upload_id", encrypted)
        self.assertEqual(services.open_session_secret(encrypted, "test-refresh"), self.url)
        with self.assertRaises(content.MarketingError):
            services.open_session_secret(encrypted, "other")

    def test_session_destinations_reject_credentials_and_non_google_hosts(self):
        for url in ("http://www.googleapis.com/upload/", "https://evil.example/upload/",
                    "https://www.googleapis.com.evil.example/upload/", "https://x@www.googleapis.com/upload/",
                    "https://www.googleapis.com:444/upload/", "https://www.googleapis.com/not-upload/"):
            with self.subTest(url=url), self.assertRaises(content.MarketingError):
                services.validate_session_url(url)

    def test_channel_mismatch_blocks_upload(self):
        client = youtube()
        client.get = Mock(return_value={"items": [{"id": "UC-other"}]})
        with self.assertRaises(content.MarketingError):
            client.channel()

    def test_incomplete_remote_inventory_blocks_deduplication(self):
        client = youtube()
        client.channel = Mock(return_value={"contentDetails": {"relatedPlaylists": {"uploads": "p"}}})
        client.get = Mock(side_effect=[{"items": [{"contentDetails": {"videoId": "v"}}]}, {"items": []}])
        with self.assertRaisesRegex(content.MarketingError, "불완전"):
            client.inventory()

    def test_initial_insert_is_private_scheduled_and_discloses_synthetic_voice(self):
        transport = QueueTransport(reply(headers={"Location": self.url}))
        client = youtube(transport)
        client.auth = Mock(return_value={"Authorization": "Bearer test-access"})
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "video.mp4"
            path.write_bytes(b"media")
            session = client.begin_upload(self.episode, path)
        payload = json.loads(transport.calls[0][3])
        self.assertEqual(payload["status"]["privacyStatus"], "private")
        self.assertEqual(payload["status"]["publishAt"], self.episode["publish_at"])
        self.assertTrue(payload["status"]["containsSyntheticMedia"])
        self.assertFalse(payload["status"]["selfDeclaredMadeForKids"])
        self.assertNotIn("upload_id", session)

    @patch("marketing.services.time.sleep")
    def test_lost_response_resumes_same_session_without_inserting_video(self, _sleep):
        transport = QueueTransport(reply(308), content.MarketingError("lost response"),
                                   reply(308, headers={"Range": "bytes=0-2"}), reply(value={"id": "v"}))
        client = youtube(transport)
        client.auth = Mock(return_value={"Authorization": "Bearer test-access"})
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "video.mp4"
            path.write_bytes(b"abcdef")
            result = client.upload(services.seal_session(self.url, "test-refresh"), path)
        self.assertEqual(result["id"], "v")
        self.assertTrue(all(method == "PUT" and url == self.url for method, url, _, _ in transport.calls))
        self.assertEqual(transport.calls[-1][2]["Content-Range"], "bytes 3-5/6")
        self.assertEqual(transport.calls[-1][3], b"def")

    def test_completed_session_never_resends_media(self):
        transport = QueueTransport(reply(value={"id": "v"}))
        client = youtube(transport)
        client.auth = Mock(return_value={})
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "video.mp4"
            path.write_bytes(b"media")
            self.assertEqual(client.upload(services.seal_session(self.url, "test-refresh"), path)["id"], "v")
        self.assertEqual(len(transport.calls), 1)
        self.assertEqual(transport.calls[0][3], b"")

    def test_invalid_offsets_fail_closed(self):
        for value in ("bytes=2-4", "bytes=0-99", "bytes=0--1", "not-a-range"):
            with self.subTest(value=value), self.assertRaises(content.MarketingError):
                services.YouTube.offset(reply(308, headers={"Range": value}), 6)

    def test_scheduled_video_with_wrong_privacy_blocks_completion(self):
        client = youtube()
        video = remote(self.episode)
        video["status"]["privacyStatus"] = "unlisted"
        client.get = Mock(return_value={"items": [video]})
        with self.assertRaises(content.MarketingError):
            client.verify_schedule("v", self.episode)

    def test_processing_rejection_blocks_completion(self):
        client = youtube()
        video = remote(self.episode)
        video["status"]["uploadStatus"] = "rejected"
        client.get = Mock(return_value={"items": [video]})
        with self.assertRaises(content.MarketingError):
            client.verify_schedule("v", self.episode)


class RecoveryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.day = date(2030, 1, 2)
        self.episode = content.build_episode(content.load_catalog()["topics"][0], self.day, "UC-test")
        self.client = Mock()
        self.client.credentials = {"channel_id": "UC-test"}
        channel = {"id": "UC-test", "snippet": {"title": "Test"}}
        self.client.channel.return_value = channel
        self.client.inventory.return_value = channel, []
        self.client.begin_upload.return_value = "encrypted-only"
        self.client.upload.return_value = {"id": "v"}
        self.voice = Mock(profile="test-local-voice")
        self.voice.speak.return_value = {}

    def renderer(self, episode, directory, **_kwargs):
        pipeline.write_json(directory / "episode.json", episode)
        for name in ("video.mp4", "thumbnail.png", "captions.srt", "narration.txt", "media.json"):
            (directory / name).write_bytes(b"test fixture")

    def prepare(self):
        with patch("marketing.pipeline.verify_media"):
            return pipeline.prepare(self.root, self.day, self.client, self.voice, self.renderer)

    def test_preparation_saves_session_before_transferring_bytes(self):
        result = self.prepare()
        self.assertTrue(result["checkpoint_required_before_transfer"])
        self.client.upload.assert_not_called()
        self.assertEqual(pipeline.read_state(self.root, "UC-test")["pending"]["encrypted_session"], "encrypted-only")

    def test_interrupted_prepared_run_reuses_session_and_voice(self):
        self.prepare()
        self.assertEqual(self.prepare()["status"], "resume")
        self.assertEqual(self.client.begin_upload.call_count, 1)
        self.assertEqual(self.voice.speak.call_count, 1)

    def test_same_day_remote_video_skips_without_voice_spending(self):
        channel, _ = self.client.inventory.return_value
        self.client.inventory.return_value = channel, [remote(self.episode)]
        self.assertTrue(self.prepare()["skip"])
        self.client.verify_schedule.assert_called_once()
        self.voice.speak.assert_not_called()
        self.client.begin_upload.assert_not_called()

    def test_duplicate_remote_date_blocks_new_upload(self):
        with self.assertRaises(content.MarketingError):
            pipeline.matching_day([remote(self.episode), remote(self.episode, "v2")], "UC-test", self.day)

    def test_remote_completed_after_interruption_prevents_media_resend(self):
        self.prepare()
        channel, _ = self.client.inventory.return_value
        self.client.inventory.return_value = channel, [remote(self.episode)]
        with patch("marketing.pipeline.verify_media"):
            report = pipeline.upload(self.root, self.client)
        self.assertEqual(report["video_id"], "test-video")
        self.client.upload.assert_not_called()
        self.assertIsNone(pipeline.read_state(self.root, "UC-test")["pending"])

    def test_thumbnail_failure_preserves_video_id_for_retry(self):
        self.prepare()
        self.client.thumbnail.side_effect = [content.MarketingError("thumbnail failed"), {}]
        with patch("marketing.pipeline.verify_media"):
            with self.assertRaises(content.MarketingError):
                pipeline.upload(self.root, self.client)
            self.assertEqual(pipeline.read_state(self.root, "UC-test")["pending"]["video_id"], "v")
            pipeline.upload(self.root, self.client)
        self.assertEqual(self.client.upload.call_count, 1)
        self.assertEqual(len(pipeline.read_state(self.root, "UC-test")["completed"]), 1)

    def test_unknown_pending_folder_preserved(self):
        directory = self.root / "pending"
        directory.mkdir()
        path = directory / "user-file.txt"
        path.write_text("preserve")
        with self.assertRaises(content.MarketingError):
            self.prepare()
        self.assertEqual(path.read_text(), "preserve")

    def test_upload_without_checkpoint_never_starts_session(self):
        with self.assertRaises(content.MarketingError):
            pipeline.upload(self.root, self.client)
        self.client.begin_upload.assert_not_called()
        self.client.upload.assert_not_called()

    @patch("time.sleep")
    def test_checkpoint_missing_or_wrong_key_blocks_transfer(self, _sleep):
        transport = QueueTransport(*[reply(value={"actions_caches": [{"key": "other", "size_in_bytes": 99}]}) for _ in range(3)])
        with self.assertRaises(content.MarketingError):
            pipeline.verify_checkpoint("owner/repo", "expected", "test-token", transport)

    def test_checkpoint_requires_actual_nonempty_remote_cache(self):
        transport = QueueTransport(reply(value={"actions_caches": [{"key": "expected", "size_in_bytes": 99}]}))
        self.assertEqual(pipeline.verify_checkpoint("owner/repo", "expected", "test-token", transport)["status"], "checkpoint_saved")

    def test_oauth_secret_output_inside_public_repo_rejected(self):
        with self.assertRaisesRegex(content.MarketingError, "저장소 밖"):
            oauth.connect("does-not-exist", content.ROOT / "secret-test.json")

    def test_foreign_channel_state_rejected(self):
        pipeline.save_state(self.root, pipeline.initial_state("other-channel"))
        with self.assertRaises(content.MarketingError):
            pipeline.read_state(self.root, "UC-test")


class LocalVoiceTests(unittest.TestCase):
    def test_abbreviations_have_explicit_korean_pronunciation(self):
        self.assertEqual(local_voice.pronounce("BOM RFQ Sales UNC"), "비오엠 알에프큐 세일즈 유 엔 씨")

    def test_missing_or_modified_model_cannot_run(self):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "ko_KO-kss_low.onnx"
            path.write_bytes(b"wrong model")
            with self.assertRaises(content.MarketingError):
                local_voice.check_model(d)

    @patch("marketing.voice.urllib.request.urlopen")
    def test_setup_never_redownloads_over_unknown_existing_files(self, download):
        with tempfile.TemporaryDirectory() as d:
            with self.assertRaises(content.MarketingError):
                local_voice.setup_model(d)
        download.assert_not_called()

    @patch("marketing.voice.urllib.request.urlopen")
    def test_bad_archive_checksum_blocks_install(self, download):
        import io
        download.return_value.__enter__.return_value = io.BytesIO(b"wrong archive")
        with tempfile.TemporaryDirectory() as d:
            destination = Path(d) / "model"
            with self.assertRaisesRegex(content.MarketingError, "체크섬"):
                local_voice.setup_model(destination)
            self.assertFalse(destination.exists())

    def test_silent_inference_does_not_make_publishable_audio(self):
        import numpy as np
        speaker = local_voice.LocalVoice()
        engine = Mock()
        engine.generate.return_value = Mock(samples=np.zeros(200), sample_rate=22050)
        speaker.load = Mock(return_value=engine)
        episode = {"scenes": [{"narration": "무음 방지 테스트"}]}
        with tempfile.TemporaryDirectory() as d:
            with self.assertRaisesRegex(content.MarketingError, "무음"):
                speaker.speak(episode, Path(d) / "voice.wav")
            self.assertFalse((Path(d) / "voice-parts/00.wav").exists())


if __name__ == "__main__":
    unittest.main()
