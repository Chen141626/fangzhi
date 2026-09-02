# 图片批量转 sprite-frame

适用于当前项目使用的 Cocos Creator 3.8.x。

## 使用方法

1. 在 Cocos Creator 中打开 **扩展 → 扩展管理器 → 项目**。
2. 找到 `image-to-sprite-frame`，点击刷新并启用。
3. 点击顶部菜单 **扩展 → 图片工具 → 所有图片转为 sprite-frame**。
4. 确认数量后点击 **开始转换**。

扩展只扫描 `db://assets/` 下由 `image` 导入器管理的图片。已经是
`sprite-frame` 的图片、只读资源和其他数据库中的资源都会跳过。

转换通过 Creator 的 `asset-db` 接口保存资源 meta，不会直接覆盖图片文件。
行为与在属性检查器中手动选择 `sprite-frame` 一致：纹理寻址设为 `Clamp`，
并关闭 mipmap 过滤。
执行进度和失败详情会输出到 Creator 控制台。
