# [官网](https://github.com/gpakosz/.tmux)

- `<prefix>` means you have to either hit Ctrl + a or Ctrl + b
- `<prefix> c` means you have to hit Ctrl + a or Ctrl + b followed by c
- `<prefix> C-c` means you have to hit Ctrl + a or Ctrl + b followed by Ctrl + c

This configuration uses the following bindings:

- `<prefix> e` opens the `.local` customization file copy with the editor defined by the `$EDITOR` environment variable (defaults to `vim` when empty)
- `<prefix> r` reloads the configuration
- `C-l` clears both the screen and the tmux history
- `<prefix> C-c` creates a new session
- `<prefix> C-f` lets you switch to another session by name
- `<prefix> C-h` and `<prefix> C-l` let you navigate windows (default `<prefix> n` and `<prefix> p` are unbound)
- `<prefix> Tab` brings you to the last active window
- `<prefix> -` splits the current pane vertically
- `<prefix> _` splits the current pane horizontally
- `<prefix> h`, `<prefix> j`, `<prefix> k` and `<prefix> l` let you navigate panes ala Vim
- `<prefix> H`, `<prefix> J`, `<prefix> K`, `<prefix> L` let you resize panes
- `<prefix> <` and `<prefix> >` let you swap panes
- `<prefix> +` maximizes the current pane to a new window
- `<prefix> m` toggles mouse mode on or off
- `<prefix> U` launches Urlscan (preferred) or Urlview, if available
- `<prefix> F` launches Facebook PathPicker, if available
- `<prefix> Enter` enters copy-mode
- `<prefix> b` lists the paste-buffers
- `<prefix> p` pastes from the top paste-buffer
- `<prefix> P` lets you choose the paste-buffer to paste from
- `<prefix> z` 最大化当前窗格

Additionally, `copy-mode-vi` matches [my own Vim configuration](https://github.com/gpakosz/.vim.git)

Bindings for `copy-mode-vi`:

- `v` begins selection / visual mode
- `C-v` toggles between blockwise visual mode and visual mode
- `H` jumps to the start of line
- `L` jumps to the end of line
- `y` copies the selection to the top paste-buffer
- `Escape` cancels the current operation



开启鼠标后按 `shift` 配合鼠标选中内容

在 tmux 中`shift` `鼠中` = primary 剪切板， 鼠中为 tmux 内部剪切板

在 linux 中 `ctrl v`= 标准剪切板	鼠中 = primary 剪切板

prefix C-f 文件搜索

PR  /搜索	n N 上下导航

`PR + q` pane 指示器

`escape`: 退出搜索模式
