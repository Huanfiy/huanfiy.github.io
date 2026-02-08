提交当前更改

1. 格式：`<type>(<scope>): <subject>` (英文短句，单行), (Scope 可选)
2. type: feat/fix/perf/refactor/chore/docs
3. 原则：单一粒度且可回滚,一个 commit 只做一件事，禁止混杂,每个 commit 能独立通过构建

流程：
1. `git diff` 确认改动，`git add` 精确暂存。