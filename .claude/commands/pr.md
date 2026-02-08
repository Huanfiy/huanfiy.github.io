## 目标
智能推送分支。若当前在 `main`，自动创建分支再推送；否则直接推送。

## 流程

1. **获取当前信息**
   - `git branch --show-current` 确认当前分支。
   - `git status -s` 确认工作区状态（若有未提交变更，建议提示用户）。

2. **分支处理**
   - **若在 `main` 或 `master`**：
     - 解析最近一次提交（`git log -1 --pretty=%s`）。
     - 提取 `type`、`scope` 和 `subject`，生成新分支名（例如 `feat/ble-fix-connection`）。
     - `git checkout -b <new_branch>`
   - **若在其它分支**：
     - 保持当前分支不变。

3. **推送**
   - 执行 `git push -u origin HEAD`。
