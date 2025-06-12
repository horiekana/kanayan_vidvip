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

// Canvas要素を作成してタイル画像を切り出す関数（重複領域対応）
function createTileCanvas(video, row, col) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // 基本タイルサイズ
    const baseTileWidth = video.videoWidth / GRID_COLS;
    const baseTileHeight = video.videoHeight / GRID_ROWS;
    
    // 重複領域のサイズ計算
    const overlapWidth = baseTileWidth * OVERLAP_RATIO;
    const overlapHeight = baseTileHeight * OVERLAP_RATIO;
    
    // 実際のタイルサイズ（重複領域を含む）
    const actualTileWidth = baseTileWidth + (overlapWidth * 2);
    const actualTileHeight = baseTileHeight + (overlapHeight * 2);
    
    canvas.width = actualTileWidth;
    canvas.height = actualTileHeight;
    
    // 切り出し開始位置（重複分だけ前にずらす）
    const startX = Math.max(0, (col * baseTileWidth) - overlapWidth);
    const startY = Math.max(0, (row * baseTileHeight) - overlapHeight);
    
    // 実際の切り出しサイズ（画像境界を考慮）
    const cropWidth = Math.min(actualTileWidth, video.videoWidth - startX);
    const cropHeight = Math.min(actualTileHeight, video.videoHeight - startY);
    
    // 指定されたタイル部分を描画（重複領域を含む）
    ctx.drawImage(
        video,
        startX, startY, cropWidth, cropHeight,
        0, 0, cropWidth, cropHeight
    );
    
    return {
        canvas: canvas,
        offsetX: startX,
        offsetY: startY,
        baseTileWidth: baseTileWidth,
        baseTileHeight: baseTileHeight
    };
}

async function predictWebcamWithTiling() {
    if (runningMode === "IMAGE") {// 画像モードが初期化されている場合、ビデオモードに切り替える
        runningMode = "VIDEO";
        await objectDetector.setOptions({ runningMode: "VIDEO" });
    }// タイル処理のための時間を記録
    
    let nowInMs = Date.now();// 現在の時刻をミリ秒で取得
    if (video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        
        let allDetections = [];
        
        // 3x3のタイルに分割して処理
        for (let row = 0; row < GRID_ROWS; row++) {
            for (let col = 0; col < GRID_COLS; col++) {
                const tileInfo = createTileCanvas(video, row, col);
                
                // タイルごとに物体検出を実行（静止画として処理）
                const tileDetections = await objectDetector.detect(tileInfo.canvas);
                
                // 座標をオリジナル画像に変換
                tileDetections.detections.forEach(detection => {
                    // バウンディングボックスの座標を調整（重複領域のオフセットを考慮）
                    detection.boundingBox.originX += tileInfo.offsetX;
                    detection.boundingBox.originY += tileInfo.offsetY;
                    allDetections.push(detection);
                });
            }
        }
        
        // 重複する検出結果をマージ
        const mergedDetections = mergeOverlappingDetections(allDetections);
        
        // 全体の検出結果を処理
        gotDetections({ detections: mergedDetections });
    }
    
    window.requestAnimationFrame(predictWebcamWithTiling);
}

// 重複する検出結果をマージする関数
function mergeOverlappingDetections(detections) {
    const mergedDetections = [];
    const processed = new Set();
    
    for (let i = 0; i < detections.length; i++) {
        if (processed.has(i)) continue;
        
        const detection1 = detections[i];
        let bestDetection = detection1;
        processed.add(i);
        
        // 他の検出結果と比較
        for (let j = i + 1; j < detections.length; j++) {
            if (processed.has(j)) continue;
            
            const detection2 = detections[j];
            
            // 同じカテゴリかつ重複する場合
            if (detection1.categories[0].categoryName === detection2.categories[0].categoryName &&
                calculateIoU(detection1.boundingBox, detection2.boundingBox) > 0.3) {
                
                // より高いスコアの検出結果を採用
                if (detection2.categories[0].score > bestDetection.categories[0].score) {
                    bestDetection = detection2;
                }
                processed.add(j);
            }
        }
        
        mergedDetections.push(bestDetection);
    }
    
    return mergedDetections;
}

// IoU（Intersection over Union）計算
function calculateIoU(box1, box2) {
    const x1 = Math.max(box1.originX, box2.originX);
    const y1 = Math.max(box1.originY, box2.originY);
    const x2 = Math.min(box1.originX + box1.width, box2.originX + box2.width);
    const y2 = Math.min(box1.originY + box1.height, box2.originY + box2.height);
    
    if (x2 <= x1 || y2 <= y1) return 0;
    
    const intersection = (x2 - x1) * (y2 - y1);
    const area1 = box1.width * box1.height;
    const area2 = box2.width * box2.height;
    const union = area1 + area2 - intersection;
    
    return intersection / union;
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