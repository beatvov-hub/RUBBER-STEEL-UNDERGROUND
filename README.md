# RUBBER STEEL UNDERGROUND

Windows向け見下ろし型ローグライト・アクションシューティング。Version 1.0.0。50ステージ×各10フロア、計500フロアを収録しています。

自分が撃った弾は敵に命中するまで消えず、RUBBER STEELの壁で何度でも跳ね返ります。跳弾は自分にも当たり、敵を全滅させた後もフロアを出るまで残ります。未破壊の装甲に当たった弾も消費されず、装甲を壊して反射します。

## 遊ぶ

[readme_ja.txt](readme_ja.txt)に動作環境、操作方法、保存先、配布時の注意事項を記載しています。Windows配布版は`release/RUBBER_STEEL_UNDERGROUND-1.0.0-win.zip`を展開し、`RUBBER_STEEL_UNDERGROUND.exe`を起動します。プレイヤー側にNode.jsのインストールは不要です。

- `WASD` / 矢印キー: 移動
- マウス: 照準、左クリック: 射撃
- `1` / `2` / `3`: STANDARD / TRIPLE SHOT / HEAVY SHOT
- `Esc`: 一時停止、`R`: 死亡時のフロア再挑戦

最初はSTAGE 1だけが解禁されています。各ステージの10フロアを突破すると次のステージが開きます。FIRE、ICE、THUNDERはそれぞれSTAGE 10、20、30のクリアで解禁されます。2・4・6・8階の脱出時には18種類の一時能力から3候補が提示され、1つ選択します。死亡時には取得した一時能力が失われます。

## 開発と検証

Node.js 22以降を使用します。

```powershell
npm ci
npm run dev
npm test
npm run verify:content
npm run build
npm run package:win
```

`npm run dev`はローカルのViteサーバーを起動します。`npm run desktop`はビルド後にElectronで起動します。`npm run package:win`はWindows用ZIPを`release/`に生成します。テストの内容は以下のとおりです。

| コマンド | 検証内容 |
| --- | --- |
| `npm test` | 永久跳弾、自弾被弾、装甲反射、武器・能力、キャラクター、ギミック、進行、セーブ移行などの単体テスト |
| `npm run verify:content` | 全500フロアの生成、ENTRY/EXITと敵への到達性、壁・ギミックの配置を一括検証 |
| `npm run test:playthrough -- 50 thunder` | 通常の移動・射撃操作を使う自動操縦で指定ステージの10フロアを通し確認。第2引数はキャラクターID、省略時は`standard` |
| `npm run test:browser` | `http://127.0.0.1:5174`で起動中の画面に対するブラウザーテスト |
| `npm run test:desktop` | `npm run package:win`後の`release/win-unpacked`に対するEXE起動テスト |
| `npm run test:debug` | `http://127.0.0.1:5175/?debug=1`で起動中の開発用デバッグ画面のテスト |

ブラウザーテストには、別のターミナルで`npm run preview -- --port 5174`を起動します。デバッグ画面のテストには`npm run dev -- --port 5175`を起動します。PlaywrightのテストはMicrosoft Edgeを使用します。

## 実装の構成

- `src/data.ts`: ゲーム定数、初期ステージ、4キャラクター、3武器、18能力。
- `src/world.ts`: 5エリア・50ステージ、シード付きフロア生成、テンプレートと配置検証。
- `src/engine.ts`: 描画から独立した固定120Hzシミュレーション。180発上限、弾オブジェクト再利用、敵AI、可動壁・崩落床、ステージ進行。
- `src/save.ts`: バージョン2のローカル保存、旧セーブからの移行、ステージ・キャラクター解禁。
- `src/main.ts`: 操作、メニュー、設定、Web Audioによる効果音・BGM、Canvas描画との接続。
- `src/visuals/`: フロア、2頭身兵士、弾と反射演出、能力アイコンの描画。
- `electron/main.cjs`: ビルド済みのローカルファイルを読み込むWindowsアプリ。
- `tests/`、`scripts/`: ルール、500フロア、ブラウザー、EXEの検証。

フロアはステージ定義、部屋テンプレート、敵構成、可動壁・崩落床を組み合わせて決定的に生成します。生成時に出口や敵への経路とギミックの安全性を検査します。自弾は時間や反射回数で削除せず、敵への命中またはフロア移動時のみ消去します。

開発サーバーでは`?debug=1`を付けると、全ステージ解禁、ステージ・フロア移動、キャラクター選択、無敵、弾数・シード・ヒットボックス表示を使用できます。リリースビルドではデバッグ画面を表示しません。

## 配布前に確定する情報

ゲーム内の図形・音はプログラム生成で、外部画像・音声素材は使用していません。作者名、連絡先、実況・二次創作・転載の方針、免責文はプロジェクト内に確定情報がないため、[readme_ja.txt](readme_ja.txt)にTODOとして残しています。公開前に作者が記入してください。Windows実行ファイルのコード署名は未設定です。
