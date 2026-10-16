const Fu = require("./engine.js");

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error("FAIL", msg);
  }
}

function assertEq(actual, expected, msg) {
  if (actual !== expected) {
    failed += 1;
    console.error("FAIL", msg, "expected", expected, "got", actual);
  }
}

assertEq(Fu.sequenceWait(["m1", "m2", "m3"], "m1"), "ryanmen", "123 听 1 是两面");
assertEq(Fu.sequenceWait(["m1", "m2", "m3"], "m2"), "kanchan", "123 听 2 是嵌张");
assertEq(Fu.sequenceWait(["m1", "m2", "m3"], "m3"), "penchan", "123 听 3 是边张");
assertEq(Fu.sequenceWait(["s7", "s8", "s9"], "s7"), "penchan", "789 听 7 是边张");
assertEq(Fu.sequenceWait(["s7", "s8", "s9"], "s9"), "ryanmen", "789 听 9 是两面");
assertEq(Fu.sequenceWait(["p6", "p7", "p8"], "p6"), "ryanmen", "678 听 6 是两面");
assertEq(Fu.sequenceWait(["p6", "p7", "p8"], "p8"), "ryanmen", "678 听 8 是两面");
assertEq(Fu.sequenceWait(["p4", "p5", "p6"], "p5"), "kanchan", "456 听 5 是嵌张");

assertEq(Fu.pairInfo("z5", "E", "S").fu, 2, "白是役牌");
assertEq(Fu.pairInfo("z1", "E", "S").fu, 2, "场风东");
assertEq(Fu.pairInfo("z2", "E", "S").fu, 2, "自风南");
assertEq(Fu.pairInfo("z2", "S", "S").fu, 4, "连风南");
assertEq(Fu.pairInfo("z3", "E", "S").fu, 0, "客风西");
assertEq(Fu.pairInfo("p5", "E", "S").fu, 0, "数牌雀头");

const examples = Fu.exampleProblems();
assertEq(examples.length, 13, "经典例题数量");
const expectedFu = [30, 20, 40, 40, 20, 30, 30, 30, 40, 70, 40, 40, 25];
examples.forEach((problem, index) => {
  assertEq(problem.answer.fu, expectedFu[index], problem.title + " 符数");
  assert(!problem.fallback, problem.title + " 不是回退牌");
  const itemSum = problem.answer.items.reduce((sum, item) => sum + item.fu, 0);
  assertEq(itemSum, problem.answer.raw, problem.title + " 明细加总");
});

assertEq(examples[1].answer.special, "pinfu-tsumo", "平和自摸标记");
assertEq(examples[1].answer.raw, 22, "平和自摸普通合计是 22");
assertEq(examples[12].answer.special, "chiitoi", "七对子标记");
assertEq(examples[2].answer.raw, 32, "单骑进位前 32");
assertEq(examples[9].answer.menzen, true, "暗杠仍然门清");
assertEq(examples[10].answer.menzen, false, "明杠不是门清");

assertEq(Fu.evaluateGuess(examples[1].answer, 20).correct, true, "平和自摸答 20");
assert(Fu.evaluateGuess(examples[1].answer, 30).hints.length > 0, "平和自摸答 30 有提示");
assert(Fu.evaluateGuess(examples[2].answer, 32).hints[0].indexOf("40") >= 0, "32 提示进位到 40");
assertEq(Fu.evaluateGuess(examples[12].answer, 25).correct, true, "七对子答 25");

function handStats(level, count) {
  const waits = {};
  let pinfu = 0;
  let chiitoi = 0;
  let open = 0;
  let kan = 0;
  let fallback = 0;
  const fus = {};
  for (let i = 0; i < count; i++) {
    const problem = Fu.createProblem(level);
    if (problem.fallback) fallback += 1;
    const fu = problem.answer.fu;
    fus[fu] = (fus[fu] || 0) + 1;
    if (problem.answer.isPinfu) pinfu += 1;
    if (problem.isChiitoi) chiitoi += 1;
    if (problem.openMelds.length) open += 1;
    if (problem.ankans.length || problem.openMelds.some((m) => m.type === "kan")) kan += 1;
    if (!problem.isChiitoi) {
      waits[problem.wait] = (waits[problem.wait] || 0) + 1;
      const kanCount = problem.ankans.length + problem.openMelds.filter((m) => m.type === "kan").length;
      const tiles =
        problem.concealed.length +
        problem.openMelds.reduce((n, m) => n + Fu.expandTiles(m).length, 0) +
        problem.ankans.reduce((n, m) => n + Fu.expandTiles(m).length, 0);
      assertEq(tiles, 14 + kanCount, level + " 牌张数 " + problem.title);
      assert(fu === 20 || fu === 25 || fu % 10 === 0, "符数合法 " + fu);
      assert(problem.answer.raw % 2 === 0, "原始符是偶数");
    } else {
      assertEq(fu, 25, "随机七对子");
    }
    Fu.layoutHand(problem.concealed, problem.winTile);
    assert(Fu.listYaku(problem).length > 0, level + " 随机牌必须有役");
  }
  return { waits, pinfu, chiitoi, open, kan, fallback, fus };
}

["beginner", "intermediate", "advanced"].forEach((level) => {
  const stats = handStats(level, 80);
  console.log(level, JSON.stringify(stats));
  assertEq(stats.fallback, 0, level + " 没有失败回退");
  if (level === "beginner") {
    assertEq(stats.open, 0, "入门没有副露");
    assertEq(stats.kan, 0, "入门没有杠");
    assertEq(stats.chiitoi, 0, "入门没有七对子");
    assert(stats.pinfu > 0, "入门含平和");
  }
  if (level === "intermediate") {
    assert(stats.open > 0, "进阶含副露");
    assertEq(stats.kan, 0, "进阶没有杠");
  }
  if (level === "advanced") {
    assert(stats.kan > 0, "综合含杠");
    assert(stats.chiitoi > 0, "综合含七对子");
  }
});

const ambiguous = Fu.allDecompositions(["m1", "m1", "m1", "m2", "m2", "m2", "m3", "m3", "m3", "p5", "p5"]);
assert(ambiguous.length >= 2, "111222333 应有多种拆法，出题要避开");

assertEq(Fu.nextDora("m9"), "m1", "九万的宝牌是一万");
assertEq(Fu.nextDora("p4"), "p5", "四筒的宝牌是五筒");
assertEq(Fu.nextDora("z4"), "z1", "北的宝牌是东");
assertEq(Fu.nextDora("z7"), "z5", "中的宝牌是白");

const scores = Fu.scoreExamples();
assertEq(scores.length, 9, "得点例题数量");
const expectScore = [
  { han: 1, fu: 30, total: 1000, limit: "" },
  { han: 1, fu: 30, total: 1500, limit: "" },
  { han: 2, fu: 20, total: 1500, limit: "" },
  { han: 4, fu: 30, total: 8700, limit: "" },
  { han: 5, fu: 30, total: 8000, limit: "满贯" },
  { han: 3, fu: 30, total: 4900, limit: "" },
  { han: 4, fu: 40, total: 9000, limit: "满贯" },
  { han: 1, fu: 30, total: 1300, limit: "" },
  { han: 13, fu: null, total: 32000, limit: "役满" },
];
scores.forEach((problem, index) => {
  const score = problem.score;
  const expect = expectScore[index];
  assertEq(score.han, expect.han, problem.title + " 番");
  assertEq(score.fu, expect.fu, problem.title + " 符");
  assertEq(score.total, expect.total, problem.title + " 得点");
  assertEq(score.limit, expect.limit, problem.title + " 满贯线");
});
assertEq(scores[0].score.uraHan, 0, "未立直不计里宝牌");
assertEq(scores[2].score.payments[0].amount, 400, "平和自摸子家付 400");
assertEq(scores[2].score.payments[1].amount, 700, "平和自摸亲家付 700");
assertEq(scores[4].score.doraHan, 2, "两张五筒都是表宝牌");
assertEq(scores[4].score.akaHan, 1, "红五筒另加一番");
assertEq(scores[5].score.uraHan, 1, "立直计入里宝牌");
assertEq(scores[8].score.doraHan, 0, "役满不加表宝牌");
assertEq(Fu.evaluateScoreGuess(scores[0].score, 30, 1, 1000).correct, true, "例题得点答对");
assertEq(Fu.evaluateScoreGuess(scores[0].score, 20, 1, 1000).correct, false, "符数也要自己算");
assert(Fu.evaluateScoreGuess(scores[4].score, 30, 2, 8000).hints[0].indexOf("红宝牌") >= 0, "漏算宝牌有提示");
assert(Fu.evaluateScoreGuess(scores[7].score, 30, 1, 1000).hints[0].indexOf("本场") >= 0, "漏算本场有提示");
assertEq(scores[2].score.tsumoPays.child, 400, "子家自摸时子家各付 400");
assertEq(scores[2].score.tsumoPays.dealer, 700, "子家自摸时亲家付 700");
assertEq(Fu.evaluateScoreGuess(scores[2].score, 20, 2, 1500, scores[2].answer, 400, 700).correct, true, "自摸支付也要填对");
assert(Fu.evaluateScoreGuess(scores[2].score, 20, 2, 1500, scores[2].answer, 300, 700).hints[0].indexOf("子家各付") >= 0, "自摸支付填错有提示");

function scoreStats(level, count) {
  let fallback = 0;
  let riichi = 0;
  let uraWhenOpen = 0;
  let aka = 0;
  for (let i = 0; i < count; i++) {
    const problem = Fu.createScoreProblem(level);
    if (problem.fallback) fallback += 1;
    const score = problem.score;
    assert(score.han >= 1, level + " 至少一番");
    assertEq(score.total, score.handPoints + score.honbaPoints + score.stickPoints, "得点构成");
    if (!problem.riichi && !problem.daburu) {
      assertEq((problem.uraIndicators || []).length, 0, "未立直没有里宝牌指示牌");
      assertEq(score.uraHan, 0, "未立直里宝牌番数为 0");
    } else {
      riichi += 1;
      assertEq(problem.uraIndicators.length, problem.doraIndicators.length, "里宝牌张数与表宝牌一致");
    }
    if ((problem.openMelds || []).length && (problem.uraIndicators || []).length) uraWhenOpen += 1;
    const akaCount = (problem.aka.m5 || 0) + (problem.aka.p5 || 0) + (problem.aka.s5 || 0);
    if (akaCount) aka += 1;
    ["m5", "p5", "s5"].forEach((id) => {
      assert((problem.aka[id] || 0) <= 1, "每种红宝牌最多一张");
    });
    const kanCount = problem.ankans.length + problem.openMelds.filter((meld) => meld.type === "kan").length;
    assertEq(problem.doraIndicators.length, 1 + kanCount, "杠了要加杠宝牌指示牌");
  }
  return { fallback: fallback, riichi: riichi, uraWhenOpen: uraWhenOpen, aka: aka };
}

["beginner", "intermediate", "advanced"].forEach((level) => {
  const stats = scoreStats(level, 40);
  console.log("score", level, JSON.stringify(stats));
  assertEq(stats.fallback, 0, level + " 得点出题没有回退");
  assertEq(stats.uraWhenOpen, 0, "副露不计里宝牌");
});

if (failed) {
  console.error(failed + " failed");
  process.exit(1);
}
console.log("all passed");
