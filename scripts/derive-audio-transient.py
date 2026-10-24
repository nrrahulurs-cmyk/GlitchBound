"""Derive a short PCM transient from an MP3 using Blender's bundled aud decoder.

Run with:
  blender --background --factory-startup --python scripts/derive-audio-transient.py -- \
    --input public/audio/glitchbound/weapon-gunfire-source.mp3 \
    --output public/audio/glitchbound/weapon-gunfire-one-shot.wav \
    --start 0.025 --end 0.50 --fade-in 0.006 --fade-out 0.055

This writes a new WAV and never edits the source recording. The selected region
and fade values are explicit inputs so the derivative is reproducible.
"""

import argparse
import os
import sys
import wave

import aud
import numpy as np


def parse_args():
    arguments = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--start", type=float, required=True)
    parser.add_argument("--end", type=float, required=True)
    parser.add_argument("--fade-in", type=float, default=0.0)
    parser.add_argument("--fade-out", type=float, default=0.0)
    return parser.parse_args(arguments)


def main():
    args = parse_args()
    if args.end <= args.start or args.start < 0:
        raise ValueError("Expected 0 <= start < end")
    if not os.path.isfile(args.input):
        raise FileNotFoundError(args.input)

    source = aud.Sound.file(args.input).cache()
    samples = np.asarray(source.data(), dtype=np.float64)
    sample_rate = int(round(source.specs[0]))
    channels = int(source.specs[1])
    start_frame = int(round(args.start * sample_rate))
    end_frame = int(round(args.end * sample_rate))
    if end_frame > len(samples):
        raise ValueError("End time exceeds decoded source duration")
    trimmed = samples[start_frame:end_frame].copy()
    if not len(trimmed):
        raise ValueError("Selected range contains no samples")

    fade_in_frames = min(len(trimmed), int(round(args.fade_in * sample_rate)))
    fade_out_frames = min(len(trimmed), int(round(args.fade_out * sample_rate)))
    if fade_in_frames:
        trimmed[:fade_in_frames] *= np.linspace(0.0, 1.0, fade_in_frames, endpoint=True)[:, None]
    if fade_out_frames:
        trimmed[-fade_out_frames:] *= np.linspace(1.0, 0.0, fade_out_frames, endpoint=True)[:, None]

    os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)
    pcm = np.clip(np.rint(trimmed * 32767.0), -32768, 32767).astype("<i2")
    with wave.open(args.output, "wb") as output:
        output.setnchannels(channels)
        output.setsampwidth(2)
        output.setframerate(sample_rate)
        output.writeframes(pcm.tobytes())

    print({
        "output": os.path.abspath(args.output),
        "sample_rate": sample_rate,
        "channels": channels,
        "duration_seconds": round(len(trimmed) / sample_rate, 6),
        "peak": round(float(np.abs(trimmed).max()), 6),
        "rms": round(float(np.sqrt(np.mean(trimmed ** 2))), 6),
        "source_start_seconds": args.start,
        "source_end_seconds": args.end,
        "fade_in_seconds": args.fade_in,
        "fade_out_seconds": args.fade_out,
    })


if __name__ == "__main__":
    main()
