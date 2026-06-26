# 贴合回路（Fit-Loop）操作手册

POC 是探针不是交付物：搭完后，用客户文档(贴皮)/会谈反应(纠错)一轮轮把环境改得更像客户。一次调用 = 回路转一格。

## 数据
- `{客户}_context.json`：客户模型唯一真相源（fact 带 source/status/authority），MVP 手写或由首建种子。
- `{客户}_build_manifest.json`：`{ <factId>: { id, value, path } }`，增量基准。

## 触发：`来活了，改环境`
带 `--from-doc` 或 `--from-followup` 与环境标识。

## 运行期两步（适配器的 LLM 部分在此完成）
1. **产补丁**：读文档/纪要 → LLM 据骨架 `path` 列表分类：
   - 文档行 → `{ value, hintPath, raw }` 喂 `pingcode_fit_skin.skinToPatches`
   - 纪要句 → `{ op:confirm|correct|reject|add, path, value?, raw }` 喂 `pingcode_fit_reaction.reactionToPatches`
   - 产物存成 `<输入文件>.patches.json`：`{ patches:[...], pending_review:[...] }`
2. **跑 CLI**：
   ```
   node pingcode_revise.js --client_id=.. --client_secret=.. --identifier=JLALED \
     --context=客户_context.json --from-followup=会谈0625.md --dry
   ```
   先 `--dry` 看 `增/改/删` 预览 + `pending_review`；确认无误去掉 `--dry` 落地。

## 铁律
- **判不准就挂起**：映射不到 fact 的输入进 `pending_review`，绝不瞎贴。
- **只删 manifest 里 fact 关联的对象**：护住客户手改/别处内容。
- **低不盖高**：会谈纠正过的，重跑骨架不会冲掉。
- **先 dry-run**：任何写入前必看预览。
- 已知局限：信任 manifest，环境被手改会让它过时 → dry-run 预览兜。
- MVP 只改 `work_item`；其它 kind 跳过记日志。
