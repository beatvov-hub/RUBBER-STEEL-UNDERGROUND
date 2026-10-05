# RUBBER STEEL UNDERGROUND

STAGE 1 / 10 FLOORS のプレイ可能な試作。自弾は時間や反射回数で消えず、敵への命中またはフロア移動で消えます。アーマーへの初弾は消費されず反射します。

```powershell
npm ci
npm run dev
npm test
npm run build
npm run desktop
npm run package:win
```

- `src/data.ts`: 調整定数、キャラクター、武器、能力、10フロア。床崩壊などの将来のギミックはデータの拡張用フィールドのみ。
- `src/engine.ts`: 描画から独立した固定120Hzシミュレーション。円と壁の衝突は小刻みな移動で判定。180発上限と弾オブジェクト再利用。自弾の寿命なし。
- `src/main.ts`: Canvas描画、操作、UI、生成効果音、バージョン付きローカル保存。
- `src/visuals/renderer.ts`: キャッシュした施設フロア、局所照明、RUBBER STEEL合金、エアロック、反射火花・トレーサー、追従カメラ。ゲームオブジェクトの読み取り専用描画。
- `src/visuals/soldier.ts`: STANDARD/FIRE等へ差し替えやすい共通2頭身兵士。移動する脚、照準に回転する腕・銃、アーマー差分。
- `src/visuals/icons.ts`: 能力選択とHUDで共有するSVGアイコンと短い説明。
- `electron/main.cjs`: ローカル静的ファイルを読み込むWindowsラッパー。
- `tests/engine.test.ts`: 核となるルールと10フロア進行の自動検証。

HP、弾速、サイズ、上限、反射音量、能力選択の階数は`CONFIG`で調整できます。3武器は初期試作の比較がしやすいよう随時切替可能。死亡時は能力を失い、現在のフロアを標準装備で再挑戦します。

WindowsのZIPは`release/`に生成されます。EXEと周辺ファイルをまとめて配布し、`readme_ja.txt`の作者・連絡先・利用ポリシーのTODOを確定してください。コード署名は未設定。

面白さの評価では「外した弾が後から戻ってきて自分を倒す」「敵全滅後にも出口まで危険が残る」を確認してください。人による難易度評価は別途必要です。
