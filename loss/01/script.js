let requestKeyFrame = true;
// ネットワーク越しのキーフレーム要求を模倣
const sendKeyFrameRequest = () => {
    setTimeout(() => {
        requestKeyFrame = true;
    }, 100);
    // 30fps * 100ms / (1000ms / 1s) = 3frameほど落ちる
};

const createEncoderAndDecoder = async (stream, videoElement, codec='vp8') => {
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

    let cnt = 0; // keyframeを送るかどうかの判定に利用
    const keyframeRate = 600; // keyframeを送る間隔 => 20s

    const processor = new MediaStreamTrackProcessor(videoTrack);
    const frameReader = processor.readable.getReader();
    setTimeout(async () => {
        while (true) {
            const { done, value: videoFrame } = await frameReader.read();
        
            if (done) {
              console.log('Stream is done');
              break;
            }
        
            cnt = (cnt + 1) % keyframeRate;

            // 定期的またはkeyframe要求によってkeyframeを送る
            const isKeyFrame = !cnt || requestKeyFrame;
            videoEncoder.encode(videoFrame, {
                keyFrame: isKeyFrame,
            });
            requestKeyFrame = false;
          }
    }, 0);

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
            ctx.drawImage(imageBitmap,0,0);
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
    // keyframeを受け取った状態か否か
    let isKeyFrameRequired = true;

    const processQueue = () => {
        if (chunkQueue.length === 0) return;
        // const {chunk, metadata} = chunkQueue.pop();
        const {chunk} = chunkQueue.pop();

        if (timesCnt++ < 10) { // タイミング差を作るため最初の方のチャンクを捨てる
            return;
        }

        // // 最初はkeyframeでないといけないので、チャンクを無視しつつkeyframeを要求
        // if (isKeyFrameRequired && chunk.type === 'delta') { 
        //     console.log('Discard delta type chunk');
        //     sendKeyFrameRequest();
        //     return;
        // }

        // isKeyFrameRequired = false;

        videoDecoder.decode(new EncodedVideoChunk(chunk));
    };
    setInterval(processQueue,10);
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
