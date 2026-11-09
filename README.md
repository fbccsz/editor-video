# Editor de Vídeo Automatizado

Aplicação Python que transforma uma sequência de imagens e uma locução em um
vídeo. Há também uma demonstração web que roda inteiramente no navegador.

## Teste online

A versão web está disponível em:
**https://fbccsz.github.io/editor-video/**

Os arquivos selecionados ficam no navegador; nada é enviado para um servidor.
A demonstração exporta um arquivo WebM e funciona melhor em navegadores
modernos baseados em Chromium.

## Versão Python

### Instalação

```bash
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

O MoviePy também requer o FFmpeg disponível no sistema.

### Uso

Coloque as imagens em uma pasta e execute:

```bash
python criador_video.py --imagens ./imagens --audio locucao.mp3
```

Opções úteis:

```bash
python criador_video.py --help
python criador_video.py --imagens ./imagens --audio locucao.mp3 \
  --saida ./dist/video.mp4 --largura 1920 --altura 1080 --fps 24 \
  --preset fast --crf 18
```

As imagens suportadas (`PNG`, `JPG`, `JPEG` e `WEBP`) são ordenadas pelo nome,
dividindo igualmente a duração da locução entre elas. Cada imagem é recortada
ao centro para preencher a resolução escolhida. O processamento prepara cada
imagem uma única vez antes da codificação, usa H.264 com pixel format compatível
com players comuns e AAC a 192 kbps. `--crf 18` prioriza qualidade; valores
maiores geram arquivos menores, e `--preset ultrafast` acelera a exportação em
troca de compressão menos eficiente.

Na versão web, a opção **Alta · 1080p** usa bitrate de vídeo de 12 Mbps e
**Rápida · 720p** usa 6 Mbps. Quando há áudio, a duração da trilha é dividida
entre as imagens e o áudio é conectado somente ao arquivo final, sem tocar nos
alto-falantes durante a exportação.

## Publicação

O workflow `.github/workflows/deploy-pages.yml` publica automaticamente a
pasta `web/` no GitHub Pages a cada atualização da branch principal. No
repositório, habilite **Settings → Pages → Source: GitHub Actions** caso ainda
não esteja habilitado.
