import type { WorldEvent } from '@/lib/types';

export const WORLD_EVENTS: WorldEvent[] = [
  { code: "world_west_market_tax", phase: "act1", roles: ["merchant"], scene: "西市税吏查账", detail: "税吏临时加查胡商货单，商人们嘴上抱怨，手里却都备着第二本账。" },
  { code: "world_exam_notice", phase: "act1", roles: ["scholar"], scene: "书坊贴出新榜文", detail: "榜文说今年取士仍重诗赋，旁边有人低声说真正要紧的是谁替你递话。" },
  { code: "world_pipa_invitation", phase: "act1", roles: ["musician"], scene: "酒肆邀乐", detail: "一个管事听见琵琶声，邀玩家夜里去平康坊试曲，却不肯说主人是谁。" },
  { code: "world_street_duel_warning", phase: "act1", roles: ["wanderer"], scene: "街角冲突", detail: "两个少年为一柄旧刀争执，旁人围看，守卒却像早知道会发生一样提前赶来。" },
  { code: "world_ward_gate_closing", phase: "act1", scene: "坊门提前落锁", detail: "坊门比平日早落了半刻，老门卒说是上头吩咐，问是谁吩咐却只摇头。" },
  { code: "world_missing_child_rumor", phase: "act1", scene: "茶摊闲话", detail: "茶摊上有人说隔壁坊一个孩子走丢，另一个人立刻打断，说那孩子明明昨天还在。" },
  { code: "world_silk_price_jump", phase: "act2", roles: ["merchant"], scene: "丝价骤涨", detail: "同一匹绢半日内涨了两成，货主说边地军需吃紧，随后又说自己只是猜的。" },
  { code: "world_poem_duplicate", phase: "act2", roles: ["scholar"], scene: "诗会重句", detail: "诗会上两个素不相识的人写出同一句下联，连停顿处都一样。" },
  { code: "world_song_memory_gap", phase: "act2", roles: ["musician"], scene: "曲谱缺页", detail: "曲谱中间少了一页，乐工却都能照着空白处继续弹，仿佛缺的只是纸。" },
  { code: "world_knife_shop_refusal", phase: "act2", roles: ["wanderer"], scene: "刀铺拒修", detail: "刀匠看见玩家兵器上的缺口，脸色一变，说这种痕不是唐刀留下的。" },
  { code: "world_letter_paper_trade", phase: "act2", scene: "纸铺异纸", detail: "纸铺掌柜拿出一种过分洁白的纸，称是旧库底货；纸面却不吸墨。" },
  { code: "world_night_drum_skip", phase: "act2", scene: "更鼓漏响", detail: "夜里更鼓少敲了一下，整条街的人都没反应，只有玩家觉得时间像缺了一块。" },
  { code: "world_border_goods_shortage", phase: "act3", roles: ["merchant"], scene: "边货断供", detail: "西市几家铺子同时缺边地皮货，掌柜们统一说是路远，却都在收金银细软。" },
  { code: "world_failed_memorial", phase: "act3", roles: ["scholar"], scene: "奏疏被退", detail: "一个老儒的奏疏被原封退回，封皮上只批了四字：不合时宜。" },
  { code: "world_broken_performance", phase: "act3", roles: ["musician"], scene: "宴乐中断", detail: "席间乐声忽然中断，主人说弦断不吉，要众人忘了刚才那支曲子。" },
  { code: "world_hidden_wanted_list", phase: "act3", roles: ["wanderer"], scene: "暗榜换名", detail: "坊墙上的缉捕暗榜被人半夜换过，墨迹未干，榜上一角像是玩家的背影。" },
  { code: "world_fanyang_whisper", phase: "act3", scene: "范阳耳语", detail: "酒客听见'范阳'二字便收声，王掌柜把酒壶放重了些，说小店不谈远处的事。" },
  { code: "world_departure_queue", phase: "act3", scene: "离京车队", detail: "清晨有车队往城外去，主人说是省亲，仆人却把祖宗牌位也抱上了车。" },
  { code: "world_grain_measure_change", phase: "act3", scene: "米斗变浅", detail: "米铺的斗看起来没变，装出来却少了一把，伙计说这些日子大家都这么卖。" },
  { code: "world_silent_post_station", phase: "act3", scene: "驿站沉默", detail: "驿站门口拴着汗透的马，驿卒们谁也不说话，只把军报一层层往里递。" },
];
