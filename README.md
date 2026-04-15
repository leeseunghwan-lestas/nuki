# nuki

画面の必要な部分を選択。AIがテキストを即座に抽出します。

![Chrome](https://img.shields.io/badge/Chrome-MV3-green) ![Gemini](https://img.shields.io/badge/Gemini_AI-OCR-blue)

## 機能

- **画面キャプチャOCR** — ドラッグで範囲選択、テキストがクリップボードにコピー
- **キーボードショートカット** — `Cmd+Shift+S`（Mac）/ `Ctrl+Shift+S`（Windows）
- **サイドパネル** — キャプチャ履歴、ワンクリックで再コピー
- **画像前処理** — 2倍アップスケール + 自動コントラスト + シャープ化（ぼやけたスキャン対応）
- **信頼度フィルタリング** — 低品質な結果は警告表示、無言でスルーしない
- **ダークモード** — ライト / ダーク / システム連動
- **多言語対応** — English / 日本語
- **モデル選択** — Flash Lite（高速・無料）/ Flash（高精度）

## ディレクトリ構成

```
nuki/
├── manifest.json           # Chrome MV3 設定
├── background.js           # Service Worker
├── content.js              # Content Script（範囲選択オーバーレイ）
├── theme-init.js           # ダークモードFOUC防止
├── icons/                  # 拡張機能アイコン（SVG + PNG）
├── pages/
│   ├── popup/              # サイドパネルUI
│   ├── options/            # 設定ページ
│   ├── welcome/            # オンボーディングページ
│   └── offscreen/          # Canvas画像クロップ + 前処理
└── utils/
    ├── actions.js           # メッセージアクション定数
    ├── gemini.js            # Gemini API + リトライ + JSONパース
    └── i18n.js              # 多言語 + テーマ管理
```

## セットアップ

1. [Google AI Studio](https://aistudio.google.com/apikey) から無料のGemini APIキーを取得
2. `chrome://extensions` で「パッケージ化されていない拡張機能を読み込む」からnukiフォルダを選択
3. ウェルカムページまたは設定画面でAPIキーを入力

## 技術スタック

- Chrome Extension Manifest V3
- Google Gemini 2.5 Flash / Flash Lite API
- Canvas API による画像クロップ + 前処理（オフスクリーンドキュメント）
- 依存関係ゼロ、ビルドステップ不要
