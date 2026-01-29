import PIL.Image

if not hasattr(PIL.Image, 'ANTIALIAS'):
    PIL.Image.ANTIALIAS = PIL.Image.LANCZOS

# ---------------------------------------------------

from moviepy.editor import *
import os

# --- CONFIGURAÇÕES --- (pode alterar como preferir)
PASTA_IMAGENS = "./imagens" 
ARQUIVO_AUDIO = "locucao.mp3"
NOME_FINAL = "video_pronto.mp4"
RESOLUCAO = (1920, 1080)

#Redimensionamento do determinado conteúdo
def redimensionar_para_preencher(clip, target_resolution): 
    w_target, h_target = target_resolution
    clip_resized = clip.resize(height=h_target)
    if clip_resized.w < w_target:
        clip_resized = clip.resize(width=w_target)
        
    return clip_resized.crop(x1=clip_resized.w/2 - w_target/2, 
                             y1=clip_resized.h/2 - h_target/2, 
                             width=w_target, height=h_target)

# Criador do vídeo
def criar_video():
    print("--- INICIANDO PROCESSAMENTO DE VÍDEO ---")
    
    if not os.path.exists(PASTA_IMAGENS) or not os.path.exists(ARQUIVO_AUDIO):
        print(f"ERRO: Verifique se a pasta '{PASTA_IMAGENS}' e o arquivo '{ARQUIVO_AUDIO}' existem.")
        return

    try:
        audio_clip = AudioFileClip(ARQUIVO_AUDIO)
        duracao_total = audio_clip.duration
        print(f"Áudio carregado: {duracao_total:.2f} segundos.")
    except Exception as e:
        print(f"Erro ao ler áudio: {e}")
        return

    arquivos = [f for f in os.listdir(PASTA_IMAGENS) if f.lower().endswith(('.png', '.jpg', '.jpeg'))]
    arquivos.sort()
    
    qtd_imagens = len(arquivos)
    if qtd_imagens == 0:
        print("Nenhuma imagem encontrada na pasta!")
        return

    tempo_por_imagem = duracao_total / qtd_imagens
    print(f"Encontradas {qtd_imagens} imagens. Cada uma terá {tempo_por_imagem:.2f} segundos.")

    clips_visuais = []
    print("Processando imagens (isso pode demorar)...")
    
    for i, imagem_nome in enumerate(arquivos):
        caminho_img = os.path.join(PASTA_IMAGENS, imagem_nome)
        clip = ImageClip(caminho_img).set_duration(tempo_por_imagem)
        clip = redimensionar_para_preencher(clip, RESOLUCAO)
        clips_visuais.append(clip)
        print(f"[{i+1}/{qtd_imagens}] Processada: {imagem_nome}")

    print("Renderizando vídeo final... Aguarde.")
    video_final = concatenate_videoclips(clips_visuais, method="compose")
    video_final = video_final.set_audio(audio_clip)
    
    # configurações do tipo do vídeo (pode ser alterada de acordo com a sua preferência)
    #----------------------------------------------------------------------------------
    video_final.write_videofile(NOME_FINAL, fps=24, codec='libx264', audio_codec='aac')
    #----------------------------------------------------------------------------------
    print(f"\nSUCESSO! Vídeo salvo como: {NOME_FINAL}")

if __name__ == "__main__":
    criar_video()