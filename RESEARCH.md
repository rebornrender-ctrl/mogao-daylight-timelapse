# Mogao Cave 328 Light Timelapse — Research Notes

## 研究目的

本轮不把“天然溶洞”当作莫高窟的空间原型，而是依据莫高窟人工开凿洞窟的空间研究、官方数字资源和可合法使用的文物记录，重建一个尊重史实但不等同于测绘复原的原创环境。

## 关键资料

### 1. Harvard Art Museums：第 328 窟侍立菩萨

- 记录：`https://hvrd.art/o/303672`
- Sketchfab 原始模型：`https://sketchfab.com/3d-models/kneeling-attendant-bodhisattva-129635ad396947a7975c9e5ba6095f32`
- 记录确认：晚唐，七世纪末；八尊侍立像之一，围绕中央坐佛说法像。
- 物理尺寸：人物高 90.8 cm；莲座高 28.6 cm；整体高 121.9 cm，宽 67.3 cm，深 67.3 cm。
- 许可：Sketchfab 模型为 CC Attribution；本项目保留 `CAVE 328 / TANG SCAN / CC BY` 署名。

**对本项目的决定：** 菩萨整体按 1.219 m 建模，镜头靠近面部来维持已批准的面部构图；不再把侍立像放大成五米多的“主佛”。

### 2. Wang & Yan, 2023：Mogao Cave 254 空间研究

- 论文：`Body, Scale, and Space: Study on the Spatial Construction of Mogao Cave 254`
- DOI：`https://doi.org/10.3390/rel14070953`
- 开放全文 XML：`https://mdpi-res.com/d_attachment/religions/religions-14-00953/article_deploy/religions-14-00953.xml`

**可用于本项目的空间事实：**

- 莫高窟人工洞窟主要不是自然溶洞，而是人工开凿的洞窟。
- 典型中央柱窟的平面接近矩形；后部平顶、前部可起脊/起坡。
- 除地面外，壁面和窟顶通常由壁画、塑像和建筑构件共同覆盖。
- 典型主室示例约为 9.5 m 深、6.7 m 宽、约 64 m²；前室高度约 4.7 m。
- 空间阅读依靠绕行、墙面分层和光影，不依靠漂浮岩石或多个科幻窗孔。

### 3. Zhang 等, 2023：莫高窟单侧自然通风

- 论文：`A New Correlation for Single-Sided Natural Ventilation Rate Based on Full-Scale Experimental Study in Mogao Grottoes, Dunhuang, China`
- DOI：`https://doi.org/10.3390/buildings13051298`
- 开放全文 XML：`https://mdpi-res.com/d_attachment/buildings/buildings-13-01298/article_deploy/buildings-13-01298.xml`

**关键事实：**

- 莫高窟位于向东的崖壁，外部连通开口集中在东侧，其他方向与山体相连。
- 第 328 窟被归为中等规模洞窟；论文引用实测自然换气率约 `3.21 h⁻¹`（`0.123 m³/s`）。
- 研究明确讨论风压、浮力和湍流共同驱动的单侧通风。

**对本项目的决定：** 主光入口放在东侧墙，并保留一个小的解释性窟顶天光缝，用于让太阳高度变化在脸部和地面上可读；不把环境宣称为第 328 窟的精确建筑测绘。

### 4. 数字敦煌开放素材库

- 官方资源库：`https://ip.e-dunhuang.com/`
- 官方服务条款：`https://ip.e-dunhuang.com/article/5.html`
- 官方壁画资源示例：第 107、220、301、323 等窟的深幅壁画资源。

**版权处理：**

- 官方资源库是敦煌研究院唯一官方素材库，但服务条款明确保留资源著作权，并要求授权后使用。
- 本轮只把数字敦煌图片作为内部视觉参考，没有复制或贴入项目。
- 为避免原创程序纹理过于“图形化”，可见后壁与侧壁加入了一张**公有领域**的莫高窟第 217 窟唐代壁画作为时期参考层；它不是第 328 窟壁画，也不构成第 328 窟测绘复原。来源与公有领域状态记录在 `assets/ATTRIBUTION.md`。
- 窟顶、开口厚度、几何、尘粒与光照仍由本项目原创构建；墙面参考层不复制第 328 窟不存在的测绘数据。

### 5. Sketchfab Cave 45 visual reference

- Model page: `https://sketchfab.com/3d-models/66aca1b915224bcd8a326e4ddbe1624c`
- Title: `敦煌莫高窟第45窟_21_14_07`
- Use: visual reference only. The model is marked non-downloadable and has no license metadata in the public API response, so no geometry or texture was copied into this project.
- Observation used: a small Tang chamber has a strongly compressed rear sanctuary, a central seated Buddha with attendants, a shallow aisle in front, mural-covered side walls, and a simple roof profile. The current scene uses those spatial relationships without copying the scan.

## 当前可见环境的实现边界

- 可见洞窟是“研究导向的莫高窟类型空间”，不是第 328 窟测绘复原。
- 旧版漂浮多面体、盒式墙板和五个科幻窗孔保留为隐藏 fallback，不再参与画面。
- 可见空间使用原创墙面层列纹理、浅起坡顶、东侧门洞/高窗、窄天光缝和后部浅壁龛；壁龛后壁使用已标注来源的公有领域第 217 窟时期壁画参考面板。
- 真实菩萨扫描保持不变；只改变其物理比例、位置和镜头距离。

## 证据与版本边界

- 研究日期：2026-09-24。
- 120 秒版本只模拟敦煌当地约 07:30–18:30 的太阳方向和白昼变化；不渲染月亮、月光或月相。
- 主方向光的阴影被有意压低并柔化：这是为了避免矩形/窄孔光斑在壁画上形成硬直条带，属于艺术化解释，不是逐像素物理准确声明。
- 近景丁达尔光锥是面向镜头的解释性体积层：太阳仍决定色温、强度和可用孔洞，光锥与光锥内部尘粒用于让散射在博物馆式近景中可读，不宣称为真实体积路径追踪。
- 没有渲染 MP4；只有浏览器快照用于内部视觉检查。
- 如果未来需要“第 328 窟精确复原”，必须另行取得敦煌研究院或权利方的建筑测绘/全景授权，不能把当前原创环境升级称为精确复原。
