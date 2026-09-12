/* 幻羽的离线设定、动作与星屿收藏。角色内容独立于场景和交互控制器。 */
export const CHARACTER = Object.freeze({
    name: '幻羽', nickname: '小羽', species: '星雾猫灵', home: '雾庭星屿',
    role: '梦境缝补师', birthday: '10 月 17 日',
    motto: '抱一下，今天会变好哦。',
    story: '来自雾庭星屿，收集破碎梦境与情绪碎片，为他人缝补心绪与睡眠。现在，她把一小片星屿安放在了这座森林里。',
    likes: '抱抱、云朵、甜牛奶、夜风，还有柔软毛绒玩偶。'
});

export const POSES = Object.freeze({
    welcome: { src: 'picture/oc/welcome.webp', label: '初次见面', alt: '银紫短发的猫灵幻羽，穿着毛绒紫色披肩，向你挥手' },
    hug: { src: 'picture/oc/hug.webp', label: '温柔抱抱', alt: '幻羽闭眼微笑，抱紧怀里的云朵猫玩偶' },
    milk: { src: 'picture/oc/milk.webp', label: '甜奶时间', alt: '幻羽用毛绒袖口捧着一杯温热的甜牛奶' },
    magic: { src: 'picture/oc/magic.webp', label: '缝补梦境', alt: '幻羽举起星铃钥杖，轻轻托起一枚梦境泡泡' },
    read: { src: 'picture/oc/read.webp', label: '一起探索', alt: '幻羽翻开森林绿手记，书页间夹着电路板书签' },
    sleep: { src: 'picture/oc/sleep.webp', label: '星屿晚安', alt: '幻羽蜷在蓬松尾巴上，抱着云朵猫安静入睡' }
});

export const KEEPSAKES = Object.freeze([
    { id: 'butterfly', title: '初遇的蝶结', hint: '轻轻摸摸小羽的头', text: '一枚停在指尖的蝴蝶结。谢谢你，温柔地靠近。', icon: 'butterfly' },
    { id: 'cloud', title: '云朵猫挂包', hint: '给小羽一个抱抱', text: '把刚刚的拥抱装进挂包，阴天也能拿出来暖一暖。', icon: 'cloud' },
    { id: 'milk', title: '甜奶小憩', hint: '请小羽喝甜牛奶', text: '冒着热气的一小杯甜。忙着创造世界，也记得照顾自己。', icon: 'milk' },
    { id: 'bell', title: '星铃钥杖', hint: '和小羽缝补一个梦', text: '星铃把散落的光缝在一起。愿今晚的梦，柔软又完整。', icon: 'wand' },
    { id: 'journal', title: '森林手记', hint: '听听小羽的探索建议', text: '把灵感夹在书页里。这里的技术笔记，也是一点点收集的星光。', icon: 'journal', href: 'blog.html', link: '翻开技术博客' },
    { id: 'circuit', title: '灵感电路', hint: '试试手记中的灵感电路', text: '一块会发光的小小电路板。魔法与科技，都从好奇心开始。', icon: 'circuit', href: 'studio.html', link: '走进工作室' }
]);

export const ACTIONS = Object.freeze({
    pat: { pose: 'hug', label: '有一点害羞', item: 'butterfly', lines: ['唔……耳朵有一点痒。不过，是你的话，可以再摸一下。', '你的手心暖暖的，像晒过太阳的云朵。'] },
    hug: { pose: 'hug', label: '被温柔包围', item: 'cloud', lines: ['抱一下，今天会变好哦。辛苦的部分，可以先放在我这里。', '接住你啦。什么都不用说，靠一会儿也很好。'] },
    milk: { pose: 'milk', label: '甜奶补给中', item: 'milk', lines: ['是甜牛奶！我分你一半……唔，最大的那一半。', '暖暖的甜奶，配一点夜风。今天的小幸福收集到了。'] },
    magic: { pose: 'magic', label: '正在缝补星光', item: 'bell', lines: ['星铃，轻一点响……把散落的心绪，缝成一颗柔软的星。', '不用着急变得闪闪发光。小小的你，也有自己的星轨。'] },
    read: { pose: 'read', label: '好奇心上线', item: 'journal', lines: ['这本手记里藏着代码、灵感和小小的发现。要一起翻翻技术博客吗？', '工具箱里有好多有趣的小东西。原来，好奇心也能做成工具呀。'] },
    circuit: { pose: 'read', label: '发现新的灵感', item: 'circuit', lines: ['这块小电路会亮！去工作室看看吧，那里藏着 Huanfly 的创造魔法。'] }
});

export function greeting(daypart, returning = false) {
    if (returning) return '你回来啦，我把那枚蝴蝶结好好收着呢。今天也一起待一会儿吧。';
    return ({ dawn: '早呀，星屿的雾还没散。我是幻羽，你可以叫我小羽。', day: '你好呀，我是幻羽。带着一点星雾，来陪你探索这个小小世界。', dusk: '晚霞像打翻了甜奶里的草莓酱。来，一起歇一会儿吧。', night: '嘘，星铃已经放轻了声音。我是小羽，今晚陪你收集一点星光。' })[daypart] || '你好呀，我是幻羽。抱一下，今天会变好哦。';
}

export function readCollection(storage) {
    try {
        const saved = JSON.parse(storage.getItem('huanyu.keepsakes.v1'));
        return Array.isArray(saved) ? [...new Set(saved.filter(id => KEEPSAKES.some(item => item.id === id)))] : [];
    } catch { return []; }
}

// 语音转写只映射到明确的本地动作；不会执行文本或自动打开链接。
export function actionFromTranscript(text) {
    if (typeof text !== 'string') return null;
    return [[/摸|摸头/, 'pat'], [/抱/, 'hug'], [/奶|喝/, 'milk'], [/梦|星铃|魔法/, 'magic'], [/电路|工作室/, 'circuit'], [/书|博客|工具|探索/, 'read']].find(([pattern]) => pattern.test(text))?.[1] || null;
}
