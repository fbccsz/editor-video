const imageInput = document.querySelector("#images");
const audioInput = document.querySelector("#audio");
const imageList = document.querySelector("#image-list");
const audioName = document.querySelector("#audio-name");
const durationInput = document.querySelector("#duration");
const durationHelp = document.querySelector("#duration-help");
const formatInput = document.querySelector("#format");
const formatHelp = document.querySelector("#format-help");
const renderButton = document.querySelector("#render");
const clearButton = document.querySelector("#clear");
const status = document.querySelector("#status");
const preview = document.querySelector("#preview");
const emptyPreview = document.querySelector("#empty-preview");
const previewBadge = document.querySelector("#preview-badge");
const download = document.querySelector("#download");

let generatedUrl;
let imageFiles = [];
let audioFile;

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function dimensions(format) {
  if (format === "9:16") return [720, 1280];
  if (format === "1:1") return [1080, 1080];
  return [1280, 720];
}

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Não foi possível ler ${file.name}.`));
    };
    image.src = url;
  });
}

function getAudioDuration(file) {
  return new Promise((resolve, reject) => {
    const audio = document.createElement("audio");
    const url = URL.createObjectURL(file);
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(audio.duration) ? audio.duration : 0);
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Não foi possível ler a duração do áudio."));
    };
    audio.src = url;
  });
}

function drawCover(context, image, width, height) {
  const scale = Math.max(width / image.width, height / image.height);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  const sourceX = (image.width - sourceWidth) / 2;
  const sourceY = (image.height - sourceHeight) / 2;
  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, width, height);
}

function updateRenderState() {
  const hasImages = imageFiles.length > 0;
  renderButton.disabled = !hasImages;
  clearButton.hidden = !hasImages && !audioFile;
}

function renderImageList() {
  imageList.innerHTML = imageFiles.map((file, index) => {
    const url = URL.createObjectURL(file);
    const card = `<div class="file-card"><img src="${url}" alt=""><span class="file-number">${index + 1}</span><span title="${file.name}">${file.name}</span></div>`;
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return card;
  }).join("");
}

async function updateAudioDetails() {
  if (!audioFile) {
    audioName.textContent = "Opcional · MP3, WAV, OGG ou M4A";
    durationHelp.textContent = "Usado quando não há áudio.";
    return;
  }
  const duration = await getAudioDuration(audioFile);
  audioName.textContent = `${audioFile.name} · ${Math.round(duration)}s · ${formatBytes(audioFile.size)}`;
  durationHelp.textContent = `O áudio define a duração total (${Math.round(duration)}s).`;
}

function updateFormatHelp() {
  const [width, height] = dimensions(formatInput.value);
  formatHelp.textContent = `${width} × ${height} px`;
}

function resetPreview() {
  if (generatedUrl) URL.revokeObjectURL(generatedUrl);
  generatedUrl = undefined;
  preview.removeAttribute("src");
  preview.load();
  preview.hidden = true;
  emptyPreview.hidden = false;
  download.hidden = true;
  previewBadge.textContent = "Aguardando";
  previewBadge.classList.remove("ready");
}

async function renderVideo() {
  if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) {
    throw new Error("Seu navegador não suporta a geração de vídeo. Tente Chrome, Edge ou Firefox.");
  }
  const [width, height] = dimensions(formatInput.value);
  const fallbackDuration = Number(durationInput.value);
  if (!Number.isFinite(fallbackDuration) || fallbackDuration <= 0) {
    throw new Error("Informe um tempo válido por imagem.");
  }

  const audioDuration = audioFile ? await getAudioDuration(audioFile) : 0;
  const durationPerImage = audioDuration > 0 ? audioDuration / imageFiles.length : fallbackDuration;
  const images = await Promise.all(imageFiles.map(loadImage));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  const stream = canvas.captureStream(30);
  const audioUrl = audioFile ? URL.createObjectURL(audioFile) : undefined;
  const audioElement = audioFile ? new Audio(audioUrl) : undefined;
  let audioContext;
  let recorder;

  try {
    if (audioElement) {
      audioElement.preload = "auto";
      audioElement.loop = false;
      audioContext = new AudioContext();
      await audioContext.resume();
      const source = audioContext.createMediaElementSource(audioElement);
      const destination = audioContext.createMediaStreamDestination();
      // Não conectamos ao destino dos alto-falantes: a trilha só vai para o vídeo.
      source.connect(destination);
      destination.stream.getAudioTracks().forEach((track) => stream.addTrack(track));
    }

    const mimeType = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", ""]
      .find((candidate) => !candidate || MediaRecorder.isTypeSupported(candidate));
    recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const chunks = [];
    recorder.ondataavailable = (event) => event.data.size && chunks.push(event.data);
    const stopped = new Promise((resolve) => { recorder.onstop = resolve; });
    recorder.start(100);
    if (audioElement) {
      audioElement.currentTime = 0;
      await audioElement.play();
    }

    for (const [index, image] of images.entries()) {
      context.fillStyle = "#0e1117";
      context.fillRect(0, 0, width, height);
      drawCover(context, image, width, height);
      status.textContent = `Gerando imagem ${index + 1} de ${imageFiles.length}...`;
      await wait(durationPerImage * 1000);
    }

    recorder.stop();
    await stopped;
    return new Blob(chunks, { type: mimeType || "video/webm" });
  } finally {
    audioElement?.pause();
    audioElement?.removeAttribute("src");
    audioContext?.close();
    stream.getTracks().forEach((track) => track.stop());
    if (audioUrl) URL.revokeObjectURL(audioUrl);
  }
}

renderButton.addEventListener("click", async () => {
  renderButton.disabled = true;
  clearButton.disabled = true;
  resetPreview();
  previewBadge.textContent = "Processando";
  status.textContent = "Preparando seu vídeo...";
  try {
    const blob = await renderVideo();
    generatedUrl = URL.createObjectURL(blob);
    preview.src = generatedUrl;
    preview.hidden = false;
    emptyPreview.hidden = true;
    download.href = generatedUrl;
    download.download = "frameflow-video.webm";
    download.hidden = false;
    previewBadge.textContent = "Pronto";
    previewBadge.classList.add("ready");
    status.textContent = "Vídeo gerado. Assista à prévia ou baixe o arquivo.";
  } catch (error) {
    previewBadge.textContent = "Aguardando";
    status.textContent = error.message || "Não foi possível gerar o vídeo.";
  } finally {
    renderButton.disabled = imageFiles.length === 0;
    clearButton.disabled = false;
  }
});

imageInput.addEventListener("change", () => {
  imageFiles = [...imageInput.files];
  renderImageList();
  updateRenderState();
  status.textContent = imageFiles.length
    ? `${imageFiles.length} imagem(ns) pronta(s) para o vídeo.`
    : "Adicione pelo menos uma imagem para começar.";
});

audioInput.addEventListener("change", async () => {
  audioFile = audioInput.files[0];
  updateRenderState();
  try {
    await updateAudioDetails();
    status.textContent = audioFile ? "Trilha adicionada. Ela será incluída apenas no arquivo final." : status.textContent;
  } catch (error) {
    audioFile = undefined;
    audioInput.value = "";
    status.textContent = error.message;
    updateAudioDetails();
  }
});

clearButton.addEventListener("click", () => {
  imageFiles = [];
  audioFile = undefined;
  imageInput.value = "";
  audioInput.value = "";
  renderImageList();
  updateAudioDetails();
  resetPreview();
  updateRenderState();
  status.textContent = "Adicione pelo menos uma imagem para começar.";
});

formatInput.addEventListener("change", updateFormatHelp);
updateFormatHelp();
updateRenderState();
