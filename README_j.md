# Webシリアルターミナル

Web Serial API を使用して、ブラウザからシリアルデバイスと直接通信するための高機能なターミナルアプリケーションです。

## 主な機能

- **多様な接続設定:**
  - ボーレート、データビット、ストップビット、パリティを自由に設定可能。
- **送受信機能:**
  - テキストの送受信に対応。
  - 送信・受信ごとに改行コード（None, LF, CR, CRLF）を選択可能。
- **高度なログ表示:**
  - **表示形式の切り替え:** 受信データをASCIIまたはHEX（16進数）形式で表示可能。
  - **タイムスタンプ表示:** ログ各行のタイムスタンプ表示（ON/OFF）を切り替え可能。
  - 送受信が色分けされたログ表示（`>>` 送信, `<<` 受信）。
- **便利なユーティリティ:**
  - **自動再接続:** デバイスが予期せず切断された場合に、自動で再接続を試みます。
  - **ログの保存:** 表示されているログをタイムスタンプ付きのテキストファイルとして保存可能。
  - **ログのクリア:** ログ表示をいつでもクリアできます。
- **入力補助:**
  - IME（日本語入力）使用時の誤送信を防止。

## 📁 プロジェクト構成

- `index.html`: ユーザーインターフェースのメインHTMLファイルです。
- `style.css`: ターミナルインターフェースのスタイルシートです。
- `script.js`: Web Serial APIのロジックとUIのインタラクションを処理するJavaScriptコードです。
- `LICENSE`: プロジェクトのライセンスファイルです。
- `README.md`: 英語版のREADMEファイルです。
- `README_j.md`: このファイルです。

## 🚀 使い方

1.  互換性のあるWebブラウザ（例：Google Chrome, Microsoft Edge）で`index.html`を開きます。
2.  「接続」ボタンをクリックします。
3.  リストから目的のシリアルポートを選択します。
4.  データの送受信を開始します。

## 📝 ライセンス

このプロジェクトは、LICENSEファイルに記載されている条件の下でライセンスされています。
