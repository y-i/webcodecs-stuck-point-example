# webcodecs-stuck-point-example

## 注意点
GoogleChromeに`--enable-blink-features=WebCodecs,MediaStreamInsertableStreams`オプションをつけて起動する必要がある。

例えばmacだと`open -a /Applications/Google\ Chrome\ Beta.app  --args --use-fake-device-for-media-stream --enable-blink-features=WebCodecs,MediaStreamInsertableStreams`のようになる。

また、入力のカメラはVideoEncoderのconfigureの設定に合うものを使うか、設定の方をカメラに合わせる必要がある。
サンプルのコードでは`--use-fake-device-for-media-strea`フラグを付けて起動した時の偽の映像やFaceTime HDカメラなどが対応している解像度になっている。