// import { ObjectDetector, FilesetResolver } from "../node_modules/@mediapipe/tasks-vision/vision_bundle.mjs";
import { ObjectDetector, FilesetResolver } from "./vision_bundle.js";
var objectDetector;
let runningMode = "IMAGE";
// Initialize the object detector
const initializeObjectDetector = async () => {
    // const vision = await FilesetResolver.forVisionTasks("./node_modules/@mediapipe/tasks-vision/wasm");
    const vision = await FilesetResolver.forVisionTasks("./wasm");
    objectDetector = await ObjectDetector.createFromOptions(vision, {
        baseOptions: {
            modelAssetPath: `./models/model_fp16.tflite`,
            delegate: "GPU"
        },
        scoreThreshold: 0.35,
        runningMode: runningMode
    });
    enableCam();
    document.querySelector('#loading').style.display = 'none';
};
initializeObjectDetector();

/********************************************************************
 // Demo 2: Continuously grab image from webcam stream and detect it.
 ********************************************************************/
let video = document.getElementById("webcam");
let enableWebcamButton;

// Check if webcam access is supported.
function hasGetUserMedia() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}
// Keep a reference of all the child elements we create
// so we can remove them easilly on each render.
var children = [];
// If webcam supported, add event listener to button for when user
// wants to activate it.
if (hasGetUserMedia()) {
    // enableWebcamButton = document.getElementById("webcamButton");
    // enableWebcamButton.addEventListener("click", enableCam);
}
else {
    console.warn("getUserMedia() is not supported by your browser");
}
// Enable the live webcam view and start detection.
async function enableCam(event) {
    if (!objectDetector) {
        console.log("Wait! objectDetector not loaded yet.");
        return;
    }

    // getUsermedia parameters
    const constraints = {
        video: {
            width: { ideal: 3840 },  // 4K (横) を追加
            height: { ideal: 2160 }, // 4K (縦) を追加
            facingMode: 'environment' // 元々あったfacingModeも維持
        },
        audio: false // 音声が必要なければfalseを追加
    };
    // Activate the webcam stream.
    navigator.mediaDevices
        .getUserMedia(constraints)
        .then(function (stream) {
            video.srcObject = stream;
            video.addEventListener("loadeddata", () => {
                // ストリームの解像度が実際にどうなったかログに出力して確認
                console.log('Actual video resolution:', video.videoWidth, 'x', video.videoHeight);
                predictWebcam(); // データがロードされたら推論を開始
            });
        })
        .catch((err) => {
            console.error("Error accessing camera with specified constraints:", err);
            // エラーハンドリングを追加（前回の回答で提示したもの）
            if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
                alert("利用可能なカメラが見つかりませんでした。");
            } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
                alert("カメラにアクセスできません。他のアプリケーションでカメラが使用されているか、カメラが正しく動作していません。");
            } else if (err.name === "OverconstrainedError") {
                alert("要求された4K解像度はカメラでサポートされていません。より低い解像度を試してください。");
            } else if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
                alert("カメラの使用が拒否されました。ブラウザの権限設定を確認してください。");
            } else {
                alert("カメラの起動中に不明なエラーが発生しました: " + err.message);
            }
        });
}
let lastVideoTime = -1;
async function predictWebcam() {
    // if image mode is initialized, create a new classifier with video runningMode
    if (runningMode === "IMAGE") {
        runningMode = "VIDEO";
        await objectDetector.setOptions({ runningMode: "VIDEO" });
    }
    let nowInMs = Date.now();
    // Detect objects using detectForVideo
    if (video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        const detections = await objectDetector.detectForVideo(video, nowInMs);

        //displayVideoDetections(detections);
        gotDetections(detections);
    }
    // Call this function again to keep predicting when the browser is ready
    window.requestAnimationFrame(predictWebcam);
}

document.querySelector('#input_confidence_threshold').addEventListener('change', changedConfidenceThreshold);
function changedConfidenceThreshold(e) {
    objectDetector.setOptions(
        {
            scoreThreshold: e.srcElement.value
        }
    )
    document.querySelector('#confidence_threshold').innerHTML = e.srcElement.value;
}