# 贴合回路（Fit-Loop）操作手册

POC 是探针不是交付物：搭完后，用客户文档(贴皮)/会谈反应(纠错)一轮轮把环境改得更像客户。一次调用 = 回路转一格。

## 为什么做成回路（设计思路，先懂这个再操作）

第一性原理链，决定了下面每一条铁律：

1. **POC 的价值 = context 保真，不是数据量。** 目标是让环境像客户的真实世界，不是堆"看着丰富"的虚拟数据。
2. **客户不知道自己要什么。** 直接问"你们需求怎么管"，自我报告是噪声——抽象、教科书化、用不上。所以**不要把客户的口头自述当真相源**。
3. **可靠 context = 客户身份 + 该身份的最佳实践。** 前者从客户料里抽（真名真词），后者由行业大脑（骨架/`references/verticals/`）给。于是 **fit =「客户的皮（真名真词）」套在「最佳实践骨架」上**——贴皮适配器干这个。
4. **客户只会对着具体草案给真反应。** "这个流程不对，我们评审先过功能安全"——这种话只有在看到具体环境时才说得出。所以唯一可靠的逼近方式是 **草案 → 反应 → 重渲染** 地循环，而不是一次问全。反应适配器干这个。
5. **这个循环就是销售周期本身**，事件驱动、人手触发——每见一次客户、每收一份料就转一格，不需要 /loop·/schedule 这类自动马达（那是以后可选）。

**铁律都从这链子推出来**：自述是噪声 → 判不准就 `pending_review` 挂起、绝不瞎贴；context 有成色（接地证 > 先验猜）→ `meeting>doc>skeleton`、低不盖高（客户亲口纠正过的，重跑骨架不许打回）；环境是探针、改动要可控 → 先 `--dry` 看预览、只删自己建过的。理解了"为什么"，遇到 spec 没覆盖的情形也能照同一判断走。

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
