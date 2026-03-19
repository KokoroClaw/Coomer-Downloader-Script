# Coomer Downloader （由AI编写）
English/Japanese Below

AIcoding练习产物 不会更新
## 原理

脚本在浏览器打开 Coomer 帖子列表页时自动注入，通过 Coomer 的 API 抓取该用户**所有帖子**，把所有媒体文件（图片+视频）实时压进 ZIP，下载完成自动弹出文件。下载和压缩全部在**后台 Web Worker** 里进行，不会卡住页面。

## 支持平台

- `coomer.st` / `coomer.su`

## 使用方法

1. 打开任意 Coomer 用户页面（如 `https://coomer.st/onlyfans/user/xxx`）
2. 页面顶部会弹出蓝色控制面板
3. 点击 **Download ZIP**，脚本开始自动下载并打包
4. 下载中途可点 **Stop** 中断（等当前文件完成后停止）
5. 完成后浏览器自动弹出 ZIP 文件

## 功能特性

| 功能 | 说明 |
|------|------|
| 智能续传 | 同一用户第二次打开不会重复下载，只抓新增内容 |
| CDN 故障转移 | `coomer.st` 挂了自动切换 `coomer.su` |
| SPA 导航支持 | 跳转页面后脚本自动重新初始化 |
| 实时日志 | 点击 **Log** 展开下载详情 |
| 后台压缩 | Web Worker 压缩，不卡页面 |

## 注意事项

- **不要多标签同时下载同一用户**，会导致 ZIP 内容混乱
- 视频和图片统一平铺在 ZIP 根目录，按 `日期_序号.扩展名` 命名
- 如需清空续传记录，点击 **Clear** 按钮

- # Coomer Downloader（Made by AI）

## How It Works

The script auto-injects when you open a Coomer user profile page. It fetches **all posts** via Coomer's API and streams every media file (photos + videos) directly into a ZIP archive, which auto-downloads when complete. All downloading and compression run in a **background Web Worker** so the page stays responsive.

## Supported Platforms

- `coomer.st` / `coomer.su`

## How to Use

1. Open any Coomer user page (e.g. `https://coomer.st/onlyfans/user/xxx`)
2. A blue control panel appears at the top of the page
3. Click **Download ZIP** — script starts downloading and packing automatically
4. Click **Stop** mid-download to interrupt (waits for current file to finish)
5. ZIP file auto-downloads when done

## Features

| Feature | Description |
|---------|-------------|
| Smart Resume | Re-visiting the same user won't re-download existing files, only new ones |
| CDN Failover | Auto-switches from `coomer.st` to `coomer.su` if one goes down |
| SPA Navigation | Auto-reinitializes after page navigation |
| Live Log | Click **Log** to expand download details |
| Non-blocking | Web Worker compression keeps the page responsive |

## Notes

- **Do not run multiple tabs** downloading the same user — ZIP contents may get corrupted
- Videos and images are saved flat in the ZIP root, named `date_number.ext`
- Click **Clear** to wipe the resume record

- # Coomer Downloader（AI作成）

## 動作原理

スクリプトはブラウザでCoomerの投稿リストページを開くと自動挿入され、CoomerのAPIでそのユーザーの**全投稿**を取得し、写真と動画をリアルタイムでZIPに圧縮、完了時に自動ダウンロードします。ダウンロードと圧縮は**バックグラウンドのWeb Worker**で実行されるため、ページが固まることはありません。

## 対応プラットフォーム

- `coomer.st` / `coomer.su`

## 使い方

1. Coomerのユーザーページを開く（例：`https://coomer.st/onlyfans/user/xxx`）
2. ページ上部に青い制御パネルが表示される
3. **Download ZIP** をクリックすると自動ダウンロード・パッケージ開始
4. 途中停止は **Stop** をクリック（現ファイル完了後に停止）
5. 完了するとZIPが自動ダウンロードされる

## 機能一覧

| 機能 | 説明 |
|------|------|
| スマートレジューム | 同一ユーザーの再訪問時は既存ファイルを再ダウンロードしない |
| CDNフェイルオーバー | `coomer.st` が落ちたら自動で `coomer.su` に切り替え |
| SPAナビゲーション対応 | ページ移動後もスクリプトが自動再初期化 |
| リアルタイムログ | **Log** をクリックするとダウンロード詳細を展開 |
| UIが固まらない | Web Worker圧縮でページ応答性を維持 |

## 注意事項

- **同じユーザーに複数タブで同時ダウンロードしないで！** ZIP 乱れる可能性があります
- 動画と画像はZIP直下に `日付_連番.拡張子` で平置き保存
- レジューム記録をクリアしたい場合は **Clear** をクリック
