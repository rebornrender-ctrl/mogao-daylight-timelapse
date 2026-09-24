# Frame Design — 敦煌光迹

## Concept

**千年静止，白昼经过。** 菩萨、壁面与尘土不夸张运动；真正的叙事主体是太阳在敦煌天空中的方向，以及光如何从孔洞进入洞窟。两分钟只观察白昼：晨光逐渐展开为日光，斜阳变暖，最后停在暮色，不进入月夜。

### Interaction / Render Separation

- Studio 交互层使用受限轨道相机，不改变场景资产和天文状态。
- 鼠标旋转范围限制在洞窟内部，避免穿墙和丢失主体。
- `光流` 只改变尘粒与柔和光雾的视觉时间相位；孔洞方向仍由太阳向量决定。
- HyperFrames 渲染使用 `?mode=render`，忽略鼠标输入，保证时间轴可复现。

## Asset Identity

- **Subject:** Harvard Art Museums / Sketchfab photogrammetric model of the late-7th-century Tang *Kneeling Attendant Bodhisattva* from Mogao Cave 328, object `1924.70`; overall museum-record height `1.219 m`.
- **License:** CC Attribution; full provenance and local paths are in `assets/ATTRIBUTION.md`.
- **Material rule:** use the scan's baked vertex colors as the primary albedo; use the downloaded 8K JPEG only as a low-amplitude micro-surface source so the original painted surface is not replaced by procedural detail.
- **Environment rule:** visible cave is a research-led Mogao-type chamber, not a Cave 328 survey reconstruction. The visible rear/side wall layer uses a separately attributed public-domain Cave 217 period mural reference.

## Palette

- `ink` — `#100D09` 深褐黑，暗部的最低色，不使用纯黑。
- `sandstone` — `#9A744C` 砂岩主色，承载主要漫反射。
- `sandstone-light` — `#C7A06C` 受光砂岩与浮尘暖色。
- `lapis` — `#355878` 岩青，壁画冷色层。
- `mineral-green` — `#4D6B5D` 石绿，壁画与阴影补色。
- `cinnabar` — `#A45A3C` 赭红，只作极少量界面与壁画焦点。
- `sun-low` — `#FF9A5B` 低角度太阳的暖色。
- `sun-high` — `#F3D6A4` 高角度日光与尘粒的柔和色。

## Light Design

- 主方向光负责太阳方向、颜色和整体照度，但采用低对比艺术化处理，避免在壁画上形成一条硬直的“激光条”。
- 无阴影的漫射日光和砂岩反弹光负责体积与皮肤/壁面的柔和过渡。
- 低强度 VSM 阴影层只保留空间深度，强度远低于主光，不应成为画面主角。
- 可见光雾由三层宽羽化体积光和一层面向镜头的解释性丁达尔光锥组成；光锥边缘使用平滑 falloff，不作为硬几何光柱。
- 面部光使用宽角度、高 penumbra 的软聚光，让光流在眉骨、鼻梁和肩线上缓慢移动，而不是切出硬光斑。
- 尘粒分为空气微尘、可读前景尘粒和光锥内部尘粒三层；`光流` 只增加细微的空气运动，不改变太阳位置。

## Camera

- 低机位、正面偏三分之四的面部近景。
- 目标点锁在菩萨面部，相机高度保持低位，形成明显但稳定的仰视关系。
- 镜头全段连续，不做四次硬切；120 秒内只做极慢的低频漂移。
- 背景保留窟顶、侧壁和壁画层，主体面部与上胸部始终优先。

## Audio

- 刻意保持安静，不加入配乐、环境声或音效。

## Historical Boundary

- 菩萨本体是第 328 窟真实文物扫描。
- 洞窟环境是研究导向的原创莫高窟类型复合空间，不宣称为第 328 窟测绘复原。
- 第 217 窟公有领域壁画仅作为时期与视觉参考层，来源见 `assets/ATTRIBUTION.md`。
- 太阳方向和当地白昼时间映射可信；光斑与体积散射为了博物馆式审美做了柔化，不宣称逐像素物理准确。
