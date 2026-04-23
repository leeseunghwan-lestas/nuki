# nuki

画面の必要な部分を選択。AIがテキストを即座に抽出します。

![Chrome](https://img.shields.io/badge/Chrome-MV3-green) ![Gemini](https://img.shields.io/badge/Gemini_AI-OCR-blue)

## 機能

### キャプチャ
- **画面キャプチャOCR** — ドラッグで範囲選択、テキストがクリップボードにコピー
- **キーボードショートカット** — `Cmd+Shift+S`（Mac）/ `Ctrl+Shift+S`（Windows）
- **画像前処理** — 2倍アップスケール + 自動コントラスト + シャープ化（ぼやけたスキャン対応）
- **信頼度フィルタリング** — 低品質な結果は警告表示、無言でスルーしない
- **保護ページ事前検知** — `chrome://` / Web Store / PDFビューアなど、Chrome がブロックするページを事前に判別して親切な案内

### サイドパネル（履歴）
- **キャプチャ履歴** — 最新20件を保持、ワンクリックで再コピー
- **インライン編集** — 鉛筆アイコンで OCR 結果を修正 · Cmd/Ctrl+Enter で保存
- **個別削除** — 履歴アイテムを一つずつ削除可能
- **アクセシビリティ** — role=alert / aria-live によるスクリーンリーダー対応

### オンボーディング
- **6ステップウェルカム** — API キー設定 / 使い方 / 精度向上のコツ / 設定概要 / 完了
- **OCR 精度 Tips** — 回転テキスト、低画質、小さい文字、手書き、複雑な背景、装飾フォントなど 6 種の注意点
- **スキップ可能** — 経験者向けにチュートリアルスキップリンク

### 設定
- **ダークモード** — ライト / ダーク / システム連動
- **多言語対応** — English / 日本語（完全分離、混在なし）
- **モデル選択** — Flash Lite（高速・無料）/ Flash（高精度）
- **API キー形式検証** — 保存時に `AIza` プレフィックスと文字セットをチェック

### エラー処理
- **完全ローカライズされた詳細メッセージ** — 以下を個別に識別：
  - キー無効 / 未設定
  - ネットワーク障害（指数バックオフ再試行）
  - クォータ超過 / レート制限
  - サーバー障害（500-504）
  - セーフティブロック
  - 保護ページ

## ディレクトリ構成

```
nuki/
├── manifest.json              # Chrome MV3 設定
├── background.js              # Service Worker（キャプチャ統括）
├── content.js                 # Content Script（範囲選択オーバーレイ）
├── theme-init.js              # ダークモードFOUC防止
├── icons/                     # 拡張機能アイコン（SVG + PNG）
├── pages/
│   ├── popup/                 # サイドパネル UI
│   ├── options/               # 設定ページ
│   ├── welcome/               # 6 ステップオンボーディング
│   └── offscreen/             # Canvas 画像クロップ + 前処理（ESM）
└── utils/
    ├── actions.js             # メッセージアクション定数
    ├── constants.js           # マジックナンバー（OCR 閾値、画像上限、履歴上限）
    ├── gemini.js              # Gemini API + リトライ + ローカライズされたエラー振り分け
    └── i18n.js                # 多言語 + テーマ + aria-label ローカライズ
```

## セットアップ

1. [Google AI Studio](https://aistudio.google.com/apikey) から無料の Gemini API キーを取得
2. `chrome://extensions` で「パッケージ化されていない拡張機能を読み込む」から nuki フォルダを選択
3. ウェルカムページまたは設定画面で API キーを入力
4. （任意）`chrome://extensions` の拡張機能詳細で以下を有効化：
   - **ファイル URL へのアクセスを許可** — `file://` のローカル HTML / 画像も OCR 対象に
   - **シークレットモードでの実行を許可** — プライベートブラウジング対応

## 技術スタック

- Chrome Extension Manifest V3
- Google Gemini 2.5 Flash / Flash Lite API
- Canvas API による画像クロップ + 前処理（オフスクリーンドキュメント、ES Modules）
- 依存関係ゼロ、ビルドステップ不要
