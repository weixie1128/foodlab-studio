FoodLab Studio v0.3.0

本版本是可直接上传 GitHub Pages 的完整静态网站。

上传方法：
1. 解压缩。
2. 把 index.html、styles.css、app.js、service-worker.js 上传到 foodlab-studio 仓库根目录。
3. 覆盖旧文件并提交。
4. GitHub Pages 通常数分钟后更新；如仍显示旧版，请强制刷新或清除站点缓存。

本版本已完成：
- 页面按“分析任务”分类，不再按 pH 等单项指标分类。
- 通用长表数据入口。
- 通用折线图与柱状图。
- 双因素系列图例：柱状图为色块，折线图为线+点。
- 显著性字母读取 letter 列。
- 真正上下双绘图区断轴，左右边框同步断开。
- 点击 Y轴、X轴、数据系列、误差棒、显著性字母、图例、标题打开对应属性。
- 图例可直接拖动位置。
- 系列配色实时编辑。
- SVG 和 PNG 导出。

尚未完成：
- 自动 ANOVA / Tukey / Duncan / LSD 计算。
- Excel 文件直接解析。
- PCA、PLS-DA、HCA 的真实数值计算。
这些页面已完成架构入口，但目前是后续模块占位。
