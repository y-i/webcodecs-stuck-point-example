let requestKeyFrame = true;

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
    
    const videoReader = new VideoTrackReader(videoTrack);
    let cnt = 0; // keyframeを送るかどうかの判定に利用
    const keyframeRate = 600; // keyframeを送る間隔
    videoReader.start(videoFrame => {
        cnt = (cnt + 1) % keyframeRate;

        videoEncoder.encode(videoFrame, {
            keyFrame: !cnt || requestKeyFrame,
        });
        requestKeyFrame = false;
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

    const processQueue = () => {
        if (chunkQueue.length === 0) return;

        const {chunk} = chunkQueue.pop();

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

    createEncoderAndDecoder(stream, document.getElementById('receivedVideoVP9Elem'), 'vp09.00.10.08');
    createEncoderAndDecoder(stream, document.getElementById('receivedVideoVP8Elem'), 'vp8');
};

main();
