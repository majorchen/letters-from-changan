export const ROLES: Record<string, { name: string; desc: string; emoji: string }> = {
  merchant: { name: "商人", desc: "善于交涉，在西市有人脉", emoji: "🏮" },
  musician: { name: "乐师", desc: "精通音律，容易被艺人接纳", emoji: "🎵" },
  wanderer: { name: "游侠", desc: "身手不凡，但容易引起官府注意", emoji: "⚔️" },
  scholar: { name: "书生", desc: "饱读诗书，能出入文人雅集", emoji: "📜" },
};

interface RoleConvergence {
  fragment: string;
  ahaMoment: string;
  finalQuestion: string;
}

export const ROLE_CONVERGENCE: Record<string, RoleConvergence> = {
  merchant: {
    fragment: "2077 的经济并不是单纯贫穷，而是信用、供应链和自动化配给同时崩塌；林深习惯用价格、债务、旧市场遗址来理解世界。",
    ahaMoment: "玩家发现长安账本里的异常价格不是普通生意问题，而是未来供应链崩塌在过去留下的回声。",
    finalQuestion: "如果每一次交易都会在未来变成债务，玩家还愿不愿意相信一纸契约？",
  },
  scholar: {
    fragment: "2077 的文化断层来自模型重写与摘要替代原文；很多典籍只剩被加工过的版本，林深分不清原文和重构文本。",
    ahaMoment: "玩家意识到自己怀里的策论、书坊抄本和林深记忆里的版本互相污染，文字本身已经成为时空裂缝。",
    finalQuestion: "如果记下来的文字都会被改写，玩家要把真相交给纸、交给人，还是交给记忆？",
  },
  wanderer: {
    fragment: "2077 并不和平，城市安全由算法、身份识别和私人武装共同维持；林深害怕被追踪不是幻想。",
    ahaMoment: "玩家发现自己刀上的缺口、暗榜和未来监控叙述指向同一件事：有人跨时代标记了他。",
    finalQuestion: "当被追踪的人可能也是追踪者，玩家该保护谁，又该怀疑谁？",
  },
  musician: {
    fragment: "2077 的创作被自动生成淹没，真人演奏变成稀有甚至危险的怀旧行为；林深怀念的不是音乐，而是有人真的在场。",
    ahaMoment: "玩家听出阿依旋律、自己的琵琶声和林深描述的未来广告铃声其实是同一个动机的三种版本。",
    finalQuestion: "如果未来只剩完美复制的声音，玩家此刻弹错的一个音还算不算更真实？",
  },
};
