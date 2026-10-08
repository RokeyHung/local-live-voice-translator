# /// script
# requires-python = ">=3.11"
# dependencies = ["matplotlib>=3.8"]
# ///
"""Vẽ bốn biểu đồ số đo của Chương 4 khóa luận, đọc thẳng từ ``docs/results/``.

    uv run --no-project docs/gvhd/khoa-luan-hinh/src/charts.py

Số trong hình phải trùng số trong bảng của chương, nên script không chép tay con số nào:
ASR và độ trễ đọc từ JSON gốc, tách câu đọc từ ``endpointing-3-nguon.txt``.

Quy cách: in trên giấy trắng nên chỉ có chế độ sáng; bốn màu đầu của bảng màu tham chiếu
(đã qua bộ kiểm tra của skill dataviz: CVD ΔE ≥ 9,1 giữa các cặp kề nhau). Hai màu aqua và
vàng có độ tương phản dưới 3:1 trên nền trắng, nên mọi cột đều ghi số trực tiếp — và mỗi
hình đều có bảng số tương ứng trong chương.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
from matplotlib.ticker import FuncFormatter  # noqa: E402

ROOT = Path(__file__).resolve().parents[4]
RESULTS = ROOT / "docs" / "results"
OUT = Path(__file__).resolve().parents[1]

SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100"]
INK, INK2, GRID = "#0b0b0b", "#52514e", "#e4e3df"

plt.rcParams.update(
    {
        "font.family": "Times New Roman",
        "font.size": 11,
        "axes.edgecolor": INK2,
        "axes.labelcolor": INK,
        "xtick.color": INK2,
        "ytick.color": INK2,
        "axes.spines.top": False,
        "axes.spines.right": False,
        "axes.grid": True,
        "axes.grid.axis": "y",
        "grid.color": GRID,
        "grid.linewidth": 0.8,
        "axes.axisbelow": True,
        "legend.frameon": False,
        "savefig.dpi": 200,
        "savefig.facecolor": "white",
    }
)


def vn(x: float, digits: int = 1) -> str:
    """Số kiểu Việt: dấu phẩy thập phân."""
    return f"{x:.{digits}f}".replace(".", ",")


def grouped(ax, groups, series, values, fmt, gap=0.02):
    """Cột nhóm; khe trắng giữa các cột kề nhau, số ghi trên đầu cột."""
    n = len(series)
    width = 0.8 / n
    for i, name in enumerate(series):
        xs = [g + (i - (n - 1) / 2) * width for g in range(len(groups))]
        ys = [values[name][j] for j in range(len(groups))]
        bars = ax.bar(xs, ys, width - gap, color=SERIES[i], label=name, zorder=2)
        for b, y in zip(bars, ys):
            ax.annotate(
                fmt(y),
                (b.get_x() + b.get_width() / 2, y),
                xytext=(0, 2),
                textcoords="offset points",
                ha="center",
                va="bottom",
                fontsize=8.5,
                color=INK,
            )
    ax.set_xticks(range(len(groups)))
    ax.set_xticklabels(groups)


def load(name: str) -> dict:
    return json.loads((RESULTS / name).read_text(encoding="utf-8"))


def fig_wer() -> None:
    runs = {
        "whisper.cpp q5_0 (Windows)": "eval-asr-ggml-win-vulkan.json",
        "faster-whisper fp16 (Windows)": "eval-asr-fasterwhisper-win.json",
        "MLX large-v3 8-bit (macOS)": "eval-asr-fleurs-full.json",
    }
    langs = ["vi", "en", "zh", "ja"]
    values = {}
    for label, f in runs.items():
        score = {x["language"]: x["score"] for x in load(f)["languages"]}
        values[label] = [score[lang] * 100 for lang in langs]
    fig, ax = plt.subplots(figsize=(7.2, 3.6))
    grouped(
        ax,
        ["vi (WER)", "en (WER)", "zh (CER)", "ja (CER)"],
        list(runs),
        values,
        lambda y: vn(y) + "%",
    )
    ax.set_ylabel("Tỷ lệ lỗi (%), càng thấp càng tốt")
    ax.set_ylim(0, 12.5)
    ax.legend(loc="upper right", fontsize=9.5)
    fig.tight_layout()
    fig.savefig(OUT / "h4-1-wer.png")
    plt.close(fig)


DIRECTIONS = ["vi-en", "en-vi", "vi-zh", "zh-vi", "vi-ja", "ja-vi"]


def latency(suffix: str) -> dict[str, dict]:
    return {d: load(f"eval-latency-{d}{suffix}.json")["summary"] for d in DIRECTIONS}


def fig_rtf() -> None:
    mac, win = latency(""), latency("-win")
    values = {
        "macOS (MLX + MPS)": [mac[d]["rtf_p90"] for d in DIRECTIONS],
        "Windows (Vulkan + CUDA)": [win[d]["rtf_p90"] for d in DIRECTIONS],
    }
    fig, ax = plt.subplots(figsize=(7.2, 3.6))
    grouped(
        ax,
        [d.replace("-", "→") for d in DIRECTIONS],
        list(values),
        values,
        lambda y: vn(y, 3),
    )
    for y, text in ((1.0, "cần: RTF p90 < 1"), (0.5, "đủ để nói: RTF p90 ≤ 0,5")):
        ax.axhline(y, color=INK2, linewidth=1, linestyle=(0, (4, 3)), zorder=1)
        ax.text(5.45, y + 0.015, text, ha="right", va="bottom", fontsize=9, color=INK2)
    ax.yaxis.set_major_formatter(FuncFormatter(lambda v, _: vn(v, 1)))
    ax.set_ylabel("RTF p90, càng thấp càng tốt")
    ax.set_ylim(0, 1.1)
    ax.legend(loc="upper left", fontsize=9.5)
    fig.tight_layout()
    fig.savefig(OUT / "h4-2-rtf.png")
    plt.close(fig)


def fig_stages() -> None:
    win = latency("-win")
    stages = [
        ("VAD", "vad_ms_mean"),
        ("ASR", "asr_ms_mean"),
        ("MT", "mt_ms_mean"),
        ("TTS", "tts_ms_mean"),
    ]
    fig, ax = plt.subplots(figsize=(7.2, 3.4))
    ax.grid(axis="x", color=GRID)
    ax.grid(axis="y", visible=False)
    ys = range(len(DIRECTIONS))
    left = [0.0] * len(DIRECTIONS)
    for i, (name, key) in enumerate(stages):
        widths = [win[d][key] for d in DIRECTIONS]
        ax.barh(
            ys,
            widths,
            left=left,
            height=0.62,
            color=SERIES[i],
            label=name,
            edgecolor="white",
            linewidth=1.5,
            zorder=2,
        )
        left = [a + b for a, b in zip(left, widths)]
    for y, d in zip(ys, DIRECTIONS):
        # Tổng đọc từ summary, không cộng lại từ trung bình từng khâu: cộng bốn số đã
        # làm tròn thì lệch bảng 1 ms.
        total = win[d]["total_ms_mean"]
        tts = win[d]["tts_ms_mean"] / total * 100
        # Làm tròn nửa lên như bảng trong chương (1.176,5 → 1.177); định dạng của Python
        # làm tròn về số chẵn và ra 1.176.
        shown = int(total + 0.5)
        ax.text(
            total + 40,
            y,
            f"{shown:,} ms · TTS {vn(tts, 0)}%".replace(",", "."),
            va="center",
            fontsize=9,
            color=INK,
        )
    ax.set_yticks(list(ys))
    ax.set_yticklabels([d.replace("-", "→") for d in DIRECTIONS])
    ax.invert_yaxis()
    ax.set_xlabel("Thời gian trung bình mỗi mẫu FLEURS (ms)")
    ax.set_xlim(0, 5200)
    ax.xaxis.set_major_formatter(
        FuncFormatter(lambda v, _: f"{v:,.0f}".replace(",", "."))
    )
    ax.legend(loc="lower center", bbox_to_anchor=(0.5, 1.0), ncol=4, fontsize=9.5)
    fig.tight_layout()
    fig.savefig(OUT / "h4-3-cac-khau.png")
    plt.close(fig)


ROW = re.compile(r"^(\S.*?)\s{2,}(\d+)\s+([\d.]+)s\s+([\d.]+)s\s+\d+ \((\d+)%\)")


def fig_endpointing() -> None:
    text = (RESULTS / "endpointing-3-nguon.txt").read_text(encoding="utf-8")
    blocks = {}
    current = None
    for line in text.splitlines():
        if line.startswith("== "):
            current = line[3:].split(" —")[0].split(" ")[0]
            blocks[current] = {}
        elif current and (m := ROW.match(line)):
            blocks[current][m.group(1).split(" ")[0]] = (
                float(m.group(4)),
                int(m.group(5)),
            )
    names = {
        "Bản": "Bản tin\n(đọc kịch bản)",
        "Phỏng": "Phỏng vấn\n(hội thoại tự phát)",
        "TEDx": "TEDx\n(thuyết trình)",
    }
    configs = [
        ("trước", "Cũ (trần 20 s)"),
        ("fast", "Nhanh (4,5 s)"),
        ("balanced", "Cân bằng (6 s)"),
        ("quality", "Chất lượng (8 s)"),
    ]
    groups = [names[k] for k in blocks]
    p90 = {label: [blocks[k][c][0] for k in blocks] for c, label in configs}
    cut = {label: [blocks[k][c][1] for k in blocks] for c, label in configs}
    fig, (a1, a2) = plt.subplots(1, 2, figsize=(7.6, 3.7))
    grouped(a1, groups, list(p90), p90, lambda y: vn(y))
    a1.set_title("Độ dài đoạn p90 (giây)", fontsize=11, color=INK)
    a1.set_ylim(0, 14)
    grouped(a2, groups, list(cut), cut, lambda y: f"{y:.0f}%")
    a2.set_title("Tỷ lệ đoạn bị cắt cứng (%)", fontsize=11, color=INK)
    a2.set_ylim(0, 45)
    for a in (a1, a2):
        a.tick_params(axis="x", labelsize=9)
    handles, labels = a1.get_legend_handles_labels()
    fig.legend(handles, labels, loc="lower center", ncol=4, fontsize=9.5)
    fig.tight_layout(rect=(0, 0.08, 1, 1))
    fig.savefig(OUT / "h4-4-tach-cau.png")
    plt.close(fig)


if __name__ == "__main__":
    fig_wer()
    fig_rtf()
    fig_stages()
    fig_endpointing()
    print("đã vẽ 4 biểu đồ vào", OUT)
