# webcodecs-stuck-point-example

## リポジトリ概要
https://speakerdeck.com/y_i/webcodecs-stuck-point-examples で紹介したWebCodecsを用いた実装のハマりやすいポイントについて、実際に再現する実装とその修正方法のデモのサンプルコードです。
デフォルトでは問題の修正方法の部分についてはコメントアウトしており、その修正を有効にすることで問題が発現しないのが確認できます。

## 注意点
GoogleChromeに`--enable-blink-features=WebCodecs,MediaStreamInsertableStreams`オプションをつけて起動する必要がある。

例えばmacだと`open -a /Applications/Google\ Chrome\ Beta.app  --args --use-fake-device-for-media-stream --enable-blink-features=WebCodecs,MediaStreamInsertableStreams`のようになる。

また、入力のカメラはVideoEncoderのconfigureの設定に合うものを使うか、設定の方をカメラに合わせる必要がある。
サンプルのコードでは`--use-fake-device-for-media-strea`フラグを付けて起動した時の偽の映像やFaceTime HDカメラなどが対応している解像度になっている。
