# Multiple Chat Tabs (for FoundryVTT)

![Foundry v11](https://img.shields.io/badge/foundry-v11-green)
![Foundry v12](https://img.shields.io/badge/foundry-v12-green)
![Foundry v13](https://img.shields.io/badge/foundry-v13-green)

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/X8X415YUSP)
[![OFUSE](https://img.shields.io/badge/OFUSE-9cf.svg?style=for-the-badge)](https://ofuse.me/o?uid=81619)

チャットログにタブ機能を追加するモジュール

Separate chats into multiple tabs

## 特徴  Features

- タブを好きなだけ作ることができる
- タブごとにプレイヤー発言を強制する機能を設定できる
- タブごとにメッセージ種別のよって強制的に表示する設定ができる
- タブバーの右クリックで設定へのショートカットができる
- タブの順番を入れ替えることができる
- 未読マークまたは未読数付き未読マークを表示することができる
- ウィスパー用タブを設定できる
- ウィスパー時に自動的に専用タブを作るよう設定できる

- Can create as many tabs as you like
- Can set a function to force OOC message for each tab
- Can force display of messages by type for each tab
- Open settings by right-clicking on the tab bar
- The order of tabs can be rearranged.
- Unread mark or unread mark with unread count can be displayed
- Tabs can be set for whisper message
- Can be automatically make tab for whisper when whisper message is created


## インストール  Install

### 方法1  Method 1

FVTTの「モッド・拡張機能」の「モジュールを入手」ウィンドウで、「Multiple Chat Tabs」を検索してインストールしてください。

In 'Install Module' window of Foundry VTT's 'Add-on Modules', search for 'Multiple Chat Tabs' and install it.

### 方法2  Method 2

ManifestURL: https://github.com/jeannjeann/multiple-chat-tabs-fvtt/releases/latest/download/module.json

FVTTの「モッド・拡張機能」の「モジュールを入手」ウィンドウで、「URLを指定」の欄に上記の「ManifestURL」をペーストしてインストールしてください。

In 'Install Module' window of Foundry VTT's 'Add-on Modules', paste the above 'ManifestURL' into the 'Manifest URL' field and install it.

## Note

- 「Simple Message Window」モジュールと一緒にテキストセッションのお供にどうぞ！
- リサイズ系のモジュールと組み合わせて使うとより便利ですよ。
  - 「Sidebar and Window Resizer」「Popout!」「Popout Resizer（module.json改変必要）」など。
- v13に対応（一部警告は残存）、v11に対応予定はありません。
- ログの量があまりに大きいとパフォーマンスに悪影響が出る可能性があります。
- タブ対応の簡易的なチャットログ出力機能も追加したいですが、未定です。


# CHANGELOG

## 1.2.0
- support v11
- set default tabID to fixed value
- change default setting

## 1.1.1
- bug fix

## 1.1.0
- support v13
- bug fix

## 1.0.0
- first release