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
let video = document.getElementById("webcam");// ビデオ要素を取得
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
                if (useTiling) {
                    predictWebcamWithTiling(); // 分割処理
                } else {
                    predictWebcam(); // 通常処理
                }
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
    if (video.currentTime !== lastVideoTime) {// ここでフレームが変わったか確認
        lastVideoTime = video.currentTime;
        const detections = await objectDetector.detectForVideo(video, nowInMs);

        //displayVideoDetections(detections);
        gotDetections(detections);
    }
    // Call this function again to keep predicting when the browser is ready
    window.requestAnimationFrame(predictWebcam);
}

// 画像分割設定
const GRID_ROWS = 3;      // 縦の分割数
const GRID_COLS = 3;      // 横の分割数
const OVERLAP_RATIO = 0.1; // 重複領域の比率（10%）

// Canvas要素を作成してタイル画像を切り出す関数
function createTileCanvas(video, row, col) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    const tileWidth = video.videoWidth / GRID_COLS;
    const tileHeight = video.videoHeight / GRID_ROWS;
    
    canvas.width = tileWidth;
    canvas.height = tileHeight;
    
    // 指定されたタイル部分を描画
    ctx.drawImage(
        video,
        col * tileWidth, row * tileHeight, tileWidth, tileHeight,
        0, 0, tileWidth, tileHeight
    );
    
    return canvas;
}

async function predictWebcamWithTiling() {
    if (runningMode === "IMAGE") {
        runningMode = "VIDEO";
        await objectDetector.setOptions({ runningMode: "VIDEO" });
    }
    
    let nowInMs = Date.now();
    if (video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        
        let allDetections = [];
        
        // 3x3のタイルに分割して処理
        for (let row = 0; row < GRID_ROWS; row++) {
            for (let col = 0; col < GRID_COLS; col++) {
                const tileCanvas = createTileCanvas(video, row, col);
                
                // タイルごとに物体検出を実行（静止画として処理）
                const tileDetections = await objectDetector.detect(tileCanvas);
                
                // 座標をオリジナル画像に変換
                const offsetX = col * (video.videoWidth / GRID_COLS);
                const offsetY = row * (video.videoHeight / GRID_ROWS);
                
                tileDetections.detections.forEach(detection => {
                    // バウンディングボックスの座標を調整
                    detection.boundingBox.originX += offsetX;
                    detection.boundingBox.originY += offsetY;
                    allDetections.push(detection);
                });
            }
        }
        
        // 全体の検出結果を処理
        gotDetections({ detections: allDetections });
    }
    
    window.requestAnimationFrame(predictWebcamWithTiling);
}

// 処理モードの設定
let useTiling = false; // true: 分割処理, false: 通常処理

document.querySelector('#input_confidence_threshold').addEventListener('change', changedConfidenceThreshold);//これは信頼度閾値の変更イベントリスナーです
function changedConfidenceThreshold(e) {
    objectDetector.setOptions(
        {
            scoreThreshold: e.srcElement.value
        }
    )
    document.querySelector('#confidence_threshold').innerHTML = e.srcElement.value;
}

// UI でモード切り替えボタンを追加
function toggleTilingMode() {
    useTiling = !useTiling;
    // 現在の処理を停止して新しい処理を開始
    if (useTiling) {
        predictWebcamWithTiling();
    } else {
        predictWebcam();
    }
}