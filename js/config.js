// 基于页面路径生成唯一命名空间，防止同域下多项目 LocalStorage 键名冲突
const STORAGE_KEY = (function() {
    const path = window.location.pathname.replace(/\/$/, '') || '/';
    const ns = path.split('/').filter(Boolean).join('_') || 'root';
    return 'YJWJ_' + ns + '_CACHE';
})();

// 默认初始数据
const DEFAULT_CONFIG = {
    // 【核心】智能同步版本号。手动在电脑上修改此文件后，只需将此数字 +1，网页刷新时即可自动载入最新修改！
    configVersion: 17, // 升级为版本 17：新增6名人员（克烈/疯尤金疯尤金/Spider/南一/麻辣毛蛋/薄荷奶绿）

    // 1. 27个英雄基础数据
    heroes: [
        { name: "宁红夜", image: "assets/heroes/ninghongye.webp", skills: ["F1昆仑决", "F2昆仑决·禁疗"], ultimates: ["V1赤练无明", "V2赤练无明·无拘"] },
        { name: "沈妙", image: "assets/heroes/shenmiao.webp", skills: ["F1铳武", "F2铳武·精准"], ultimates: ["V1铁卫召来", "V2铁卫召来·乙型"] },
        { name: "天海", image: "assets/heroes/tianhai.webp", skills: ["F1金钟罩", "F2金钟罩·振刀"], ultimates: ["V1金刚伏魔", "V2金刚伏魔·治愈"] },
        { name: "殷紫萍", image: "assets/heroes/yinziping.webp", skills: ["F1益气安神", "F2益气安神·滋养"], ultimates: ["V1悬壶济世", "V2悬壶济世·培元"] },
        { name: "特木尔", image: "assets/heroes/temuer.webp", skills: ["F1风之精灵", "F2风之精灵·追踪"], ultimates: ["V1风之牢笼", "V2风之牢笼·召唤"] },
        { name: "季沧海", image: "assets/heroes/jicanghai.webp", skills: ["F1燎原劲", "F2燎原劲·巨焰"], ultimates: ["V1迅烈如火", "V2迅烈如火·狂战"] },
        { name: "胡桃", image: "assets/heroes/hutao.webp", skills: ["F1庇护", "F2庇护·守护"], ultimates: ["V1净天地", "V2净天地·急疗"] },
        { name: "妖刀姬", image: "assets/heroes/yaodaoji.webp", skills: ["F1妖刀斩", "F2妖刀斩·旋"], ultimates: ["V1不祥之刃", "V2不祥之刃·连斩"] },
        { name: "崔三娘", image: "assets/heroes/cuisanniang.webp", skills: ["F1织雾", "F2织雾·瞬"], ultimates: ["V1深渊梦魇", "V2深渊梦魇·击"] },
        { name: "岳山", image: "assets/heroes/yueshan.webp", skills: ["F1陷阵", "F2陷阵·猛志"], ultimates: ["V1千军辟易", "V2千军辟易·固阵"] },
        { name: "无尘", image: "assets/heroes/wuchen.webp", skills: ["F1两仪剑", "F2两仪剑·易位"], ultimates: ["V1斗转星移", "V2斗转星移·剑雨"] },
        { name: "顾清寒", image: "assets/heroes/guqinghan.webp", skills: ["F1冰心诀", "F2冰心诀·瞬息"], ultimates: ["V1冰寒飞影", "V2冰寒飞影·霜风"] },
        { name: "武田信忠", image: "assets/heroes/wutianxinzhong.webp", skills: ["F1白刃取", "F2白刃取·夺", "F3白刃取·摔"], ultimates: ["V1封印解除", "V2封印解除·瞬", "V3封印解除·噬"] },
        { name: "迦南", image: "assets/heroes/jianan.webp", skills: ["F1追魂", "F2追魂·突刺"], ultimates: ["V1寂静暗刑", "V2寂静暗刑·夺命"] },
        { name: "胡为", image: "assets/heroes/huwei.webp", skills: ["F1镇山林", "F2镇山林·虎啸"], ultimates: ["V1虎威", "V2虎威·困兽犹斗"] },
        { name: "季莹莹", image: "assets/heroes/jiyingying.webp", skills: ["F1幽冥火", "F2幽冥火·突焰"], ultimates: ["V1无常锁", "V2无常锁·拘"] },
        { name: "玉玲珑", image: "assets/heroes/yulinglong.webp", skills: ["F1尾袭", "F2尾袭·阵"], ultimates: ["V1迷魂引", "V2迷魂引·聚"] },
        { name: "哈迪", image: "assets/heroes/hadi.webp", skills: ["F1夺天工", "F2夺天工·弹射"], ultimates: ["V1击长空", "V2击长空·炽热"] },
        { name: "魏轻", image: "assets/heroes/weiqing.webp", skills: ["F1执金令", "F2执金令·追捕"], ultimates: ["V1玄武正法", "V2玄武正法·归案"] },
        { name: "刘炼", image: "assets/heroes/liulian.webp", skills: ["F1驭金闪", "F2驭金闪·化磁"], ultimates: ["V1金石铄", "V2金石铄·核"] },
        { name: "张起灵", image: "assets/heroes/zhangqiling.webp", skills: ["F1发丘指", "F2发丘指·锁喉"], ultimates: ["V1麒麟怒", "V2麒麟怒·绝斩"] },
        { name: "希拉", image: "assets/heroes/xila.webp", skills: ["F1光晕", "F2光晕·瞬附"], ultimates: ["V1恩威之光", "V2恩威之光·阵"] },
        { name: "蓝梦", image: "assets/heroes/lanmeng.webp", skills: ["F1大变活人", "F2大变活人·袭"], ultimates: ["V1鱼龙彩戏", "V2鱼龙彩戏·跃"] },
        { name: "万钧", image: "assets/heroes/wanjun.webp", skills: ["F1掣电闪", "F2掣电闪·雷契"], ultimates: ["V1万雷铸身", "V2万雷铸身·锋"] },
        { name: "李寻欢", image: "assets/heroes/lixunhuan.webp", skills: ["F1探花步", "F2探花步·反击"], ultimates: ["V1片叶不沾", "V2片叶不沾·挥洒"] },
        { name: "巫真", image: "assets/heroes/wuzhen.webp", skills: ["F1灵羽", "F2灵羽·召"], ultimates: ["V1神弓镇祟", "V2神弓镇祟·晦"] },
        { name: "甘璇", image: "assets/heroes/ganxuan.webp", skills: ["F1引星诀", "F2引星诀·愈"], ultimates: ["V1天机衍", "V2天机衍·溯"] }
    ],

    // 默认激活的英雄名单
    activeHeroNames: [
        "宁红夜", "沈妙", "天海", "殷紫萍", "特木尔", "季沧海", "胡桃", "妖刀姬", "崔三娘", "岳山", 
        "无尘", "顾清寒", "武田信忠", "迦南", "胡为", "季莹莹", "玉玲珑", "哈迪", "魏轻", "刘炼", 
        "张起灵", "希拉", "蓝梦", "万钧", "李寻欢", "巫真", "甘璇"
    ],
    
    heroDrawSettings: {
        randomizeSkill: true,
        randomizeUltimate: true
    },

    // 2. 武器大类基础数据
    weapons: [
        { name: "阔刀", type: "melee", image: "assets/weapons/kuodao.webp" },
        { name: "斩马刀", type: "melee", image: "assets/weapons/zhanmadao.webp" },
        { name: "长剑", type: "melee", image: "assets/weapons/changjian.webp" },
        { name: "太刀", type: "melee", image: "assets/weapons/taidao.webp" },
        { name: "匕首", type: "melee", image: "assets/weapons/bishou.webp" },
        { name: "双节棍", type: "melee", image: "assets/weapons/shuangjiegun.webp" },
        { name: "双刀", type: "melee", image: "assets/weapons/shuangdao.webp" },
        { name: "双戟", type: "melee", image: "assets/weapons/shuangji.webp" },
        { name: "扇", type: "melee", image: "assets/weapons/shan.webp" },
        { name: "横刀", type: "melee", image: "assets/weapons/hengdao.webp" },
        { name: "枪", type: "melee", image: "assets/weapons/qiang.webp" },
        { name: "棍", type: "melee", image: "assets/weapons/gun.webp" },
        { name: "飞刀", type: "melee", image: "assets/weapons/feidao.webp" },
        { name: "拳刃", type: "melee", image: "assets/weapons/quanren.webp" },
        { name: "链剑", type: "melee", image: "assets/weapons/lianjian.webp" },
        { name: "万刃轮", type: "melee", image: "assets/weapons/wanrenlun.webp" },
        { name: "火炮", type: "ranged", image: "assets/weapons/huopao.webp" },
        { name: "连弩", type: "ranged", image: "assets/weapons/liannu.webp" },
        { name: "鸟铳", type: "ranged", image: "assets/weapons/niaochong.webp" },
        { name: "弓箭", type: "ranged", image: "assets/weapons/gongjian.webp" },
        { name: "五眼铳", type: "ranged", image: "assets/weapons/wuyanchong.webp" },
        { name: "双铳", type: "ranged", image: "assets/weapons/shuangchong.webp" },
        { name: "一窝蜂", type: "ranged", image: "assets/weapons/yiwofeng.webp" },
        { name: "喷火筒", type: "ranged", image: "assets/weapons/penhuotong.webp" }
    ],

    // 默认激活的武器名单
    activeWeaponNames: [
        "阔刀", "斩马刀", "长剑", "太刀", "匕首", "双节棍", "双刀", "双戟", "扇", "横刀", "枪", "棍",
        "飞刀", "拳刃", "链剑", "万刃轮", "火炮", "连弩", "鸟铳", "弓箭", "五眼铳", "双铳", "一窝蜂", "喷火筒"
    ],

    weaponDrawSettings: {
        includeMelee: true,       
        includeRanged: true,      
        randomizeQuality: true,   
        drawCount: 1,
        allowDuplicate: false,    
        eachOnePreset: false      
    },

    // 3. 人员基础数据
    players: [
        { name: "不会捏蓝", image: "assets/players/buhuinielan.webp" },
        { name: "冬日川", image: "assets/players/dongrichuan.webp" },
        { name: "今晚打虎", image: "assets/players/jinwandahu.webp" },
        { name: "格子", image: "assets/players/gezi.webp" }, 
        { name: "啵酱", image: "assets/players/bojiang.webp" },
        { name: "克烈", image: "assets/players/kelie.webp" },
        { name: "疯尤金疯尤金", image: "assets/players/fengyoujinfengyoujin.webp" },
        { name: "Spider", image: "assets/players/spider.webp" },
        { name: "南一", image: "assets/players/nanyi.webp" },
        { name: "麻辣毛蛋", image: "assets/players/malamamaodan.webp" },
        { name: "薄荷奶绿", image: "assets/players/bohenailv.webp" },
        { name: "Mike", image: "assets/players/mike.webp" }
    ],

    // 默认激活的人员名单
    activePlayerNames: ["不会捏蓝", "冬日川", "今晚打虎", "格子", "啵酱", "克烈", "疯尤金疯尤金", "Spider", "南一", "麻辣毛蛋", "薄荷奶绿", "Mike"],

    // 4. 锦囊库与设置数据
    tips: [
        // 挑战者卡池
        { name: "我药呢", pool: "challenger", quality: "白", description: "下一回合，擂主禁止使用药品。" },
        { name: "我甲呢", pool: "challenger", quality: "白", description: "下一回合，擂主禁止穿护甲。" },
        { name: "我远程呢", pool: "challenger", quality: "白", description: "下一回合，擂主禁止使用远程。" },
        { name: "我钩锁呢", pool: "challenger", quality: "白", description: "下一回合，擂主禁止使用钩锁。" },
        { name: "我武备匣呢", pool: "challenger", quality: "白", description: "下一回合，擂主禁止使用武备匣。" },
        { name: "我振刀呢", pool: "challenger", quality: "白", description: "下一回合，擂主禁止使用振刀。" },
        { name: "我技能呢", pool: "challenger", quality: "白", description: "下一回合，擂主禁止使用技能。" },
        { name: "我奥义呢", pool: "challenger", quality: "白", description: "下一回合，擂主禁止使用奥义。" },
        { name: "我椅子呢", pool: "challenger", quality: "白", description: "下一回合，擂主禁止坐椅子。" },
        { name: "我下蹲呢", pool: "challenger", quality: "白", description: "下一回合，擂主禁止使用下蹲。" },
        { name: "我闪避呢", pool: "challenger", quality: "白", description: "下一回合，擂主禁止使用闪避。" },
        { name: "我投降", pool: "challenger", quality: "白", description: "挑战者直接结束本次擂台赛挑战并获得上局结算奖励。" },
        { name: "更换对手", pool: "challenger", quality: "白", description: "从下一回合开始，本局擂主进行一次随机更换。" },
        { name: "只打最强", pool: "challenger", quality: "白", description: "本局开始前决定是否将擂主更换为不会捏蓝。若更换且成功获得本局胜利，可额外获得神秘奖励。" },
        { name: "我是克烈", pool: "challenger", quality: "白", description: "下一回合，擂主武器只能使用斩马刀和远程。" },
        { name: "SDWA", pool: "challenger", quality: "白", description: "下一回合，擂主的键位“W”与“S” 交换、“D”与“A”交换。" },
        { name: "随机英雄", pool: "challenger", quality: "白", description: "下一回合，擂主只能使用随机抽取的英雄。" },
        { name: "随机武器", pool: "challenger", quality: "白", description: "下一回合，擂主只能使用随机抽取的一把近战与远程。" },
        { name: "无限奥义", pool: "challenger", quality: "白", description: "下一回合，挑战者可以无限次数使用奥义。" },
        { name: "笔记本高手", pool: "challenger", quality: "白", description: "下一回合，擂主需锁67帧。" },
        { name: "白刀大师", pool: "challenger", quality: "白", description: "下一回合，擂主只能出白刀。" },
        { name: "蓄力大师", pool: "challenger", quality: "白", description: "下一回合，擂主只能出蓄力。" },
        { name: "教学大师", pool: "challenger", quality: "白", description: "下一回合，擂主需边打边教学。" },
        { name: "唱歌高手", pool: "challenger", quality: "白", description: "下一回合，擂主需边打边跟着bgm歌唱。" },
        { name: "默契大师", pool: "challenger", quality: "白", description: "下一回合，擂主需与另一人，一人使用鼠标一人使用键盘。" },
        { name: "含水方块", pool: "challenger", quality: "白", description: "下一回合，擂主嘴巴需含住一大口水。" },
        { name: "高压锅", pool: "challenger", quality: "白", description: "下一回合，擂主旁边的人要不停压力擂主。" },
        { name: "我开挂了", pool: "challenger", quality: "白", description: "直接获得下一回合的胜利。" },
        { name: "太双你知道的呀", pool: "challenger", quality: "白", description: "下一回合，擂主只能使用太刀和双刀。" },
        { name: "再来一次", pool: "challenger", quality: "白", description: "消耗本锦囊，恢复本局其他锦囊的使用机会。" },
        { name: "重新开始", pool: "challenger", quality: "白", description: "使本局比分清零。" },
        { name: "镜像对决", pool: "challenger", quality: "白", description: "下一回合，双方只能使用挑战者规定的英雄、武器、技能奥义。" },
        { name: "我好晕", pool: "challenger", quality: "白", description: "下一回合开始前，擂主需大象捏鼻子转圈圈10圈。" },
        { name: "不欺弱者", pool: "challenger", quality: "白", description: "若本局挑战者零封擂主，可选择是否直接挑战最后一关。" },

        // 擂主卡池
        { name: "捏蓝大王来了", pool: "champion", quality: "白", description: "从下一回合开始，本局擂主更换为不会捏蓝。" },
        { name: "对赌协议", pool: "champion", quality: "白", description: "擂主以下一回合的胜负签订赌约。若胜利，可封禁挑战者的一个锦囊；若失败，则给直播间发放超大福袋。" },
	{ name: "净化", pool: "champion", quality: "白", description: "擂主可净化一个锦囊的效果。" },
	{ name: "家人们'救救我'", pool: "champion", quality: "白", description: "直播间开启投票决定是给擂主+1分还是-1分。" }
    ],
    tipDrawSettings: {
        drawCount: 3,             // 默认抽卡卡数
        chooseCount: 1,           // 默认选择卡片数
        refreshLimit: 3,          // 默认刷新总次数限制
        goldProb: 5,              // 金品质概率 %
        purpleProb: 15,           // 紫品质概率 %
        blueProb: 30,             // 蓝品质概率 %
        whiteProb: 50,            // 白品质概率 %
        refreshSameQuality: true  // 是否在同品质刷新
    },
    tipSession: {
        selectedTips: [],         // 已确认选择的锦囊
        logs: []                  // 锦囊抽取确认日志
    },

    // 5. 默认奖品列表数据
    prizes: [
        { name: "IPhone 17", tier: "一等奖", weight: 5 },
        { name: "主播同款键盘或鼠标", tier: "二等奖", weight: 10 },
        { name: "巨大红包", tier: "三等奖", weight: 15 },
        { name: "永劫周边", tier: "四等奖", weight: 20 },
        { name: "商城自选", tier: "五等奖", weight: 25 },
        { name: "奶茶一份", tier: "安慰奖", weight: 25 }
    ],
    prizeLogs: [],

    // 6. 转盘基础设定占位
    wheelsList: [
        { id: "preset_hero", name: "一、英雄转盘", isDuplicateAllowed: true, items: [] },
        { id: "preset_melee", name: "二、近战武器转盘", isDuplicateAllowed: true, items: [] },
        { id: "preset_ranged", name: "三、远程武器转盘", isDuplicateAllowed: true, items: [] },
        { id: "preset_player", name: "四、人员转盘", isDuplicateAllowed: true, items: [] },
        { id: "preset_prize", name: "五、奖品转盘", isDuplicateAllowed: true, items: [] }
    ],

    // 7. 计分板数据（8人局/12人局分开存储，切换不丢数据）
    scoreboard: {
        currentMode: '8',
        globalRankingPointsEnabled: true,
        rounds8: [],
        rounds12: [],
        rankingPointsRules8: [
            { minRank: 1, maxRank: 1, points: 2.5 },
            { minRank: 2, maxRank: 2, points: 1.0 },
            { minRank: 3, maxRank: 4, points: 0.5 },
            { minRank: 5, maxRank: 8, points: 0 }
        ],
        rankingPointsRules12: [
            { minRank: 1, maxRank: 1, points: 4.0 },
            { minRank: 2, maxRank: 2, points: 3.0 },
            { minRank: 3, maxRank: 3, points: 2.5 },
            { minRank: 4, maxRank: 4, points: 2.0 },
            { minRank: 5, maxRank: 6, points: 1.5 },
            { minRank: 7, maxRank: 8, points: 1.0 },
            { minRank: 9, maxRank: 10, points: 0.5 },
            { minRank: 11, maxRank: 12, points: 0 }
        ]
    }
};

// 自动初始化：所有锦囊默认激活参与抽取
DEFAULT_CONFIG.activeTipNames = DEFAULT_CONFIG.tips.map(t => t.name);

// ==================== 【智能版本同步核心算法】 ====================
let CURRENT_CONFIG;

// 1. 读取本地缓存（安全解析，防止数据损坏导致崩溃）
let localCache = null;
try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) localCache = JSON.parse(raw);
} catch (e) {
    console.warn("本地缓存数据损坏，将使用默认配置重新初始化:", e);
    localCache = null;
}

// 2. 规范化版本号：旧数据无版本号视为 0，强制触发迁移
if (!localCache || typeof localCache.configVersion !== 'number') {
    localCache = localCache || {};
    localCache.configVersion = 0;
}
// 判断是否需要同步磁盘文件数据 (升级至 15：全面修复变量漏项，注入锦囊核心)
if (DEFAULT_CONFIG.configVersion > (localCache.configVersion || 0)) {
    // 注意：全新环境下 localCache 被初始化为 {configVersion:0}（truthy），
    // 必须用 || 兜底，否则取到 undefined（#16 修复）
    let activeHeroes = localCache ? (localCache.activeHeroNames || DEFAULT_CONFIG.activeHeroNames) : DEFAULT_CONFIG.activeHeroNames;
    let activeWeapons = localCache ? (localCache.activeWeaponNames || DEFAULT_CONFIG.activeWeaponNames) : DEFAULT_CONFIG.activeWeaponNames;
    let activePlayers = localCache ? (localCache.activePlayerNames || DEFAULT_CONFIG.activePlayerNames) : DEFAULT_CONFIG.activePlayerNames;
    let activeTips = localCache ? (localCache.activeTipNames || DEFAULT_CONFIG.activeTipNames) : DEFAULT_CONFIG.activeTipNames;
    let heroSettings = localCache ? (localCache.heroDrawSettings || DEFAULT_CONFIG.heroDrawSettings) : DEFAULT_CONFIG.heroDrawSettings;
    let weaponSettings = localCache ? (localCache.weaponDrawSettings || DEFAULT_CONFIG.weaponDrawSettings) : DEFAULT_CONFIG.weaponDrawSettings;
    
    // 【修复核心】彻底提取磁盘中的锦囊配置与已选项
    let cachedTips = DEFAULT_CONFIG.tips;
    let cachedTipSettings = DEFAULT_CONFIG.tipDrawSettings;
    let cachedTipSession = localCache ? (localCache.tipSession || DEFAULT_CONFIG.tipSession) : DEFAULT_CONFIG.tipSession;
    
    let cachedPrizes = DEFAULT_CONFIG.prizes; 
    let cachedPrizeLogs = localCache ? (localCache.prizeLogs || []) : [];
    let cachedWheels = DEFAULT_CONFIG.wheelsList;
    let cachedScoreboard = localCache ? (localCache.scoreboard || DEFAULT_CONFIG.scoreboard) : DEFAULT_CONFIG.scoreboard;

    CURRENT_CONFIG = {
        configVersion: DEFAULT_CONFIG.configVersion,
        heroes: DEFAULT_CONFIG.heroes,
        weapons: DEFAULT_CONFIG.weapons,
        players: DEFAULT_CONFIG.players, 
        tips: cachedTips,                  // 🛠️ 修复：正式灌入内存中
        tipDrawSettings: cachedTipSettings,// 🛠️ 修复：正式灌入内存中
        tipSession: cachedTipSession,      // 🛠️ 修复：正式灌入内存中
        prizes: cachedPrizes,
        prizeLogs: cachedPrizeLogs,
        activeHeroNames: activeHeroes,
        activeWeaponNames: activeWeapons,
        activePlayerNames: activePlayers,
        activeTipNames: activeTips,
        heroDrawSettings: heroSettings,
        weaponDrawSettings: weaponSettings,
        wheelsList: cachedWheels,
        scoreboard: cachedScoreboard
    };
    
    // 保存至浏览器本地存储
    localStorage.setItem(STORAGE_KEY, JSON.stringify(CURRENT_CONFIG));
} else {
    // 3. 如果没有改变 configVersion，读取本地缓存
    CURRENT_CONFIG = localCache;
    
    // 🛠️ 防错双重兜底 (针对之前已经加载了 version 9 损坏缓存的旧用户)
    if (!CURRENT_CONFIG.tips || !CURRENT_CONFIG.tipDrawSettings || !CURRENT_CONFIG.tipSession) {
        CURRENT_CONFIG.tips = DEFAULT_CONFIG.tips;
        CURRENT_CONFIG.tipDrawSettings = DEFAULT_CONFIG.tipDrawSettings;
        CURRENT_CONFIG.tipSession = DEFAULT_CONFIG.tipSession;
    }
    if (!CURRENT_CONFIG.activeTipNames) {
        CURRENT_CONFIG.activeTipNames = DEFAULT_CONFIG.activeTipNames;
    }
    if (!CURRENT_CONFIG.tipSession.selectedTips) {
        CURRENT_CONFIG.tipSession.selectedTips = [];
        CURRENT_CONFIG.tipSession.logs = [];
    }
    if (!CURRENT_CONFIG.prizes) {
        CURRENT_CONFIG.prizes = DEFAULT_CONFIG.prizes;
        CURRENT_CONFIG.prizeLogs = [];
    }
    if (!CURRENT_CONFIG.players) {
        CURRENT_CONFIG.players = DEFAULT_CONFIG.players;
        CURRENT_CONFIG.activePlayerNames = DEFAULT_CONFIG.activePlayerNames;
    }
    if (!CURRENT_CONFIG.wheelsList) {
        CURRENT_CONFIG.wheelsList = DEFAULT_CONFIG.wheelsList;
    }
    if (!CURRENT_CONFIG.scoreboard || !CURRENT_CONFIG.scoreboard.rounds8 || !CURRENT_CONFIG.scoreboard.rounds12) {
        CURRENT_CONFIG.scoreboard = DEFAULT_CONFIG.scoreboard;
    }
    // #16 修复：兜底补全迁移分支漏掉的字段（全新环境首次访问被保存了 undefined 后再访问会走这里）
    if (!CURRENT_CONFIG.activeHeroNames) {
        CURRENT_CONFIG.activeHeroNames = DEFAULT_CONFIG.activeHeroNames;
    }
    if (!CURRENT_CONFIG.activeWeaponNames) {
        CURRENT_CONFIG.activeWeaponNames = DEFAULT_CONFIG.activeWeaponNames;
    }
    if (!CURRENT_CONFIG.activePlayerNames) {
        CURRENT_CONFIG.activePlayerNames = DEFAULT_CONFIG.activePlayerNames;
    }
    if (!CURRENT_CONFIG.heroDrawSettings) {
        CURRENT_CONFIG.heroDrawSettings = DEFAULT_CONFIG.heroDrawSettings;
    }
    if (!CURRENT_CONFIG.weaponDrawSettings) {
        CURRENT_CONFIG.weaponDrawSettings = DEFAULT_CONFIG.weaponDrawSettings;
    }
    // 兼容性补全：为旧数据 entries 补充 hero/eliminated/eliminatedAt 字段
    ['rounds8','rounds12'].forEach(key => {
        const rounds = CURRENT_CONFIG.scoreboard[key];
        if (!rounds) return;
        rounds.forEach(round => {
            if (!round.entries) return;
            round.entries.forEach(entry => {
                if (entry.hero === undefined) entry.hero = '';
                if (entry.eliminated === undefined) entry.eliminated = false;
                if (entry.eliminatedAt === undefined) entry.eliminatedAt = null;
            });
        });
    });
}

// 将 CURRENT_CONFIG 暴露到 window 对象（ES Module 通过 window.CURRENT_CONFIG 访问）
window.CURRENT_CONFIG = CURRENT_CONFIG;

// 封装保存方法（带错误处理）
function saveConfigToLocal() {
    try {
        const json = JSON.stringify(CURRENT_CONFIG);
        localStorage.setItem(STORAGE_KEY, json);
    } catch (e) {
        console.error("保存配置失败，可能是存储空间不足:", e);
        // 尝试用 alert 通知用户（此时 toast 系统可能未加载）
        if (typeof window.showToastWarning === 'function') {
            window.showToastWarning('本地存储空间不足，请清理浏览器缓存或导出配置后重置！');
        }
    }
}