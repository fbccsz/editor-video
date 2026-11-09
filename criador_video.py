"""Cria um vídeo a partir de imagens e uma locução.

Uso:
    python criador_video.py --imagens ./imagens --audio locucao.mp3
"""

from __future__ import annotations

import argparse
import logging
from pathlib import Path
from typing import Iterable

from PIL import Image
from moviepy.editor import AudioFileClip, ImageClip, concatenate_videoclips


LOGGER = logging.getLogger("criador_video")
EXTENSOES_IMAGEM = {".png", ".jpg", ".jpeg", ".webp"}
RESOLUCAO_PADRAO = (1920, 1080)

# MoviePy 1.0.3 still references this Pillow 9.x name.
if not hasattr(Image, "ANTIALIAS"):
    Image.ANTIALIAS = Image.Resampling.LANCZOS


def redimensionar_para_preencher(clip, target_resolution: tuple[int, int]):
    """Redimensiona e recorta o clipe para preencher a resolução informada."""
    largura, altura = target_resolution
    escala = max(largura / clip.w, altura / clip.h)
    redimensionado = clip.resize(escala)
    return redimensionado.crop(
        x_center=redimensionado.w / 2,
        y_center=redimensionado.h / 2,
        width=largura,
        height=altura,
    )


def listar_imagens(pasta: Path) -> list[Path]:
    """Retorna imagens suportadas em ordem alfabética."""
    return sorted(
        caminho
        for caminho in pasta.iterdir()
        if caminho.is_file() and caminho.suffix.lower() in EXTENSOES_IMAGEM
    )


def criar_video(
    pasta_imagens: str | Path = "imagens",
    arquivo_audio: str | Path = "locucao.mp3",
    nome_final: str | Path = "video_pronto.mp4",
    resolucao: tuple[int, int] = RESOLUCAO_PADRAO,
    fps: int = 24,
) -> Path:
    """Monta o vídeo e retorna o caminho do arquivo gerado."""
    pasta = Path(pasta_imagens)
    audio_path = Path(arquivo_audio)
    output_path = Path(nome_final)

    if not pasta.is_dir():
        raise FileNotFoundError(f"Pasta de imagens não encontrada: {pasta}")
    if not audio_path.is_file():
        raise FileNotFoundError(f"Arquivo de áudio não encontrado: {audio_path}")
    if len(resolucao) != 2 or any(valor <= 0 for valor in resolucao):
        raise ValueError("A resolução deve conter largura e altura positivas.")
    if fps <= 0:
        raise ValueError("O FPS deve ser maior que zero.")

    imagens = listar_imagens(pasta)
    if not imagens:
        raise ValueError(f"Nenhuma imagem suportada encontrada em {pasta}")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    clips = []
    try:
        with AudioFileClip(str(audio_path)) as audio:
            if audio.duration <= 0:
                raise ValueError("O áudio não possui duração válida.")

            duracao = audio.duration / len(imagens)
            for imagem in imagens:
                clip = ImageClip(str(imagem)).set_duration(duracao)
                clips.append(redimensionar_para_preencher(clip, resolucao))

            video = concatenate_videoclips(clips, method="compose").set_audio(audio)
            try:
                video.write_videofile(
                    str(output_path),
                    fps=fps,
                    codec="libx264",
                    audio_codec="aac",
                    logger=None,
                )
            finally:
                video.close()
    finally:
        for clip in clips:
            clip.close()

    return output_path


def _parse_args(args: Iterable[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--imagens", default="imagens", help="Pasta com as imagens.")
    parser.add_argument("--audio", default="locucao.mp3", help="Arquivo de locução.")
    parser.add_argument("--saida", default="video_pronto.mp4", help="Vídeo de saída.")
    parser.add_argument("--largura", type=int, default=1920)
    parser.add_argument("--altura", type=int, default=1080)
    parser.add_argument("--fps", type=int, default=24)
    return parser.parse_args(args)


def main(args: Iterable[str] | None = None) -> int:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    options = _parse_args(args)
    try:
        output = criar_video(
            options.imagens,
            options.audio,
            options.saida,
            (options.largura, options.altura),
            options.fps,
        )
    except (FileNotFoundError, ValueError, OSError) as error:
        LOGGER.error("Erro: %s", error)
        return 1

    LOGGER.info("Vídeo salvo como: %s", output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
