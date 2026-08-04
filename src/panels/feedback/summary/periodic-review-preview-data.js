// Frontend-only periodic-review preview.
// This data was manually derived from the higo tenant's atoms and raw conversation.
// It is intentionally separate from the current EchoMem Summary contract until the
// backend prompts and schema are redesigned for topic attention and review sections.

const TOPIC_COLORS = ['#6750a4', '#3b8f6c', '#b87a24'];

function dailyReview({
  date,
  weekday,
  atoms,
  messages,
  expressions,
  title,
  subtitle,
  observation,
  topics,
  facts,
  nextTitle,
  nextItems,
  nextObservation,
}) {
  return {
    modeLabel: 'DAILY RECAP',
    railTitle: '今天，值得看清什么',
    period: `2026 年 7 月 ${Number(date)} 日`,
    evidenceLabel: `1 段会话 · ${atoms} 条原子 · ${messages} 条消息`,
    cards: {
      overview: {
        label: '今日概览',
        kicker: `2026 · 07 / ${date} · ${weekday}`,
        title,
        subtitle,
        agentLabel: 'ECHO 注意到',
        agentText: observation,
      },
      topics: {
        label: '关注分布',
        kicker: '今日关注分布',
        title: '今天，你主要关注了什么',
        note: `按你的 ${expressions} 条表达归入一个主主题 · 原子用于校准事实`,
        items: topics.map((topic, index) => ({ ...topic, color: TOPIC_COLORS[index] })),
      },
      facts: {
        label: '今天确定了什么',
        kicker: '值得记住',
        title: '今天真正确定了什么',
        items: facts,
      },
      next: {
        label: '接下来',
        kicker: '开放事项',
        title: nextTitle,
        items: nextItems,
        agentLabel: 'ECHO 的整理',
        agentText: nextObservation,
      },
    },
  };
}

const DAILY_REVIEWS = {
  '2026-07-06': dailyReview({
    date: '06', weekday: '周一', atoms: 1, messages: 10, expressions: 5,
    title: '目标没有变轻，\n但优先级终于清楚了',
    subtitle: '季度规划刚结束，Q3 的增长压力随之落地：DAU 要从 80 万到 120 万，次周留存要从 32% 到 38%。你列出邀请裂变、onboarding 重做和分层 Push 三条路径，也从会议反馈里看见留存比单纯拉高规模更值得优先。',
    observation: '明确优先级后，你仍然感到压力，但那种“悬着”的焦虑开始变得具体。当天记录更像方向收拢，还不是完整排期。',
    topics: [
      { label: 'Q3 目标与指标', countLabel: '2 条表达', percent: 40, insight: '你反复确认两项核心指标，并开始接受留存需要排在规模之前。' },
      { label: '增长方案拆解', countLabel: '2 条表达', percent: 40, insight: '邀请裂变、onboarding 和分层 Push 构成了最初的三条执行路径。' },
      { label: '情绪与压力', countLabel: '1 条表达', percent: 20, insight: '压力没有消失，但清晰的优先级让你比会前更踏实。' },
    ],
    facts: [
      { tag: '目标', text: 'Q3 计划将 DAU 从 80 万提升到 120 万，次周留存从 32% 提升到 38%。', evidence: '原始对话' },
      { tag: '方向', text: '初步增长方案包含邀请裂变激励、onboarding 重做和分层 Push。', evidence: '原始对话' },
      { tag: '优先级', text: '会议反馈把留存推到更高优先级；当天仍需把这一方向转成具体排期。', evidence: '原始对话 + 1 条原子' },
      { tag: '状态', text: '你明确表达了焦虑，也确认目标清楚后心里更有底。', evidence: '原始对话' },
    ],
    nextTitle: '方向已经收拢，下一步是把优先级变成计划',
    nextItems: [
      { title: '拆出留存优先的执行路径', detail: '把指标、假设和验证方式对应起来。', status: '待拆解' },
      { title: '明确三条方案的先后关系', detail: 'onboarding、邀请裂变和分层 Push 仍缺少统一排期。', status: '待排期' },
      { title: '给压力留出恢复空间', detail: '清晰不等于轻松，后续仍需要关注工作节奏。', status: '持续关注' },
    ],
    nextObservation: '今天最有价值的不是多列了一份方案，而是开始用留存来筛选方案。接下来应让每项工作都能回答“它如何改善留存”。',
  }),
  '2026-07-07': dailyReview({
    date: '07', weekday: '周二', atoms: 8, messages: 8, expressions: 4,
    title: '一次争执，最后变成了\n可执行的折中方案',
    subtitle: '你与王磊围绕 onboarding 重做发生争执：你担心核心留存问题继续拖延，他则强调版本风险。最后双方收敛到最小可行版，两周内进入灰度；邀请裂变由他的团队并行推进。午饭时关系也缓和下来。',
    observation: '真正的进展不是谁说服了谁，而是产品目标和技术风险都进入了方案。你也开始意识到，尊重风险会让沟通更有效。',
    topics: [
      { label: 'Onboarding 方案', countLabel: '2 条表达', percent: 50, insight: '争议最终收敛为最小可行版和两周灰度，范围与时间都更具体。' },
      { label: '协作关系', countLabel: '1 条表达', percent: 25, insight: '午饭时的缓和说明分歧没有演变成持续的人际对立。' },
      { label: '沟通反思', countLabel: '1 条表达', percent: 25, insight: '你把这次冲突理解为需要更早尊重技术风险，而不只是坚持完整方案。' },
    ],
    facts: [
      { tag: '分歧', text: '你希望尽快重做 onboarding，王磊担心当前版本风险并倾向推迟到 Q4。', evidence: '原始对话 + 2 条原子' },
      { tag: '共识', text: '双方决定先做 onboarding 最小可行版，并计划两周内进入灰度。', evidence: '原始对话 + 2 条原子' },
      { tag: '并行推进', text: '邀请裂变由王磊的团队并行开发。', evidence: '原始对话 + 1 条原子' },
      { tag: '反思', text: '你确认沟通需要同时尊重产品目标和技术风险。', evidence: '原始对话 + 3 条原子' },
    ],
    nextTitle: '共识已经形成，接下来要守住范围与节奏',
    nextItems: [
      { title: '锁定最小可行版范围', detail: '避免两周灰度目标被新的细节继续推大。', status: '待确认' },
      { title: '同步邀请裂变的并行计划', detail: '需要明确两个方向之间的依赖和负责人。', status: '待跟进' },
      { title: '把风险前置到方案讨论', detail: '下一次沟通先让技术团队表达约束，再共同收敛。', status: '待实践' },
    ],
    nextObservation: '这次折中不是退让，而是把“大改造”变成可以验证的第一步。后续价值取决于范围是否真的足够小、两周节点是否守得住。',
  }),
  '2026-07-08': dailyReview({
    date: '08', weekday: '周三', atoms: 7, messages: 7, expressions: 4,
    title: '候选人的增长能力很亮眼，\n管理经验仍需验证',
    subtitle: '你完成了一位增长运营候选人的面试。对方有单场活动新增超过 10 万的经历，A/B 测试和数据复盘能力突出；但缺少带团队经验，而增长团队正准备扩到 5 人。你已请 HR 安排总监面。',
    observation: '你的判断没有停在“业务结果好”上，而是主动把团队扩张后的管理要求纳入评估。推进下一轮不等于风险已经消失。',
    topics: [
      { label: '候选人能力', countLabel: '2 条表达', percent: 50, insight: '你重点验证了增长结果、实验方法和数据复盘能力。' },
      { label: '团队扩张与管理', countLabel: '1 条表达', percent: 25, insight: '团队将扩到 5 人，使带队经验从加分项变成了真实风险。' },
      { label: '招聘推进', countLabel: '1 条表达', percent: 25, insight: '你没有仓促定论，而是把问题留给总监面继续验证。' },
    ],
    facts: [
      { tag: '经历', text: '候选人曾负责单场新增超过 10 万的增长活动。', evidence: '原始对话 + 2 条原子' },
      { tag: '优势', text: 'A/B 测试设计和数据复盘能力是本轮面试中最突出的能力。', evidence: '原始对话 + 2 条原子' },
      { tag: '风险', text: '候选人缺少带团队经验，而增长团队计划扩展到 5 人。', evidence: '原始对话 + 2 条原子' },
      { tag: '进展', text: '你已经请 HR 安排下一轮总监面。', evidence: '原始对话 + 1 条原子' },
    ],
    nextTitle: '能力值得继续验证，管理风险不能被结果光环掩盖',
    nextItems: [
      { title: '完成总监面', detail: '继续验证候选人的判断力与岗位匹配度。', status: '待安排' },
      { title: '补充管理情境问题', detail: '重点了解带人、授权和冲突处理经验。', status: '待验证' },
      { title: '评估培养成本', detail: '若录用，需要判断管理能力能否在团队扩张前补足。', status: '待评估' },
    ],
    nextObservation: '候选人的业务能力已经提供了继续推进的理由，但最终判断应同时回答：她能否自己做出结果，也能否带着扩张后的团队做出结果。',
  }),
  '2026-07-09': dailyReview({
    date: '09', weekday: '周四', atoms: 5, messages: 9, expressions: 5,
    title: '你把一次公开投诉，\n转成了两层补救',
    subtitle: '一位老客户反馈个性化推荐入口找不到关闭按钮。你先私信道歉，并与苏晴快速确定当晚补上显眼入口；随后又把注意力转向灰度比例和内部 dogfood，试图从流程上避免重演。',
    observation: '你的情绪从“糟透了、很烦躁”慢慢回到踏实；不过记录只确认了补救决定，还没有确认关闭入口已经上线。',
    topics: [
      { label: '客户反馈与补救', countLabel: '2 条表达', percent: 40, insight: '你先面对公开投诉，再用道歉和快速会把问题转成明确的补救动作。' },
      { label: '产品体验与发布', countLabel: '2 条表达', percent: 40, insight: '注意力从关闭按钮的体验缺口，延伸到了灰度比例和上线前验证流程。' },
      { label: '情绪与复盘', countLabel: '1 条表达', percent: 20, insight: '烦躁没有立刻消失，但完成处理后，你明确感到踏实了一些。' },
    ],
    facts: [
      { tag: '问题', text: '老客户在公开群聊中反馈：7 月 2 日上线的个性化推荐入口缺少容易找到的关闭按钮。', evidence: '原始对话 + 1 条事件原子' },
      { tag: '即时处理', text: '你先向客户私信道歉，又拉苏晴开了 15 分钟快速会。', evidence: '原始对话 + 2 条事件原子' },
      { tag: '明确决定', text: '当晚加急补一个显眼的关闭入口；这是已确定动作，不等同于已经上线。', evidence: '原始对话 + 1 条事件原子' },
      { tag: '后续计划', text: '把灰度比例从 10% 降到 5%，并让新功能强制完成一周内部 dogfood。', evidence: '原始对话 + 2 条偏好原子' },
    ],
    nextTitle: '处理已经开始，但还没有完全闭环',
    nextItems: [
      { title: '确认关闭入口已经上线', detail: '当天记录到的是“决定当晚加急补”，没有后续完成证据。', status: '待确认' },
      { title: '将灰度比例降到 5%', detail: '这是当天明确提出的发布风控计划。', status: '待执行' },
      { title: '落实一周内部 dogfood', detail: '需要在后续记录中确认是否进入固定发布流程。', status: '待执行' },
    ],
    nextObservation: '今天已经把一次客诉转成具体补救和风控计划。下一次回顾最值得确认的，不是再复述问题，而是这三个动作是否真正完成。',
  }),
  '2026-07-10': dailyReview({
    date: '10', weekday: '周五', atoms: 1, messages: 7, expressions: 4,
    title: '你在周复盘里看见成果，\n也看见了透支',
    subtitle: '你把本周三件关键进展收拢起来：Q3 留存优先、onboarding 与邀请裂变达成共识、客诉推动发布流程补救。与此同时，你也明确说自己很累，已经连续三天工作到晚上十点以后。',
    observation: '成果和疲惫同时成立。周末安排里既有候选人反馈，也有羽毛球和见朋友，说明你已经在主动给恢复留位置。',
    topics: [
      { label: '本周工作复盘', countLabel: '2 条表达', percent: 50, insight: '你把分散的工作收拢为目标、协作和风险处理三项进展。' },
      { label: '身体与恢复', countLabel: '1 条表达', percent: 25, insight: '连续三个晚归节点让疲惫变成需要正视的事实，而不是模糊感受。' },
      { label: '周末安排', countLabel: '1 条表达', percent: 25, insight: '羽毛球和见朋友为恢复提供了具体安排，但候选人反馈仍占用部分注意力。' },
    ],
    facts: [
      { tag: '复盘', text: '你确认本周完成了 Q3 优先级收拢、协作方案达成和客诉处理三项关键推进。', evidence: '原始对话 + 1 条原子' },
      { tag: '状态', text: '你连续三天工作到晚上十点以后，并明确感到疲惫。', evidence: '原始对话' },
      { tag: '待办', text: '周末仍需给出候选人面试反馈。', evidence: '原始对话' },
      { tag: '恢复', text: '你计划周六打羽毛球，下午和朋友喝咖啡。', evidence: '原始对话' },
    ],
    nextTitle: '本周已经收尾，但恢复也需要被当成计划',
    nextItems: [
      { title: '完成候选人反馈', detail: '把必要工作收束到一个明确时段，避免侵占整个周末。', status: '待完成' },
      { title: '保留羽毛球和见朋友', detail: '这是已经说出的恢复安排，不应轻易被临时工作挤掉。', status: '已安排' },
      { title: '观察连续晚归', detail: '若高强度延续，需要调整下周任务和授权方式。', status: '持续关注' },
    ],
    nextObservation: '这一天最重要的提醒是：复盘不只盘点完成了什么，也要看你用什么代价完成。下周的效率可能更依赖授权，而不是继续拉长工作时间。',
  }),
  '2026-07-11': dailyReview({
    date: '11', weekday: '周六', atoms: 8, messages: 7, expressions: 4,
    title: '运动让状态回升，\n一次对话让协作问题变清楚',
    subtitle: '运动后你的状态明显变好。与一位产品经理朋友聊天时，对方指出你不够授权、总想自己把方案打磨完整。你认可这个观察，并想到如果先让技术团队评估风险，周二的冲突也许可以更早避免。',
    observation: '你把“沟通不顺”进一步定位成工作方式问题：不是表达得不够好，而是团队进入方案的时机太晚。你已经提出周一把灰度细节交给苏晴和王磊共创。',
    topics: [
      { label: '授权与协作', countLabel: '2 条表达', percent: 50, insight: '关注点从如何说服团队，转向如何让团队更早参与方案形成。' },
      { label: '沟通复盘', countLabel: '1 条表达', percent: 25, insight: '你重新理解了周二冲突：技术风险若更早进入讨论，分歧可能更容易收敛。' },
      { label: '状态恢复', countLabel: '1 条表达', percent: 25, insight: '运动带来的状态改善是当天清晰可见的积极变化。' },
    ],
    facts: [
      { tag: '状态', text: '运动后，你明确感到精神状态有所恢复。', evidence: '原始对话 + 1 条原子' },
      { tag: '反馈', text: '朋友指出你习惯自己打磨完整方案，授权和共创不足。', evidence: '原始对话 + 2 条原子' },
      { tag: '反思', text: '你认可这一点，并将周二冲突与技术风险介入太晚联系起来。', evidence: '原始对话 + 3 条原子' },
      { tag: '计划', text: '你计划周一早会把 onboarding 灰度细节交给苏晴和王磊共同确定。', evidence: '原始对话 + 2 条原子' },
    ],
    nextTitle: '认知已经形成，真正的变化要在周一发生',
    nextItems: [
      { title: '把灰度细节交给团队共创', detail: '周一早会是验证授权是否落地的第一个节点。', status: '待实践' },
      { title: '从约束开始讨论方案', detail: '先听技术风险，再共同决定范围和节奏。', status: '待实践' },
      { title: '继续保留运动', detail: '当天状态变化说明恢复活动对你确实有效。', status: '持续保持' },
    ],
    nextObservation: '今天的洞察很有价值，但它还只是意图。下周最值得观察的是：当团队提出不同意见时，你是否真的能把方案控制权留在桌面中央。',
  }),
  '2026-07-12': dailyReview({
    date: '12', weekday: '周日', atoms: 5, messages: 7, expressions: 4,
    title: '你把下周重点收拢到\n推进与授权两条线',
    subtitle: '周日的计划里，你列出 onboarding 灰度、邀请裂变、关闭入口状态和候选人二面四项工作重点；同时把“少做一点完整方案、让团队共同形成答案”作为新的工作方式，并准备从周一开始实践。',
    observation: '任务列表并不短，但比任务更关键的是推进方式发生了变化。现在能确认的是计划已经清楚，是否真正授权仍要看下周的具体行为。',
    topics: [
      { label: '下周工作推进', countLabel: '2 条表达', percent: 50, insight: '产品、发布和招聘事项被收拢为四个可以跟进的节点。' },
      { label: '授权与共创', countLabel: '2 条表达', percent: 50, insight: '你把授权从抽象反思变成了周一开始执行的工作原则。' },
    ],
    facts: [
      { tag: '产品', text: '下周重点包括 onboarding 灰度和邀请裂变推进。', evidence: '原始对话 + 2 条原子' },
      { tag: '闭环', text: '需要确认个性化推荐关闭入口的实际状态。', evidence: '原始对话 + 1 条原子' },
      { tag: '招聘', text: '候选人下一轮面试仍在下周计划中。', evidence: '原始对话 + 1 条原子' },
      { tag: '工作方式', text: '你决定减少自己包办完整方案，更多让团队共同形成答案。', evidence: '原始对话 + 1 条原子' },
    ],
    nextTitle: '计划已经清楚，周一要验证新的推进方式',
    nextItems: [
      { title: '推进 onboarding 与邀请裂变', detail: '同时守住最小范围和并行协作的共识。', status: '下周重点' },
      { title: '确认关闭入口与候选人进展', detail: '让两个尚未闭环的事项得到明确结果。', status: '待跟进' },
      { title: '在周一早会实践授权', detail: '让苏晴和王磊参与形成灰度细节，而不是只接收完整方案。', status: '待实践' },
    ],
    nextObservation: '下周是否更顺，不只取决于四项任务完成多少，也取决于你是否真的把判断过程交给团队共享。',
  }),
};

const WEEKLY_REVIEWS = {
  '2026-W28': {
    modeLabel: 'WEEKLY RECAP',
    railTitle: '这一周，什么最重要',
    period: '2026 年第 28 周',
    evidenceLabel: '7 月 6 日 — 7 月 12 日 · 7 天记录',
    cards: {
      overview: {
        label: '本周概览',
        kicker: '2026 · WEEK 28 · 07 / 06 — 07 / 12',
        title: '这一周，你一边推进增长目标，\n一边重新学习怎样协作',
        subtitle: '从明确 Q3 留存优先，到与王磊达成 onboarding 最小可行版的共识，再到处理客诉、复盘授权方式，这一周的主线并不是“做了很多事”，而是目标、协作和风险处理逐渐连成了一条线。',
        agentLabel: 'ECHO 的周度观察',
        agentText: '最明显的变化是：你开始把“方案是否足够完整”让位给“团队能否共同推进”。这是已经形成的认识，但是否真正改变工作方式，还要看下一周的行动。',
      },
      highlights: {
        label: '本周高光',
        kicker: '本周高光',
        title: '真正改变了后续方向的三个节点',
        items: [
          {
            date: '07 / 06',
            title: 'Q3 目标明确为留存优先',
            text: 'DAU 目标是从 80 万提升到 120 万，次周留存从 32% 提升到 38%；周五复盘时，你再次确认了留存优先。',
          },
          {
            date: '07 / 07',
            title: '冲突最终转成可执行的协作方案',
            text: '你与王磊决定 onboarding 先做最小可行版、两周内上线灰度，邀请裂变由他的团队并行开发。',
          },
          {
            date: '07 / 09',
            title: '客诉推动发布风控升级',
            text: '你先完成道歉和快速决策，又提出把灰度降到 5%、强制一周内部 dogfood；这些是明确计划，尚需后续完成证据。',
          },
        ],
      },
      trend: {
        label: '关注变化',
        kicker: '本周关注变化',
        title: '你的注意力，如何一步步转移',
        ariaLabel: '本周关注趋势：周初集中在增长目标与产品推进，周中转向协作和客户风险，周末更多反思协作方式与个人状态。',
        series: [
          { label: '目标与产品', color: '#6750a4' },
          { label: '协作与团队', color: '#3b8f6c' },
          { label: '风险与状态', color: '#b87a24' },
        ],
        rows: [
          { day: '周一', values: [80, 0, 20] },
          { day: '周二', values: [50, 50, 0] },
          { day: '周三', values: [0, 100, 0] },
          { day: '周四', values: [40, 20, 40] },
          { day: '周五', values: [50, 0, 50] },
          { day: '周六', values: [0, 75, 25] },
          { day: '周日', values: [50, 50, 0] },
        ],
        agentLabel: 'ECHO 注意到',
        agentText: '周初是目标和方案，周中被冲突、招聘与客诉拉向协作和风险，周末则明显回到授权方式与身体状态。图中比例按你每天表达的主主题归类。',
      },
      changes: {
        label: '形成的变化',
        kicker: '本周形成的变化',
        title: '目标、协作和风控都发生了具体变化',
        items: [
          { tag: '目标排序', text: 'Q3 不再只看增长规模；次周留存 38% 被放到更高优先级。' },
          { tag: '推进方式', text: 'onboarding 从完整重构收敛为最小可行版，并与邀请裂变并行推进。' },
          { tag: '协作认识', text: '你意识到要先尊重技术风险、减少自己抠细节，并计划让苏晴和王磊共创灰度方案。' },
          { tag: '发布风控', text: '一次客户投诉推动你提出更小灰度比例和一周内部 dogfood。' },
        ],
      },
      next: {
        label: '尚未结束',
        kicker: '开放事项',
        title: '这些事情，还值得继续推进',
        items: [
          {
            title: 'onboarding 最小可行版进入两周灰度',
            detail: '本周只有共识与排期，没有完成或上线证据。',
            status: '待跟进',
          },
          {
            title: '确认关闭入口、5% 灰度和 dogfood 落地',
            detail: '三项都来自明确决定或计划，但本周记录未确认完成。',
            status: '待确认',
          },
          {
            title: '跟进候选人总监面结果',
            detail: '你已让 HR 安排下一轮，周日仍把结果列为下周重点。',
            status: '待跟进',
          },
          {
            title: '在周一早会实践授权',
            detail: '计划把 onboarding 灰度细节交给苏晴和王磊共同确定。',
            status: '待实践',
          },
        ],
        agentLabel: 'ECHO 的建议',
        agentText: '下周最值得看的不是任务数量，而是两件事：发布补救是否闭环，以及你是否真的把方案细节交给团队共创。',
      },
    },
  },
};

export const PERIODIC_REVIEW_PREVIEW = Object.freeze({
  daily: Object.freeze({
    defaultKey: '2026-07-09',
    items: Object.freeze(DAILY_REVIEWS),
  }),
  weekly: Object.freeze({
    defaultKey: '2026-W28',
    items: Object.freeze(WEEKLY_REVIEWS),
  }),
});
