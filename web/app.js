const imageInput = document.querySelector("#images");
const audioInput = document.querySelector("#audio");
const durationInput = document.querySelector("#duration");
const formatInput = document.querySelector("#format");
const renderButton = document.querySelector("#render");
const status = document.querySelector("#status");
const preview = document.querySelector("#preview");
const download = document.querySelector("#download");

let generatedUrl;

function dimensions(format) {
  if (format === "9:16") return [720, 1280];
  if (format === "1:1") return [1080, 1080];
  return [1280, 720];
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Não foi possível ler ${file.name}.`));
    image.src = URL.createObjectURL(file);
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

async function renderVideo() {
  const files = [...imageInput.files];
  if (!files.length) throw new Error("Selecione ao menos uma imagem.");
  if (!window.MediaRecorder) throw new Error("Este navegador não suporta a geração de vídeo.");

  const [width, height] = dimensions(formatInput.value);
  const duration = Number(durationInput.value);
  if (!Number.isFinite(duration) || duration <= 0) throw new Error("Informe uma duração válida.");

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  const stream = canvas.captureStream(30);
  const audioFile = audioInput.files[0];
  let audioContext;
  let audioElement;
  let audioUrl;

  if (audioFile) {
    audioUrl = URL.createObjectURL(audioFile);
    audioElement = new Audio(audioUrl);
    audioElement.crossOrigin = "anonymous";
    await audioElement.play().catch(() => {});
    audioContext = new AudioContext();
    const source = audioContext.createMediaElementSource(audioElement);
    const destination = audioContext.createMediaStreamDestination();
    source.connect(destination);
    source.connect(audioContext.destination);
    destination.stream.getAudioTracks().forEach((track) => stream.addTrack(track));
  }

  const mimeType = ["video/webm;codecs=vp9", "video/webm", ""]
    .find((candidate) => !candidate || MediaRecorder.isTypeSupported(candidate));
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks = [];
  recorder.ondataavailable = (event) => event.data.size && chunks.push(event.data);
  const stopped = new Promise((resolve) => { recorder.onstop = resolve; });
  recorder.start();

  for (const file of files) {
    const image = await loadImage(file);
    context.fillStyle = "#101522";
    context.fillRect(0, 0, width, height);
    drawCover(context, image, width, height);
    await new Promise((resolve) => setTimeout(resolve, duration * 1000));
    URL.revokeObjectURL(image.src);
  }

  recorder.stop();
  await stopped;
  audioElement?.pause();
  audioContext?.close();
  if (audioUrl) URL.revokeObjectURL(audioUrl);
  return new Blob(chunks, { type: "video/webm" });
}

renderButton.addEventListener("click", async () => {
  renderButton.disabled = true;
  download.hidden = true;
  status.textContent = "Gerando vídeo no navegador...";
  try {
    const blob = await renderVideo();
    if (generatedUrl) URL.revokeObjectURL(generatedUrl);
    generatedUrl = URL.createObjectURL(blob);
    preview.src = generatedUrl;
    download.href = generatedUrl;
    download.download = "video_pronto.webm";
    download.hidden = false;
    status.textContent = "Vídeo pronto. Você pode assistir ou baixar o resultado.";
  } catch (error) {
    status.textContent = error.message;
  } finally {
    renderButton.disabled = false;
  }
});

imageInput.addEventListener("change", () => {
  status.textContent = imageInput.files.length
    ? `${imageInput.files.length} imagem(ns) selecionada(s).`
    : "Selecione pelo menos uma imagem para começar.";
});
