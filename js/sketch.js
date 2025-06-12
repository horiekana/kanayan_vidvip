let version = `
last modified: 2023/09/20 12:20:49
`
var results;
let processingMode = 'normal'; // 'normal' または 'tiling'
let processingStats = {
    detectionCount: 0,
    lastUpdateTime: 0
};

function setup() {
    let p5canvas = createCanvas(400, 400);
    p5canvas.parent('#canvas');

    // お手々が見つかると以下の関数が呼び出される．resultsに検出結果が入っている．
    gotDetections = function (_results) {
        results = _results;
        
        // 統計情報を更新
        processingStats.detectionCount = results.detections ? results.detections.length : 0;
        processingStats.lastUpdateTime = Date.now();
        
        strokeWeight(5)
        let video_width = document.querySelector('#webcam').videoWidth;
        let video_height = document.querySelector('#webcam').videoHeight;
        // 取得したboundingBoxの値を現在のcanvas描画とあわせる前処理
        for (let d of results.detections) {
            let bb = d.boundingBox;
            let ratio = {
                x: width / video_width,
                y: height / video_height
            }
            bb.originX = ratio.x * bb.originX;
            bb.originY = ratio.y * bb.originY;
            bb.width *= ratio.x;
            bb.height *= ratio.y;
        }
        adjustCanvas();
        updateProcessingStatsDisplay();
    }

    document.querySelector('#version').innerHTML = version;
    
    // モード切り替えボタンの初期化
    createModeToggleButton();
}

function draw() {
    clear();
    if (results) {
        for (let detection of results.detections) {
            let index = detection.categories[0].index;
            let bb = detection.boundingBox;
            let name = detection.categories[0].categoryName;
            let score = detection.categories[0].score;
            // let c = getColorByIndex(index);
            let c = getColorByName(name);
            c = [...c, 250];
            stroke(c);
            strokeWeight(2);
            noFill();
            rect(
                bb.originX, bb.originY,
                bb.width, bb.height
            )
            fill(c);
            rect(
                bb.originX, bb.originY - 20,
                bb.width, 20
            )

            noStroke();
            fill(255);
            textSize(16);
            textAlign(LEFT, CENTER);
            text(`${name} : ${(100 * score).toFixed(0)} % `, bb.originX + 2, bb.originY - 10);
            index++;
        }
    }
    noFill();
    noStroke();
    rect(0, 0, 640, 480);

    stroke(250);
}

// モード切り替えボタンの作成
function createModeToggleButton() {
    // ボタンがすでに存在する場合は何もしない
    if (document.querySelector('#tilingToggleButton')) {
        return;
    }
    
    // ボタン要素を作成
    let button = document.createElement('button');
    button.id = 'tilingToggleButton';
    button.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        z-index: 1000;
        padding: 8px 16px;
        border: none;
        border-radius: 4px;
        background-color: #007bff;
        color: white;
        cursor: pointer;
        font-size: 14px;
        transition: background-color 0.3s;
    `;
    
    // ボタンテキストの初期設定
    updateModeButtonText(button);
    
    // クリックイベントの設定
    button.addEventListener('click', toggleProcessingMode);
    
    // ボタンをページに追加
    document.body.appendChild(button);
}

// ボタンテキストの更新
function updateModeButtonText(button = null) {
    if (!button) {
        button = document.querySelector('#tilingToggleButton');
    }
    if (button) {
        button.textContent = processingMode === 'tiling' ? '通常モードに切り替え' : '分割モードに切り替え';
        button.style.backgroundColor = processingMode === 'tiling' ? '#ffc107' : '#007bff';
    }
}

// 処理統計の表示更新
function updateProcessingStatsDisplay() {
    let statsElement = document.querySelector('#processing_stats');
    if (!statsElement) {
        // 統計表示要素を作成
        statsElement = document.createElement('div');
        statsElement.id = 'processing_stats';
        statsElement.style.cssText = `
            position: fixed;
            bottom: 10px;
            left: 10px;
            background: rgba(0, 0, 0, 0.7);
            color: white;
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 12px;
            font-family: monospace;
            z-index: 1000;
        `;
        document.body.appendChild(statsElement);
    }
    
    statsElement.innerHTML = `
        検出数: ${processingStats.detectionCount} | 
        モード: ${processingMode === 'tiling' ? '分割処理(3x3)' : '通常処理'} | 
        更新: ${new Date(processingStats.lastUpdateTime).toLocaleTimeString()}
    `;
}

// メインのモード切り替え関数
function toggleProcessingMode() {
    // モードを切り替え
    processingMode = processingMode === 'normal' ? 'tiling' : 'normal';
    
    console.log(`処理モードを切り替えました: ${processingMode}`);
    
    // script.jsのモード切り替え関数を呼び出し
    if (typeof toggleTilingMode === 'function') {
        // script.jsの変数も同期
        if (typeof useTiling !== 'undefined') {
            useTiling = (processingMode === 'tiling');
        }
        toggleTilingMode();
    } else {
        console.warn('toggleTilingMode関数が見つかりません。script.jsが正しく読み込まれているか確認してください。');
    }
    
    // UI更新
    updateModeButtonText();
    updateProcessingStatsDisplay();
}

function getColorByIndex(index) {
    const colors = [
        [221, 160, 221], // プラム
        [240, 128, 128], // ライトコーラル
        [173, 216, 230], // ライトブルー
        [144, 238, 144], // ライトグリーン
        [220, 220, 220], // グレイ
        [244, 164, 96],  // ライトサーモン
        [192, 192, 192], // シルバー
        [255, 222, 173], // ナバホホワイト
        [175, 238, 238], // パオダーターコイズ
        [255, 228, 196], // ビスク
        [250, 128, 114], // サーモン
        [152, 251, 152], // パレグリーン
        [176, 224, 230], // パウダーブルー
        [255, 218, 185], // ピーチパフ
        [240, 230, 140], // カーキ
        [240, 128, 128], // ライトコーラル
        [144, 238, 144], // ライトグリーン
        [192, 192, 192], // シルバー
        [255, 228, 196], // ビスク
        [250, 128, 114]  // サーモン
    ];

    if (index < 0) {
        index = 0;
    }

    index = index % colors.length;

    return colors[index];
}

function getColorByName(name) {
    const colors = [
        { name: "person", color: [0, 128, 255] },
        { name: "bicycle", color: [51, 153, 255] },
        { name: "car", color: [102, 178, 255] },
        { name: "motorbike", color: [153, 204, 255] },
        { name: "bus", color: [204, 229, 255] },
        { name: "train", color: [0, 255, 128] },
        { name: "truck", color: [51, 255, 153] },
        { name: "boat", color: [102, 255, 178] },
        { name: "traffic_light", color: [153, 255, 204] },
        { name: "bicycler", color: [204, 255, 229] },
        { name: "braille_block", color: [255, 128, 0] },
        { name: "guardrail", color: [255, 153, 51] },
        { name: "white_line", color: [255, 178, 102] },
        { name: "crosswalk", color: [255, 204, 153] },
        { name: "signal_button", color: [255, 229, 204] },
        { name: "signal_red", color: [255, 0, 128] },
        { name: "signal_blue", color: [255, 51, 153] },
        { name: "stairs", color: [255, 102, 178] },
        { name: "handrail", color: [255, 153, 204] },
        { name: "steps", color: [255, 204, 229] },
        { name: "faregates", color: [128, 0, 255] },
        { name: "train_ticket_machine", color: [153, 51, 255] },
        { name: "shrubs", color: [178, 102, 255] },
        { name: "tree", color: [204, 153, 255] },
        { name: "vending_machine", color: [229, 204, 255] },
        { name: "bathroom", color: [128, 128, 128] },
        { name: "door", color: [153, 153, 153] },
        { name: "elevator", color: [178, 178, 178] },
        { name: "escalator", color: [204, 204, 204] },
        { name: "bollard", color: [229, 229, 229] },
        { name: "bus_stop_sign", color: [255, 255, 255] },
        { name: "pole", color: [0, 0, 0] },
        { name: "monument", color: [51, 51, 51] },
        { name: "fence", color: [102, 102, 102] },
        { name: "wall", color: [153, 153, 153] },
        { name: "signboard", color: [204, 204, 204] },
        { name: "flag", color: [229, 229, 229] },
        { name: "postbox", color: [255, 255, 255] },
        { name: "safety-cone", color: [0, 0, 0] }
    ];
    let myname = 'person';
    let obj = colors.find(item => item.name === name);
    let color = obj ? obj.color : null;
    return color
}

function adjustCanvas() {
    // Get an element by its ID
    var element_webcam = document.getElementById('webcam');
    resizeCanvas(element_webcam.clientWidth, element_webcam.clientHeight);
    //console.log(element_webcam.clientWidth);
}

function share() {
    let element = document.getElementById('render');
    html2canvas(element).then(canvas => {
        canvas.toBlob(function (blob) {
            let file = new File([blob], "image.png", {
                type: "image/png",
            });
            const filesArray = [file];

            if (navigator.share) {
                navigator.share({
                    // title: 'Hiddenmickey',
                    // text: '#hiddenmickey',
                    files: filesArray
                })
                    .then(() => console.log('Share was successful.'))
                    .catch((error) => console.log('Sharing failed', error));
            } else {
                alert(`Your system doesn't support sharing files.`);
            }
        });
    });
}

function toggleCameraPlay() {
    let element_video = document.querySelector('#webcam');
    if (element_video.paused) {
        element_video.play();
    } else {
        element_video.pause();
    }

}
