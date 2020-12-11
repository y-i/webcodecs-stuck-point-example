let requestKeyFrame = true;
// ネットワーク越しのキーフレーム要求を模倣
const sendKeyFrameRequest = () => {
    setTimeout(() => {
        requestKeyFrame = true;
    }, 100);
    // 30fps * 100ms / (1000ms / 1s) = 3frameほど落ちる
};

const createEncoderAndDecoder = async (stream, videoElement, codec = 'vp8') => {
    const chunkQueue = [];

    const [videoTrack] = stream.getVideoTracks();

    /**
     * Encoder
     */
    let chunkCnt = 0; // 自身が何番目のチャンクかを持たせるために利用
    const videoEncoder = new VideoEncoder({
        output: (chunk) => { // EncodedVideoChunk
            const chunkObj = {
                chunk: {
                    type: chunk.type,
                    timestamp: chunk.timestamp,
                    duration: chunk.duration,
                    data: chunk.data,
                },
                metadata: {
                    count: chunkCnt++,
                }
            };
            chunkQueue.push(chunkObj); // 実際にネットワーク越しに送るには変換が必要
        },
        error: (...args) => {
            console.error(...args);
            console.log(videoEncoder.state);
        },
    });
    await videoEncoder.configure({
        codec: codec,
        width: 640,
        height: 480,
        framerate: 30,
    });

    const videoReader = new VideoTrackReader(videoTrack);
    let cnt = 0; // keyframeを送るかどうかの判定に利用
    let lastKeyFrameCount = 0;
    const keyframeRate = 150; // keyframeを送る間隔 => 5s
    videoReader.start(videoFrame => {
        cnt = (cnt + 1) % keyframeRate;

        // 定期的または前回のkeyframeから一定時間後のkeyframe要求によってkeyframeを送る
        const isKeyFrame = !cnt || (requestKeyFrame && (cnt - lastKeyFrameCount + keyframeRate) % keyframeRate > 30);
        videoEncoder.encode(videoFrame, {
            keyFrame: isKeyFrame,
        });
        requestKeyFrame = false;
        if (isKeyFrame) {
            lastKeyFrameCount = cnt;
        }
    });

    /**
     * Decoder
     */
    const canvasElem = document.createElement('canvas');
    canvasElem.width = 640;
    canvasElem.height = 480;
    videoElement.srcObject = canvasElem.captureStream(30);

    const ctx = canvasElem.getContext('2d');

    const videoDecoder = new VideoDecoder({
        output: async (frame) => {
            // canvas経由で描写する
            const imageBitmap = await frame.createImageBitmap({
                colorSpaceConversion: 'default',
            });
            ctx.drawImage(imageBitmap, 0, 0);
        },
        error: (...args) => {
            console.error(...args);
            console.log(videoDecoder.state);
        }
    });
    videoDecoder.configure({
        codec: codec,
    });

    // 最初の方のチャンクを落とすためのカウント
    let timesCnt = 0;
    // 直前のチャンクの番号
    let prevCnt = -1;
    // keyframeを受け取った状態か否か
    let isKeyFrameRequired = true;
    // 擬似的なパケロスの頻度
    const packetLossRate = 100;

    const processQueue = () => {
        if (chunkQueue.length === 0) return;
        const { chunk, metadata } = chunkQueue.pop();

        if (timesCnt++ < 10) { // タイミング差エミュレーション
            return;
        }
        // 最初はkeyframeでないといけないので、チャンクを無視しつつkeyframeを要求する。後ろのif文があるので実はいらない
        if (isKeyFrameRequired && chunk.type === 'delta') {
            console.log('delta type');
            sendKeyFrameRequest();
            return;
        }

        // 擬似的なパケロス
        if (Math.floor(Math.random() * packetLossRate) === 0) {
            console.log('dropped');
            return;
        }

        isKeyFrameRequired = false;

        // // 現在デルタフレームで直前のフレームが落ちていた場合にこのフレームも破棄する
        // if (chunk.type !== 'key' && metadata.count !== prevCnt + 1) {
        //     console.log('previous chunk was dropped');
        //     isKeyFrameRequired = true;
        //     sendKeyFrameRequest();
        //     return;
        // }

        // 確認用
        if (chunk.type === 'key') {
            console.log(metadata.count, chunk);
        }
        videoDecoder.decode(new EncodedVideoChunk(chunk));
        // prevCnt = metadata.count;
    };
    setInterval(processQueue, 10);
};

const main = async () => {
    const stream = await window.navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
    });
    document.getElementById('videoElem').srcObject = stream;

    createEncoderAndDecoder(stream, document.getElementById('receivedVideoVP8Elem'));
};

main();
