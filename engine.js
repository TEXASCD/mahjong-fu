/**
 * 立直麻将符数练习器 · 出题与计符
 * 规则：日本立直。符数个位向上进位；20（平和自摸等）与 25（七对子）不进位。
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.MahjongFu = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const WIND_NAME = { E: "东", S: "南", W: "西", N: "北" };
  const WIND_TILE = { E: "z1", S: "z2", W: "z3", N: "z4" };
  const WAIT_NAME = {
    ryanmen: "两面听",
    shanpon: "双碰听",
    penchan: "边张听",
    kanchan: "嵌张听",
    tanki: "单骑听",
  };
  const WAIT_FU = { ryanmen: 0, shanpon: 0, penchan: 2, kanchan: 2, tanki: 2 };
  const LEVELS = {
    beginner: { label: "入门", blurb: "门清。刻子、听牌、役牌雀头、平和与进位。" },
    intermediate: { label: "进阶", blurb: "加上吃、碰和副露之后的符。" },
    advanced: { label: "综合", blurb: "明杠、暗杠、七对子，以及连风。" },
  };

  function tileLabel(id) {
    const suit = id[0];
    const n = Number(id.slice(1));
    if (suit === "z") return "东南西北白发中"[n - 1];
    const num = "一二三四五六七八九"[n - 1];
    if (suit === "m") return num + "万";
    if (suit === "p") return num + "筒";
    return num + "条";
  }

  function tileSortKey(id) {
    const suitOrder = { m: 0, p: 1, s: 2, z: 3 };
    return suitOrder[id[0]] * 10 + Number(id.slice(1));
  }

  function compareTiles(a, b) {
    return tileSortKey(a) - tileSortKey(b);
  }

  function isYaochu(tile) {
    if (tile[0] === "z") return true;
    const r = Number(tile.slice(1));
    return r === 1 || r === 9;
  }

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = a[i];
      a[i] = a[j];
      a[j] = tmp;
    }
    return a;
  }

  function fullPool() {
    const pool = {};
    for (const suit of ["m", "p", "s"]) {
      for (let r = 1; r <= 9; r++) pool[suit + r] = 4;
    }
    for (let r = 1; r <= 7; r++) pool["z" + r] = 4;
    return pool;
  }

  function emptyUsed() {
    return { m: new Set(), p: new Set(), s: new Set() };
  }

  function canPlace(used, rank) {
    for (const u of used) {
      if (Math.abs(u - rank) < 3) return false;
    }
    return true;
  }

  function sequenceWait(tiles, win) {
    const suit = tiles[0][0];
    const ranks = tiles.map((t) => Number(t.slice(1))).sort((a, b) => a - b);
    const w = Number(win.slice(1));
    if (win[0] !== suit || ranks.indexOf(w) < 0) {
      throw new Error("和牌张不在这个顺子里");
    }
    const low = ranks[0];
    const mid = ranks[1];
    const high = ranks[2];
    if (w === mid) return "kanchan";
    if (w === low) return low === 7 ? "penchan" : "ryanmen";
    if (w === high) return low === 1 ? "penchan" : "ryanmen";
    throw new Error("无法判断听牌");
  }

  function pairInfo(tile, roundWind, seatWind) {
    if (!tile || tile[0] !== "z") {
      return { fu: 0, reason: "数牌", short: "数牌" };
    }
    const n = Number(tile.slice(1));
    if (n >= 5) return { fu: 2, reason: "役牌（三元）", short: "三元牌" };
    const wind = ["", "E", "S", "W", "N"][n];
    const isRound = wind === roundWind;
    const isSeat = wind === seatWind;
    if (isRound && isSeat) return { fu: 4, reason: "连风（场风与自风相同）", short: "连风" };
    if (isRound) return { fu: 2, reason: "场风", short: "场风" };
    if (isSeat) return { fu: 2, reason: "自风", short: "自风" };
    return { fu: 0, reason: "客风", short: "客风" };
  }

  function meldScore(meld) {
    if (meld.type === "sequence") {
      const names = meld.tiles.map(tileLabel).join("");
      return { fu: 0, kind: meld.open ? "吃" : "顺子", label: (meld.open ? "吃 " : "顺子 ") + names };
    }
    const yao = isYaochu(meld.tile);
    const yaoName = yao ? "幺九" : "中张";
    let fu = 0;
    let kind = "";
    if (meld.type === "triplet") {
      if (meld.open) {
        fu = yao ? 4 : 2;
        kind = "明刻";
      } else {
        fu = yao ? 8 : 4;
        kind = "暗刻";
      }
    } else if (meld.type === "kan") {
      if (meld.open) {
        fu = yao ? 16 : 8;
        kind = "明杠";
      } else {
        fu = yao ? 32 : 16;
        kind = "暗杠";
      }
    }
    return {
      fu: fu,
      kind: kind,
      label: kind + " " + tileLabel(meld.tile) + "（" + yaoName + "）",
    };
  }

  function expandTiles(meld) {
    if (meld.type === "sequence") return meld.tiles.slice();
    const n = meld.type === "kan" ? 4 : 3;
    const tiles = [];
    for (let i = 0; i < n; i++) tiles.push(meld.tile);
    return tiles;
  }

  function scoreHand(input) {
    const openMelds = input.openMelds || [];
    const closedMelds = input.closedMelds || [];
    const ankans = input.ankans || [];
    const isTsumo = !!input.isTsumo;
    const isChiitoi = !!input.isChiitoi;
    const roundWind = input.roundWind;
    const seatWind = input.seatWind;
    const wait = input.wait;
    const pair = input.pair;
    const winTile = input.winTile;

    if (isChiitoi) {
      const pairs = input.pairs.slice().sort(compareTiles);
      const groups = pairs.map((tile) => ({
        kind: "pair",
        label: "对子",
        tiles: [tile, tile],
        fu: 0,
        containsWin: tile === winTile,
      }));
      return {
        fu: 25,
        raw: 25,
        isPinfu: false,
        isChiitoi: true,
        menzen: true,
        wait: "tanki",
        waitName: "七对子",
        special: "chiitoi",
        items: [
          { label: "七对子", fu: 25, keep: true },
        ],
        groups: groups,
        notes: [
          "七对子固定 25 符，不进成 30。",
          "必须门清。对子里即使有役牌，也不再另加雀头符。",
        ],
        equation: "七对子 = 25 符",
      };
    }

    const menzen = openMelds.length === 0;
    const allMelds = openMelds.concat(closedMelds, ankans);
    const allSequences = allMelds.length === 4 && allMelds.every((m) => m.type === "sequence");
    const head = pairInfo(pair, roundWind, seatWind);
    const waitFu = WAIT_FU[wait];
    const items = [{ label: "副底", fu: 20, keep: true }];
    let raw = 20;

    if (menzen && !isTsumo) {
      items.push({ label: "门前清荣和", fu: 10, keep: true });
      raw += 10;
    } else if (isTsumo) {
      items.push({ label: "自摸", fu: 2, keep: true });
      raw += 2;
    } else {
      items.push({ label: "副露荣和", fu: 0, keep: true });
    }

    const groups = [];
    function pushMeld(meld, zone) {
      const scored = meldScore(meld);
      const tiles = expandTiles(meld);
      if (scored.fu > 0) {
        items.push({ label: scored.label, fu: scored.fu });
        raw += scored.fu;
      }
      groups.push({
        kind: meld.type,
        zone: zone,
        label: scored.kind,
        detail: scored.label,
        tiles: tiles,
        fu: scored.fu,
        containsWin: tiles.indexOf(winTile) >= 0 && zone === "closed",
      });
    }

    openMelds.forEach((m) => pushMeld(m, "open"));
    ankans.forEach((m) => pushMeld(m, "ankan"));
    closedMelds.forEach((m) => pushMeld(m, "closed"));

    const pairLabel = "雀头 " + tileLabel(pair) + "（" + head.short + "）";
    items.push({ label: pairLabel, fu: head.fu, keep: true });
    raw += head.fu;
    groups.push({
      kind: "pair",
      zone: "closed",
      label: "雀头",
      detail: pairLabel,
      tiles: [pair, pair],
      fu: head.fu,
      containsWin: pair === winTile,
    });

    const waitLabel = WAIT_NAME[wait];
    items.push({ label: waitLabel, fu: waitFu, keep: true });
    raw += waitFu;

    const isPinfu = menzen && allSequences && head.fu === 0 && wait === "ryanmen";
    let fu;
    let special = null;
    if (isPinfu && isTsumo) {
      fu = 20;
      special = "pinfu-tsumo";
    } else {
      fu = Math.ceil(raw / 10) * 10;
      if (isPinfu) special = "pinfu-ron";
    }

    const notes = [];
    if (special === "pinfu-tsumo") {
      notes.push("这是平和：门清、四个顺子、雀头不是役牌、两面听。");
      notes.push("平和自摸固定 20 符。若按普通算法是 22 符，再进成 30；这里两个都不做。");
    } else if (special === "pinfu-ron") {
      notes.push("这是平和荣和：副底 20，加上门前清荣和 10，一共 30 符。");
    }
    if (!isPinfu && menzen && isTsumo) {
      notes.push("门清自摸只加自摸的 2 符。门前清 10 符只在门清荣和时加上。");
    }
    if (!menzen && isTsumo) {
      notes.push("有副露，就没有门前清 10 符；自摸仍加 2 符。");
    }
    if (!menzen && !isTsumo) {
      notes.push("有副露的荣和：不加门前清 10 符，也不加自摸 2 符。");
    }
    if (wait === "shanpon") {
      notes.push("双碰听不加符。和牌张把一对做成刻子，但没有碰出去，这个刻子算暗刻。");
    } else if (wait === "tanki") {
      notes.push("单骑是听雀头那一张，加 2 符。");
    } else if (wait === "penchan") {
      notes.push("边张只有两种：12 听 3，89 听 7。加 2 符。");
    } else if (wait === "kanchan") {
      notes.push("嵌张是卡在中间的一张，例如 46 听 5。加 2 符。");
    } else if (wait === "ryanmen" && !isPinfu) {
      notes.push("两面听不加符。");
    }

    allMelds.forEach((meld) => {
      if (meld.type !== "sequence" || meld.tiles.indexOf(winTile) < 0) return;
      const ranks = meld.tiles.map((t) => Number(t.slice(1))).sort((a, b) => a - b);
      const w = Number(winTile.slice(1));
      if (wait === "ryanmen" && ranks[0] === 1 && ranks[2] === 3 && w === 1) {
        notes.push("23 听 1（另一面还能听 4）是两面，不是边张。");
      }
      if (wait === "ryanmen" && ranks[0] === 7 && ranks[2] === 9 && w === 9) {
        notes.push("78 听 9（另一面还能听 6）是两面，不是边张。");
      }
    });

    if (head.fu === 4) {
      notes.push("场风和自风是同一张风牌时，雀头记 4 符，不是 2+2。");
    } else if (head.fu === 2) {
      notes.push("役牌雀头加 2 符。三元牌永远是役牌；风牌只有场风和自风算。");
    } else if (head.short === "客风") {
      notes.push("客风雀头不加符。既不是场风也不是自风的风牌，没有雀头符。");
    }

    if (ankans.length && menzen) {
      notes.push("暗杠不算副露，这手仍然是门前清。");
    }
    if (!isPinfu && !menzen && allSequences && head.fu === 0 && wait === "ryanmen") {
      if (isTsumo) {
        notes.push("形状很像平和，但有副露就不是平和，不能按 20 符算。");
      } else {
        notes.push("有副露就不是平和。这手荣和只有副底 20 符。");
      }
    }
    if (special !== "pinfu-tsumo") {
      if (raw !== fu) notes.push("合计 " + raw + " 符，个位向上进位，是 " + fu + " 符。");
      else notes.push("合计 " + fu + " 符，已经是整十，不用进位。");
    }

    const nonzero = items.filter((item) => item.fu > 0).map((item) => String(item.fu));
    let equation = nonzero.join(" + ") + " = " + raw;
    if (special === "pinfu-tsumo") equation += "，平和自摸例外 → 20 符";
    else if (raw !== fu) equation += " → " + fu + " 符";
    else equation += " 符";

    return {
      fu: fu,
      raw: raw,
      isPinfu: isPinfu,
      isChiitoi: false,
      menzen: menzen,
      wait: wait,
      waitName: waitLabel,
      special: special,
      items: items,
      groups: groups,
      notes: notes,
      equation: equation,
      pairFu: head.fu,
    };
  }

  function allDecompositions(tiles) {
    if (tiles.length % 3 !== 2) return [];
    const counts = {};
    tiles.forEach((t) => {
      counts[t] = (counts[t] || 0) + 1;
    });
    const order = Object.keys(counts).sort(compareTiles);
    const out = [];
    const seen = new Set();

    function search(melds, onDone) {
      let first = null;
      for (let i = 0; i < order.length; i++) {
        if (counts[order[i]] > 0) {
          first = order[i];
          break;
        }
      }
      if (!first) {
        onDone(melds);
        return;
      }
      if (counts[first] >= 3) {
        counts[first] -= 3;
        melds.push({ type: "triplet", tile: first, tiles: [first, first, first], open: false });
        search(melds, onDone);
        melds.pop();
        counts[first] += 3;
      }
      if (first[0] !== "z") {
        const r = Number(first.slice(1));
        if (r <= 7) {
          const b = first[0] + (r + 1);
          const c = first[0] + (r + 2);
          if ((counts[b] || 0) >= 1 && (counts[c] || 0) >= 1) {
            counts[first] -= 1;
            counts[b] -= 1;
            counts[c] -= 1;
            melds.push({ type: "sequence", tiles: [first, b, c], open: false });
            search(melds, onDone);
            melds.pop();
            counts[first] += 1;
            counts[b] += 1;
            counts[c] += 1;
          }
        }
      }
    }

    order.forEach((pair) => {
      if ((counts[pair] || 0) < 2) return;
      counts[pair] -= 2;
      search([], (melds) => {
        const key =
          pair +
          "~" +
          melds
            .map((m) => m.type + ":" + (m.tiles || [m.tile]).join("."))
            .sort()
            .join("|");
        if (!seen.has(key)) {
          seen.add(key);
          out.push({
            pair: pair,
            melds: melds.map((m) => ({
              type: m.type,
              tile: m.tile,
              tiles: m.tiles.slice(),
              open: false,
            })),
          });
        }
      });
      counts[pair] += 2;
    });
    return out;
  }

  function waitsFor(decomp, winTile) {
    const waits = [];
    if (decomp.pair === winTile) waits.push("tanki");
    decomp.melds.forEach((meld) => {
      if (meld.type === "triplet" && meld.tile === winTile) waits.push("shanpon");
      if (meld.type === "sequence" && meld.tiles.indexOf(winTile) >= 0) {
        waits.push(sequenceWait(meld.tiles, winTile));
      }
    });
    return waits;
  }

  function concealedOf(closedMelds, pair) {
    const tiles = [];
    closedMelds.forEach((meld) => {
      expandTiles(meld).forEach((t) => tiles.push(t));
    });
    tiles.push(pair, pair);
    return tiles;
  }

  function countTiles(problem) {
    let n = problem.concealed.length;
    problem.openMelds.forEach((m) => {
      n += expandTiles(m).length;
    });
    problem.ankans.forEach((m) => {
      n += expandTiles(m).length;
    });
    return n;
  }

  function validate(problem) {
    const kanCount =
      problem.ankans.length + problem.openMelds.filter((m) => m.type === "kan").length;
    if (problem.isChiitoi) {
      if (problem.concealed.length !== 14) return "七对子应有 14 张";
      if (allDecompositions(problem.concealed).length !== 0) return "七对子同时能拆成四面子";
      const score = scoreHand(problem);
      if (score.fu !== 25) return "七对子符数不是 25";
      problem.answer = score;
      return "";
    }
    if (countTiles(problem) !== 14 + kanCount) return "牌张数量不对";
    if (problem.concealed.indexOf(problem.winTile) < 0) return "和牌张不在手牌里";
    const decomps = allDecompositions(problem.concealed);
    if (decomps.length !== 1) return "拆法不唯一（" + decomps.length + "）";
    const waits = waitsFor(decomps[0], problem.winTile);
    if (waits.length !== 1) return "听牌不唯一";
    if (waits[0] !== problem.wait) return "听牌与出题不一致：" + waits[0] + " / " + problem.wait;
    if (decomps[0].pair !== problem.pair) return "雀头与出题不一致";
    const score = scoreHand(problem);
    const itemSum = score.items.reduce((sum, item) => sum + item.fu, 0);
    if (itemSum !== score.raw) return "明细加总不等于合计";
    problem.answer = score;
    return "";
  }

  function assemble(parts) {
    const problem = {
      isChiitoi: !!parts.isChiitoi,
      isTsumo: !!parts.isTsumo,
      roundWind: parts.roundWind,
      seatWind: parts.seatWind,
      winTile: parts.winTile,
      openMelds: parts.openMelds || [],
      ankans: parts.ankans || [],
      closedMelds: parts.closedMelds || [],
      pair: parts.pair || null,
      pairs: parts.pairs || null,
      wait: parts.wait || null,
      level: parts.level || "beginner",
      title: parts.title || "",
      teach: parts.teach || "",
      concealed: parts.concealed || null,
    };
    if (!problem.isChiitoi) {
      problem.concealed = concealedOf(problem.closedMelds, problem.pair);
    }
    const err = validate(problem);
    if (err) {
      const error = new Error((parts.title || "随机牌") + "：" + err);
      error.problem = problem;
      throw error;
    }
    if (!problem.title) {
      if (problem.answer.isChiitoi) problem.title = "七对子";
      else if (problem.answer.isPinfu) problem.title = problem.isTsumo ? "平和自摸" : "平和荣和";
      else problem.title = problem.isTsumo ? "自摸和牌" : "荣和";
    }
    return problem;
  }

  function placeSequence(pool, used) {
    const suits = shuffle(["m", "p", "s"]);
    for (let s = 0; s < suits.length; s++) {
      const suit = suits[s];
      const starts = shuffle([1, 2, 3, 4, 5, 6, 7]);
      for (let i = 0; i < starts.length; i++) {
        const start = starts[i];
        const ranks = [start, start + 1, start + 2];
        let ok = true;
        for (let k = 0; k < ranks.length; k++) {
          if (!canPlace(used[suit], ranks[k])) ok = false;
        }
        if (!ok) continue;
        const tiles = ranks.map((r) => suit + r);
        if (!tiles.every((t) => pool[t] >= 1)) continue;
        tiles.forEach((t) => {
          pool[t] -= 1;
        });
        ranks.forEach((r) => used[suit].add(r));
        return { type: "sequence", tiles: tiles, open: false };
      }
    }
    return null;
  }

  function placeSet(pool, used, asKan) {
    const need = asKan ? 4 : 3;
    const candidates = [];
    ["m", "p", "s"].forEach((suit) => {
      for (let r = 1; r <= 9; r++) {
        const id = suit + r;
        if (pool[id] < need) continue;
        if (!canPlace(used[suit], r)) continue;
        candidates.push({ id: id, suit: suit, rank: r });
      }
    });
    for (let r = 1; r <= 7; r++) {
      const id = "z" + r;
      if (pool[id] >= need) candidates.push({ id: id, suit: null, rank: null });
    }
    if (!candidates.length) return null;
    const chosen = pick(candidates);
    pool[chosen.id] -= need;
    if (chosen.suit) used[chosen.suit].add(chosen.rank);
    return {
      type: asKan ? "kan" : "triplet",
      tile: chosen.id,
      open: false,
    };
  }

  function placePair(pool, used, winds, mode, forceTile) {
    if (forceTile) {
      if ((pool[forceTile] || 0) < 2) return null;
      if (forceTile[0] !== "z" && !canPlace(used[forceTile[0]], Number(forceTile.slice(1)))) return null;
      pool[forceTile] -= 2;
      if (forceTile[0] !== "z") used[forceTile[0]].add(Number(forceTile.slice(1)));
      return forceTile;
    }
    const candidates = [];
    ["m", "p", "s"].forEach((suit) => {
      for (let r = 1; r <= 9; r++) {
        const id = suit + r;
        if (pool[id] < 2) continue;
        if (!canPlace(used[suit], r)) continue;
        candidates.push(id);
      }
    });
    for (let r = 1; r <= 7; r++) {
      const id = "z" + r;
      if (pool[id] >= 2) candidates.push(id);
    }
    let list = candidates;
    if (mode === "yakuhai") {
      list = candidates.filter((id) => pairInfo(id, winds.roundWind, winds.seatWind).fu > 0);
    } else if (mode === "non") {
      list = candidates.filter((id) => pairInfo(id, winds.roundWind, winds.seatWind).fu === 0);
    }
    if (!list.length) return null;
    const id = pick(list);
    pool[id] -= 2;
    if (id[0] !== "z") used[id[0]].add(Number(id.slice(1)));
    return id;
  }

  function randomWinds() {
    return {
      roundWind: pick(["E", "S"]),
      seatWind: pick(["E", "S", "W", "N"]),
    };
  }

  function chooseWin(closedMelds, pair) {
    const options = [];
    closedMelds.forEach((meld) => {
      if (meld.type === "sequence") {
        meld.tiles.forEach((tile) => {
          options.push({ winTile: tile, wait: sequenceWait(meld.tiles, tile) });
        });
      } else if (meld.type === "triplet") {
        options.push({ winTile: meld.tile, wait: "shanpon" });
      }
    });
    options.push({ winTile: pair, wait: "tanki" });
    const groups = {};
    options.forEach((opt) => {
      if (!groups[opt.wait]) groups[opt.wait] = [];
      groups[opt.wait].push(opt);
    });
    const bucket = groups[pick(Object.keys(groups))];
    return pick(bucket);
  }

  function planKinds(level) {
    if (level === "beginner") {
      const nTri = pick([1, 1, 2, 2, 3]);
      const kinds = [];
      for (let i = 0; i < nTri; i++) kinds.push("tri");
      while (kinds.length < 4) kinds.push("seq");
      return kinds;
    }
    if (level === "intermediate") {
      const kinds = [];
      const nOpen = Math.random() < 0.82 ? pick([1, 1, 2]) : 0;
      for (let i = 0; i < nOpen; i++) kinds.push(Math.random() < 0.55 ? "chi" : "pon");
      const nTri = pick([0, 1, 1, 2]);
      for (let i = 0; i < nTri && kinds.length < 4; i++) kinds.push("tri");
      while (kinds.length < 4) kinds.push("seq");
      return kinds;
    }
    const kinds = [];
    if (Math.random() < 0.62) kinds.push(Math.random() < 0.55 ? "ankan" : "minkan");
    const nOpen = Math.random() < 0.7 ? pick([0, 1, 1, 2]) : 0;
    for (let i = 0; i < nOpen && kinds.length < 3; i++) kinds.push(Math.random() < 0.5 ? "chi" : "pon");
    const nTri = pick([0, 1, 1, 2]);
    for (let i = 0; i < nTri && kinds.length < 4; i++) kinds.push("tri");
    while (kinds.length < 4) kinds.push("seq");
    return kinds.slice(0, 4);
  }

  function attemptStandard(level, wantPinfu) {
    const pool = fullPool();
    const used = emptyUsed();
    let winds = randomWinds();
    const openMelds = [];
    const closedMelds = [];
    const ankans = [];

    if (wantPinfu) {
      for (let i = 0; i < 4; i++) {
        const seq = placeSequence(pool, used);
        if (!seq) return null;
        closedMelds.push(seq);
      }
      const pair = placePair(pool, used, winds, "non", null);
      if (!pair) return null;
      const ryanmen = [];
      closedMelds.forEach((meld) => {
        meld.tiles.forEach((tile) => {
          if (sequenceWait(meld.tiles, tile) === "ryanmen") ryanmen.push(tile);
        });
      });
      if (!ryanmen.length) return null;
      return {
        intentionalPinfu: true,
        openMelds: openMelds,
        closedMelds: closedMelds,
        ankans: ankans,
        pair: pair,
        winTile: pick(ryanmen),
        wait: "ryanmen",
        isTsumo: Math.random() < 0.5,
        roundWind: winds.roundWind,
        seatWind: winds.seatWind,
        level: level,
      };
    }

    const kinds = shuffle(planKinds(level));
    for (let i = 0; i < kinds.length; i++) {
      const kind = kinds[i];
      let meld = null;
      if (kind === "seq" || kind === "chi") meld = placeSequence(pool, used);
      else if (kind === "tri" || kind === "pon") meld = placeSet(pool, used, false);
      else meld = placeSet(pool, used, true);
      if (!meld) return null;
      if (kind === "chi" || kind === "pon" || kind === "minkan") {
        meld.open = true;
        openMelds.push(meld);
      } else if (kind === "ankan") {
        meld.open = false;
        ankans.push(meld);
      } else {
        meld.open = false;
        closedMelds.push(meld);
      }
    }

    let pairMode = Math.random() < 0.55 ? "yakuhai" : "non";
    let forceTile = null;
    if (pairMode === "yakuhai" && level !== "beginner" && Math.random() < 0.45) {
      winds = { roundWind: pick(["E", "S"]), seatWind: pick(["E", "S"]) };
      winds.seatWind = winds.roundWind;
      forceTile = WIND_TILE[winds.roundWind];
    } else if (pairMode === "yakuhai" && Math.random() < 0.3) {
      winds.seatWind = winds.roundWind;
    }

    const pair = placePair(pool, used, winds, forceTile ? "any" : pairMode, forceTile);
    if (!pair) return null;
    if (!closedMelds.length) {
      return {
        intentionalPinfu: false,
        openMelds: openMelds,
        closedMelds: closedMelds,
        ankans: ankans,
        pair: pair,
        winTile: pair,
        wait: "tanki",
        isTsumo: Math.random() < 0.5,
        roundWind: winds.roundWind,
        seatWind: winds.seatWind,
        level: level,
      };
    }
    const win = chooseWin(closedMelds, pair);
    return {
      intentionalPinfu: false,
      openMelds: openMelds,
      closedMelds: closedMelds,
      ankans: ankans,
      pair: pair,
      winTile: win.winTile,
      wait: win.wait,
      isTsumo: Math.random() < 0.5,
      roundWind: winds.roundWind,
      seatWind: winds.seatWind,
      level: level,
    };
  }

  function attemptChiitoi(level) {
    const bag = [];
    ["m", "p", "s"].forEach((suit) => {
      [1, 3, 5, 7, 9].forEach((r) => bag.push(suit + r));
    });
    for (let r = 1; r <= 7; r++) bag.push("z" + r);
    const chosen = shuffle(bag).slice(0, 7);
    const winds = randomWinds();
    const concealed = [];
    chosen.forEach((id) => {
      concealed.push(id, id);
    });
    return {
      isChiitoi: true,
      pairs: chosen,
      concealed: concealed,
      openMelds: [],
      ankans: [],
      closedMelds: [],
      winTile: pick(chosen),
      isTsumo: Math.random() < 0.5,
      roundWind: winds.roundWind,
      seatWind: winds.seatWind,
      level: level,
      title: "七对子",
      teach: "七对子固定 25 符，不要进成 30。",
    };
  }

  function createProblem(level) {
    if (!LEVELS[level]) throw new Error("未知难度");
    const pinfuRate = level === "beginner" ? 0.22 : level === "intermediate" ? 0.08 : 0.06;
    const chiitoiRate = level === "advanced" ? 0.14 : 0;
    for (let i = 0; i < 500; i++) {
      try {
        let parts = null;
        if (Math.random() < chiitoiRate) parts = attemptChiitoi(level);
        else parts = attemptStandard(level, Math.random() < pinfuRate);
        if (!parts) continue;
        const problem = assemble(parts);
        if (problem.answer.isPinfu && !parts.intentionalPinfu) continue;
        if (!listYaku(problem).length) continue;
        return problem;
      } catch (err) {
        continue;
      }
    }
    const fallback = exampleProblems()[0];
    fallback.level = level;
    fallback.fallback = true;
    return fallback;
  }

  function seq(tiles) {
    return { type: "sequence", tiles: tiles.slice(), open: false };
  }
  function tri(tile, open) {
    return { type: "triplet", tile: tile, open: !!open };
  }
  function kan(tile, open) {
    return { type: "kan", tile: tile, open: !!open };
  }

  function exampleProblems() {
    const specs = [
      {
        title: "平和 · 荣和",
        teach: "门清四顺、非役牌雀头、两面听。荣和是 30 符。",
        level: "beginner",
        roundWind: "E",
        seatWind: "S",
        isTsumo: false,
        closedMelds: [seq(["m1", "m2", "m3"]), seq(["m6", "m7", "m8"]), seq(["p1", "p2", "p3"]), seq(["s6", "s7", "s8"])],
        pair: "p9",
        winTile: "m1",
        wait: "ryanmen",
      },
      {
        title: "平和 · 自摸",
        teach: "同样是平和，自摸固定 20 符，不要写成 22 或 30。",
        level: "beginner",
        roundWind: "E",
        seatWind: "W",
        isTsumo: true,
        closedMelds: [seq(["s1", "s2", "s3"]), seq(["s7", "s8", "s9"]), seq(["p1", "p2", "p3"]), seq(["m7", "m8", "m9"])],
        pair: "p9",
        winTile: "m9",
        wait: "ryanmen",
      },
      {
        title: "单骑 · 进位",
        teach: "门清荣和 10 符，单骑再加 2 符。32 要进成 40。客风不加符。",
        level: "beginner",
        roundWind: "E",
        seatWind: "S",
        isTsumo: false,
        closedMelds: [seq(["m1", "m2", "m3"]), seq(["m6", "m7", "m8"]), seq(["p1", "p2", "p3"]), seq(["s6", "s7", "s8"])],
        pair: "z3",
        winTile: "z3",
        wait: "tanki",
      },
      {
        title: "嵌张 · 三元雀头",
        teach: "嵌张 2 符，白雀头 2 符。34 进成 40。因为不是两面，所以不是平和。",
        level: "beginner",
        roundWind: "S",
        seatWind: "N",
        isTsumo: false,
        closedMelds: [seq(["m1", "m2", "m3"]), seq(["m6", "m7", "m8"]), seq(["p1", "p2", "p3"]), seq(["s6", "s7", "s8"])],
        pair: "z5",
        winTile: "m2",
        wait: "kanchan",
      },
      {
        title: "副露荣和 · 20 符",
        teach: "吃过牌就不是平和，也没有门前清 10 符。两面、非役牌雀头时只剩副底 20。",
        level: "intermediate",
        roundWind: "E",
        seatWind: "S",
        isTsumo: false,
        openMelds: [Object.assign(seq(["m1", "m2", "m3"]), { open: true })],
        closedMelds: [seq(["m6", "m7", "m8"]), seq(["p1", "p2", "p3"]), seq(["s7", "s8", "s9"])],
        pair: "p9",
        winTile: "m6",
        wait: "ryanmen",
      },
      {
        title: "副露自摸 · 进位",
        teach: "和上一手相同的形状改成自摸：20+2=22，进成 30。不是平和。",
        level: "intermediate",
        roundWind: "E",
        seatWind: "S",
        isTsumo: true,
        openMelds: [Object.assign(seq(["m1", "m2", "m3"]), { open: true })],
        closedMelds: [seq(["m6", "m7", "m8"]), seq(["p1", "p2", "p3"]), seq(["s7", "s8", "s9"])],
        pair: "p9",
        winTile: "m6",
        wait: "ryanmen",
      },
      {
        title: "中张暗刻 · 自摸",
        teach: "中张暗刻 4 符，自摸 2 符。26 进成 30。",
        level: "beginner",
        roundWind: "E",
        seatWind: "N",
        isTsumo: true,
        closedMelds: [tri("p2", false), seq(["m6", "m7", "m8"]), seq(["s6", "s7", "s8"]), seq(["p7", "p8", "p9"])],
        pair: "s1",
        winTile: "p9",
        wait: "ryanmen",
      },
      {
        title: "幺九明刻 · 边张",
        teach: "幺九明刻 4 符，边张 2 符。有碰，荣和不加 10。26 进成 30。",
        level: "intermediate",
        roundWind: "E",
        seatWind: "S",
        isTsumo: false,
        openMelds: [tri("m9", true)],
        closedMelds: [seq(["p1", "p2", "p3"]), seq(["s6", "s7", "s8"]), seq(["m1", "m2", "m3"])],
        pair: "z4",
        winTile: "p3",
        wait: "penchan",
      },
      {
        title: "连风雀头",
        teach: "南场南家，南雀头是 4 符。34 进成 40。",
        level: "intermediate",
        roundWind: "S",
        seatWind: "S",
        isTsumo: false,
        closedMelds: [seq(["m1", "m2", "m3"]), seq(["m6", "m7", "m8"]), seq(["p1", "p2", "p3"]), seq(["s6", "s7", "s8"])],
        pair: "z2",
        winTile: "m8",
        wait: "ryanmen",
      },
      {
        title: "发的暗杠",
        teach: "字牌暗杠 32 符，而且暗杠仍算门清，荣和还有 10 符。62 进成 70。",
        level: "advanced",
        roundWind: "E",
        seatWind: "W",
        isTsumo: false,
        ankans: [kan("z6", false)],
        closedMelds: [seq(["m1", "m2", "m3"]), seq(["m6", "m7", "m8"]), seq(["p1", "p2", "p3"])],
        pair: "p9",
        winTile: "m1",
        wait: "ryanmen",
      },
      {
        title: "九条明杠",
        teach: "幺九明杠 16 符。明杠破坏门清，荣和没有 10 符。36 进成 40。",
        level: "advanced",
        roundWind: "E",
        seatWind: "N",
        isTsumo: false,
        openMelds: [kan("s9", true)],
        closedMelds: [seq(["m1", "m2", "m3"]), seq(["m6", "m7", "m8"]), seq(["p1", "p2", "p3"])],
        pair: "p5",
        winTile: "m6",
        wait: "ryanmen",
      },
      {
        title: "双碰 · 幺九暗刻",
        teach: "双碰听是 0 符，但这张东仍按暗刻 8 符计。38 进成 40。",
        level: "beginner",
        roundWind: "S",
        seatWind: "W",
        isTsumo: false,
        closedMelds: [tri("z1", false), seq(["m1", "m2", "m3"]), seq(["p6", "p7", "p8"]), seq(["s1", "s2", "s3"])],
        pair: "s9",
        winTile: "z1",
        wait: "shanpon",
      },
      {
        title: "七对子",
        teach: "七对子固定 25 符。",
        level: "advanced",
        isChiitoi: true,
        pairs: ["m1", "m5", "m9", "p3", "s7", "z2", "z7"],
        concealed: ["m1", "m1", "m5", "m5", "m9", "m9", "p3", "p3", "s7", "s7", "z2", "z2", "z7", "z7"],
        winTile: "p3",
        isTsumo: true,
        roundWind: "E",
        seatWind: "S",
      },
    ];
    return specs.map((spec) => assemble(spec));
  }

  function layoutHand(concealed, winTile) {
    const sorted = concealed.slice().sort(compareTiles);
    const hand = [];
    let removed = false;
    sorted.forEach((tile) => {
      if (!removed && tile === winTile) {
        removed = true;
        return;
      }
      hand.push(tile);
    });
    if (!removed) throw new Error("和牌张不在手牌中");
    return { hand: hand, win: winTile };
  }

  function evaluateGuess(answer, guess) {
    if (guess === answer.fu) return { correct: true, hints: [] };
    const hints = [];
    if (answer.special === "pinfu-tsumo" && (guess === 22 || guess === 30 || guess === answer.raw)) {
      hints.push("平和自摸固定是 20 符。不要按 22 进成 30。");
    } else if (answer.special === "chiitoi" && (guess === 30 || guess === 20)) {
      hints.push("七对子是 25 符，不会进成 30，也不是副底 20。");
    } else if (guess === answer.raw && guess !== answer.fu) {
      hints.push(answer.raw + " 是进位前的合计。个位要向上进到十位，所以是 " + answer.fu + "。");
    }
    return { correct: false, hints: hints };
  }

  function handTileList(problem) {
    if (problem.isKokushi || problem.isChiitoi) return (problem.concealed || []).slice();
    const tiles = [];
    (problem.openMelds || []).forEach((meld) => {
      expandTiles(meld).forEach((tile) => tiles.push(tile));
    });
    (problem.ankans || []).forEach((meld) => {
      expandTiles(meld).forEach((tile) => tiles.push(tile));
    });
    (problem.concealed || []).forEach((tile) => tiles.push(tile));
    return tiles;
  }

  function nextDora(id) {
    const suit = id[0];
    const n = Number(id.slice(1));
    if (suit === "z") {
      if (n <= 4) return "z" + (n === 4 ? 1 : n + 1);
      return "z" + (n === 7 ? 5 : n + 1);
    }
    return suit + (n === 9 ? 1 : n + 1);
  }

  function isSimpleTile(id) {
    return id[0] !== "z" && Number(id.slice(1)) >= 2 && Number(id.slice(1)) <= 8;
  }

  function isTerminalTile(id) {
    return id[0] !== "z" && (id.slice(1) === "1" || id.slice(1) === "9");
  }

  function isHonorTile(id) {
    return id[0] === "z";
  }

  function isTerminalOrHonorTile(id) {
    return isTerminalTile(id) || isHonorTile(id);
  }

  function countById(tiles) {
    const counts = {};
    tiles.forEach((tile) => {
      counts[tile] = (counts[tile] || 0) + 1;
    });
    return counts;
  }

  function ceil100(value) {
    return Math.ceil(value / 100) * 100;
  }

  function sequenceKey(meld) {
    const ranks = meld.tiles.map((tile) => Number(tile.slice(1))).sort((a, b) => a - b);
    return ranks.join("");
  }

  function listYaku(problem) {
    if (problem.isKokushi) {
      const counts = countById(problem.concealed);
      const thirteen = Object.keys(counts).length === 13 && problem.winTile && counts[problem.winTile] === 2;
      if (thirteen) return [{ name: "国士无双十三面", han: 26, yakuman: 2 }];
      return [{ name: "国士无双", han: 13, yakuman: 1 }];
    }

    const menzen = (problem.openMelds || []).length === 0;
    const openMelds = problem.openMelds || [];
    const closedMelds = problem.closedMelds || [];
    const ankans = problem.ankans || [];
    const all = openMelds.concat(closedMelds, ankans);
    const tiles = handTileList(problem);
    const yakuman = [];

    function pushYakuman(name, mul) {
      yakuman.push({ name: name, han: 13 * mul, yakuman: mul });
    }

    if (!problem.isChiitoi && all.length === 4) {
      const kans = all.filter((meld) => meld.type === "kan");
      if (kans.length === 4) pushYakuman("四杠子", 1);

      const closedTriples = closedMelds.filter((meld) => meld.type === "triplet").concat(ankans);
      const suuankou = menzen && closedTriples.length === 4 && (problem.isTsumo || problem.wait === "tanki");
      if (suuankou) pushYakuman(problem.wait === "tanki" ? "四暗刻单骑" : "四暗刻", problem.wait === "tanki" ? 2 : 1);

      const dragonSets = all.filter((meld) => meld.type !== "sequence" && meld.tile && meld.tile[0] === "z" && Number(meld.tile.slice(1)) >= 5);
      if (dragonSets.length === 3) pushYakuman("大三元", 1);

      const windSets = all.filter((meld) => meld.type !== "sequence" && meld.tile && meld.tile[0] === "z" && Number(meld.tile.slice(1)) <= 4);
      if (windSets.length === 4) pushYakuman("大四喜", 2);
      else if (windSets.length === 3 && problem.pair && problem.pair[0] === "z" && Number(problem.pair.slice(1)) <= 4) {
        const used = {};
        windSets.forEach((meld) => {
          used[meld.tile] = true;
        });
        if (!used[problem.pair]) pushYakuman("小四喜", 1);
      }

      const suits = {};
      let honorOnly = tiles.length > 0;
      let terminalOnly = tiles.length > 0;
      let greenOnly = tiles.length > 0;
      tiles.forEach((tile) => {
        if (tile[0] === "z") {
          terminalOnly = false;
          if (tile !== "z6") greenOnly = false;
        } else {
          honorOnly = false;
          suits[tile[0]] = true;
          const rank = Number(tile.slice(1));
          if (rank !== 1 && rank !== 9) terminalOnly = false;
          const green = tile[0] === "s" && (rank === 2 || rank === 3 || rank === 4 || rank === 6 || rank === 8);
          if (!green) greenOnly = false;
        }
      });
      if (honorOnly) pushYakuman("字一色", 1);
      if (terminalOnly) pushYakuman("清老头", 1);
      if (greenOnly && !honorOnly) pushYakuman("绿一色", 1);

      const numberSuits = Object.keys(suits);
      if (menzen && numberSuits.length === 1 && !tiles.some(isHonorTile)) {
        const counts = countById(tiles.filter((tile) => tile[0] === numberSuits[0]));
        const suit = numberSuits[0];
        let base = true;
        for (let rank = 1; rank <= 9; rank++) {
          const need = rank === 1 || rank === 9 ? 3 : 1;
          if ((counts[suit + rank] || 0) < need) base = false;
        }
        if (base && tiles.length === 14) {
          const withoutWin = Object.assign({}, counts);
          withoutWin[problem.winTile] -= 1;
          let junsei = true;
          for (let rank = 1; rank <= 9; rank++) {
            const need = rank === 1 || rank === 9 ? 3 : 1;
            if ((withoutWin[suit + rank] || 0) !== need) junsei = false;
          }
          pushYakuman(junsei ? "纯正九莲宝灯" : "九莲宝灯", junsei ? 2 : 1);
        }
      }
    }

    if (yakuman.length) return yakuman;

    const yaku = [];
    if (problem.daburu) yaku.push({ name: "两立直", han: 2 });
    else if (problem.riichi) yaku.push({ name: "立直", han: 1 });
    if (problem.ippatsu && (problem.riichi || problem.daburu)) yaku.push({ name: "一发", han: 1 });
    if (menzen && problem.isTsumo) yaku.push({ name: "门前清自摸和", han: 1 });
    if (problem.rinshan) yaku.push({ name: "岭上开花", han: 1 });
    if (problem.chankan) yaku.push({ name: "抢杠", han: 1 });
    if (problem.haitei) yaku.push({ name: "海底摸月", han: 1 });
    if (problem.houtei) yaku.push({ name: "河底捞鱼", han: 1 });

    if (problem.isChiitoi) {
      yaku.push({ name: "七对子", han: 2 });
    } else if (problem.answer && problem.answer.isPinfu) {
      yaku.push({ name: "平和", han: 1 });
    }

    if (tiles.length && tiles.every(isSimpleTile)) yaku.push({ name: "断幺九", han: 1 });

    if (!problem.isChiitoi && all.length === 4) {
      const sequences = all.filter((meld) => meld.type === "sequence");
      const sets = all.filter((meld) => meld.type !== "sequence");
      const closedSequences = closedMelds.filter((meld) => meld.type === "sequence");

      if (menzen && !yaku.some((item) => item.name === "七对子")) {
        const buckets = {};
        closedSequences.forEach((meld) => {
          const key = meld.tiles[0][0] + sequenceKey(meld);
          buckets[key] = (buckets[key] || 0) + 1;
        });
        const pairs = Object.keys(buckets).filter((key) => buckets[key] >= 2);
        const pairCount = pairs.reduce((sum, key) => sum + Math.floor(buckets[key] / 2), 0);
        if (pairCount >= 2) yaku.push({ name: "二杯口", han: 3 });
        else if (pairCount === 1) yaku.push({ name: "一杯口", han: 1 });
      }

      sets.forEach((meld) => {
        if (!meld.tile) return;
        const dragons = Number(meld.tile.slice(1)) >= 5 && meld.tile[0] === "z";
        const windN = meld.tile[0] === "z" ? Number(meld.tile.slice(1)) : 0;
        if (dragons) {
          yaku.push({ name: "役牌 " + tileLabel(meld.tile), han: 1 });
          return;
        }
        if (windN >= 1 && windN <= 4) {
          const wind = ["", "E", "S", "W", "N"][windN];
          if (wind === problem.roundWind) yaku.push({ name: "场风 " + WIND_NAME[wind], han: 1 });
          if (wind === problem.seatWind) yaku.push({ name: "自风 " + WIND_NAME[wind], han: 1 });
        }
      });

      const byRanks = {};
      sequences.forEach((meld) => {
        const key = sequenceKey(meld);
        if (!byRanks[key]) byRanks[key] = {};
        byRanks[key][meld.tiles[0][0]] = true;
      });
      Object.keys(byRanks).forEach((key) => {
        if (byRanks[key].m && byRanks[key].p && byRanks[key].s) {
          yaku.push({ name: "三色同顺", han: menzen ? 2 : 1 });
        }
      });

      const bySuit = { m: {}, p: {}, s: {} };
      sequences.forEach((meld) => {
        bySuit[meld.tiles[0][0]][sequenceKey(meld)] = true;
      });
      ["m", "p", "s"].forEach((suit) => {
        if (bySuit[suit]["123"] && bySuit[suit]["456"] && bySuit[suit]["789"]) {
          yaku.push({ name: "一气通贯", han: menzen ? 2 : 1 });
        }
      });

      const tripleRanks = {};
      sets.forEach((meld) => {
        if (!meld.tile || meld.tile[0] === "z") return;
        const rank = meld.tile.slice(1);
        if (!tripleRanks[rank]) tripleRanks[rank] = {};
        tripleRanks[rank][meld.tile[0]] = true;
      });
      Object.keys(tripleRanks).forEach((rank) => {
        if (tripleRanks[rank].m && tripleRanks[rank].p && tripleRanks[rank].s) {
          yaku.push({ name: "三色同刻", han: 2 });
        }
      });

      if (sets.length === 4) yaku.push({ name: "对对和", han: 2 });

      const closedTriples = closedMelds.filter((meld) => meld.type === "triplet").concat(ankans);
      if (closedTriples.length >= 3) yaku.push({ name: "三暗刻", han: 2 });

      const kanCount = all.filter((meld) => meld.type === "kan").length;
      if (kanCount === 3) yaku.push({ name: "三杠子", han: 2 });

      const dragonTriples = sets.filter((meld) => meld.tile && meld.tile[0] === "z" && Number(meld.tile.slice(1)) >= 5);
      if (dragonTriples.length === 2 && problem.pair && problem.pair[0] === "z" && Number(problem.pair.slice(1)) >= 5) {
        const seen = {};
        dragonTriples.forEach((meld) => {
          seen[meld.tile] = true;
        });
        if (!seen[problem.pair]) yaku.push({ name: "小三元", han: 2 });
      }

      const hasSequence = sequences.length > 0;
      const everyGroupTerminal = sets.every((meld) => isTerminalOrHonorTile(meld.tile)) && sequences.every((meld) => {
        const ranks = meld.tiles.map((tile) => Number(tile.slice(1)));
        return ranks.indexOf(1) >= 0 || ranks.indexOf(9) >= 0;
      }) && isTerminalOrHonorTile(problem.pair);
      if (everyGroupTerminal && problem.pair) {
        const anyHonor = tiles.some(isHonorTile);
        if (!hasSequence) yaku.push({ name: "混老头", han: 2 });
        else if (!anyHonor) yaku.push({ name: "纯全带幺九", han: menzen ? 3 : 2 });
        else yaku.push({ name: "混全带幺九", han: menzen ? 2 : 1 });
      }

      const suitSet = {};
      let hasHonor = false;
      tiles.forEach((tile) => {
        if (tile[0] === "z") hasHonor = true;
        else suitSet[tile[0]] = true;
      });
      const suitCount = Object.keys(suitSet).length;
      if (suitCount === 1 && hasHonor) yaku.push({ name: "混一色", han: menzen ? 3 : 2 });
      if (suitCount === 1 && !hasHonor) yaku.push({ name: "清一色", han: menzen ? 6 : 5 });
    } else if (problem.isChiitoi) {
      const suitSet = {};
      let hasHonor = false;
      tiles.forEach((tile) => {
        if (tile[0] === "z") hasHonor = true;
        else suitSet[tile[0]] = true;
      });
      const suitCount = Object.keys(suitSet).length;
      if (suitCount === 1 && hasHonor) yaku.push({ name: "混一色", han: 3 });
      if (suitCount === 1 && !hasHonor) yaku.push({ name: "清一色", han: 6 });
      if (tiles.length && tiles.every(isTerminalOrHonorTile)) yaku.push({ name: "混老头", han: 2 });
    }

    return yaku;
  }

  function doraMatches(indicators, tiles) {
    return (indicators || []).map((indicator) => {
      const dora = nextDora(indicator);
      const count = tiles.filter((tile) => tile === dora).length;
      return { indicator: indicator, dora: dora, count: count };
    });
  }

  function settleScore(problem) {
    const tiles = handTileList(problem);
    const yaku = listYaku(problem);
    const yakumanMul = yaku.reduce((sum, item) => sum + (item.yakuman || 0), 0);
    const yakuHan = yaku.reduce((sum, item) => sum + (item.yakuman ? 0 : item.han), 0);
    const aka = problem.aka || {};
    const akaHan = yakumanMul ? 0 : (aka.m5 || 0) + (aka.p5 || 0) + (aka.s5 || 0);
    const doraDetail = doraMatches(problem.doraIndicators, tiles);
    const uraDetail = problem.riichi || problem.daburu ? doraMatches(problem.uraIndicators, tiles) : [];
    const doraHan = yakumanMul ? 0 : doraDetail.reduce((sum, item) => sum + item.count, 0);
    const uraHan = yakumanMul ? 0 : uraDetail.reduce((sum, item) => sum + item.count, 0);
    let han = yakumanMul ? 13 * yakumanMul : yakuHan + doraHan + akaHan + uraHan;
    const fu = problem.answer ? problem.answer.fu : null;
    const isDealer = problem.seatWind === "E";
    const isTsumo = !!problem.isTsumo;
    const honba = problem.honba || 0;
    const sticks = problem.sticks || 0;

    let limit = "";
    let raw = 0;
    let handPoints = 0;
    let payments = [];
    let uncappedHand = 0;
    if (yakumanMul > 0) {
      limit = yakumanMul >= 2 ? "双倍役满" : "役满";
      const child = 32000 * yakumanMul;
      const dealer = 48000 * yakumanMul;
      handPoints = isDealer ? dealer : child;
      uncappedHand = handPoints;
      if (isTsumo) {
        if (isDealer) payments = [{ label: "三家各付", amount: dealer / 3 }];
        else payments = [{ label: "子家各付", amount: child / 4 }, { label: "亲家付", amount: child / 2 }];
      } else {
        payments = [{ label: "放铳", amount: handPoints }];
      }
    } else if (fu) {
      raw = fu * Math.pow(2, han + 2);
      const childRon = ceil100(raw * 4);
      const dealerRon = ceil100(raw * 6);
      uncappedHand = isDealer ? dealerRon : childRon;
      if (han >= 13) limit = "累计役满";
      else if (han >= 11) limit = "三倍满";
      else if (han >= 8) limit = "倍满";
      else if (han >= 6) limit = "跳满";
      else if (han >= 5 || raw >= 2000) limit = "满贯";
      const fixed = { "满贯": [8000, 12000], "跳满": [12000, 18000], "倍满": [16000, 24000], "三倍满": [24000, 36000], "累计役满": [32000, 48000] };
      if (limit) {
        handPoints = isDealer ? fixed[limit][1] : fixed[limit][0];
      } else {
        handPoints = uncappedHand;
      }
      if (isTsumo) {
        if (limit) {
          const base = isDealer ? fixed[limit][1] : fixed[limit][0];
          if (isDealer) payments = [{ label: "三家各付", amount: base / 3 }];
          else payments = [{ label: "子家各付", amount: base / 4 }, { label: "亲家付", amount: base / 2 }];
        } else if (isDealer) {
          payments = [{ label: "三家各付", amount: ceil100(raw * 2) }];
          handPoints = ceil100(raw * 2) * 3;
        } else {
          const childPay = ceil100(raw);
          const dealerPay = ceil100(raw * 2);
          payments = [{ label: "子家各付", amount: childPay }, { label: "亲家付", amount: dealerPay }];
          handPoints = childPay * 2 + dealerPay;
        }
      } else if (!limit) {
        payments = [{ label: "放铳", amount: handPoints }];
      } else {
        payments = [{ label: "放铳", amount: handPoints }];
      }
    }

    const honbaPoints = honba * 300;
    const stickPoints = sticks * 1000;
    const total = handPoints + honbaPoints + stickPoints;
    let tsumoPays = null;
    if (isTsumo && payments.length) {
      const extra = honba * 100;
      if (isDealer) tsumoPays = { child: payments[0].amount + extra, dealer: null };
      else tsumoPays = { child: payments[0].amount + extra, dealer: payments[1].amount + extra };
    }
    const names = yaku.map((item) => item.name);
    if (!yakumanMul && doraHan) names.push("表宝牌 " + doraHan);
    if (!yakumanMul && akaHan) names.push("红宝牌 " + akaHan);
    if (!yakumanMul && uraHan) names.push("里宝牌 " + uraHan);
    if (limit) names.push(limit);

    const paymentText = payments.map((item) => item.label + " " + item.amount).join("，");
    let formula = "";
    if (yakumanMul) {
      formula = limit + "。不计符，表宝牌、红宝牌、里宝牌都不加。" + paymentText + "。";
    } else if (limit && raw >= 2000 && han < 5) {
      formula = fu + " 符 " + han + " 番，基本点 " + raw + "，已经到满贯线。和了点 " + handPoints + "。" + paymentText + "。";
    } else if (limit) {
      formula = fu + " 符 " + han + " 番，" + limit + "。和了点 " + handPoints + "。" + paymentText + "。";
    } else if (fu) {
      formula = "基本点 = " + fu + " × 2^(" + han + "+2) = " + raw + "。" + paymentText + "。和了点 " + handPoints + "。";
    }
    if (honbaPoints) formula += "本场 " + honba + " 加 " + honbaPoints + "。";
    if (stickPoints) formula += "供托 " + stickPoints + "。";
    formula += "合计 " + total + "。";

    return {
      han: han,
      yakuHan: yakuHan,
      doraHan: doraHan,
      akaHan: akaHan,
      uraHan: uraHan,
      yaku: yaku,
      doraDetail: doraDetail,
      uraDetail: uraDetail,
      fu: fu,
      limit: limit,
      yakumanMul: yakumanMul,
      raw: raw,
      handPoints: handPoints,
      uncappedHand: uncappedHand,
      honbaPoints: honbaPoints,
      stickPoints: stickPoints,
      total: total,
      payments: payments,
      tsumoPays: tsumoPays,
      isTsumo: isTsumo,
      formula: formula,
      headline: names.join(" · "),
      isDealer: isDealer,
    };
  }

  function wallPool(tiles) {
    const pool = fullPool();
    tiles.forEach((tile) => {
      pool[tile] -= 1;
    });
    return pool;
  }

  function drawIndicator(pool) {
    const options = Object.keys(pool).filter((id) => pool[id] > 0);
    if (!options.length) return null;
    const id = pick(options);
    pool[id] -= 1;
    return id;
  }

  function applyScoreContext(problem, fixed) {
    const context = fixed || {};
    const menzen = (problem.openMelds || []).length === 0;
    const kanCount = (problem.ankans || []).length + (problem.openMelds || []).filter((meld) => meld.type === "kan").length;
    if (fixed) {
      problem.riichi = !!context.riichi;
      problem.daburu = !!context.daburu;
      problem.ippatsu = !!context.ippatsu;
      problem.rinshan = !!context.rinshan;
      problem.haitei = !!context.haitei;
      problem.houtei = !!context.houtei;
      problem.chankan = !!context.chankan;
      problem.honba = context.honba || 0;
      problem.sticks = context.sticks != null ? context.sticks : (problem.riichi || problem.daburu ? 1 : 0);
      problem.aka = context.aka || { m5: 0, p5: 0, s5: 0 };
      problem.doraIndicators = context.doraIndicators || [];
      problem.uraIndicators = (problem.riichi || problem.daburu) ? (context.uraIndicators || []) : [];
    } else {
      problem.honba = Math.random() < 0.78 ? 0 : (Math.random() < 0.8 ? 1 : 2);
      problem.riichi = false;
      problem.daburu = false;
      problem.ippatsu = false;
      problem.rinshan = false;
      problem.haitei = false;
      problem.houtei = false;
      problem.chankan = false;
      if (menzen && !problem.isKokushi && Math.random() < 0.55) {
        if (Math.random() < 0.12) problem.daburu = true;
        else problem.riichi = true;
        if (Math.random() < 0.22) problem.ippatsu = true;
      }
      if (problem.isTsumo && kanCount && Math.random() < 0.25) problem.rinshan = true;
      else if (problem.isTsumo && Math.random() < 0.08) problem.haitei = true;
      else if (!problem.isTsumo && Math.random() < 0.08) problem.chankan = true;
      else if (!problem.isTsumo && Math.random() < 0.08) problem.houtei = true;
      problem.aka = { m5: 0, p5: 0, s5: 0 };
      const tiles = handTileList(problem);
      ["m5", "p5", "s5"].forEach((id) => {
        if (tiles.indexOf(id) >= 0 && Math.random() < 0.5) problem.aka[id] = 1;
      });
      const preview = listYaku(problem).reduce((sum, item) => sum + (item.yakuman ? 13 : item.han), 0);
      if (preview < 1 && menzen) problem.riichi = true;
      if (listYaku(problem).reduce((sum, item) => sum + (item.yakuman ? 13 : item.han), 0) < 1) return false;
      const pool = wallPool(handTileList(problem));
      const indicatorCount = 1 + kanCount;
      problem.doraIndicators = [];
      problem.uraIndicators = [];
      for (let i = 0; i < indicatorCount; i++) {
        const indicator = drawIndicator(pool);
        if (indicator) problem.doraIndicators.push(indicator);
      }
      if (problem.riichi || problem.daburu) {
        for (let i = 0; i < indicatorCount; i++) {
          const indicator = drawIndicator(pool);
          if (indicator) problem.uraIndicators.push(indicator);
        }
        problem.sticks = Math.random() < 0.12 ? 2 : 1;
      } else {
        problem.sticks = 0;
      }
    }
    problem.score = settleScore(problem);
    if (!fixed) {
      problem.title = problem.score.headline;
      problem.teach = "";
    }
    problem.task = "score";
    return problem.score.han > 0 || problem.score.yakumanMul > 0;
  }

  function createScoreProblem(level) {
    for (let i = 0; i < 80; i++) {
      try {
        const problem = createProblem(level);
        if (applyScoreContext(problem)) return problem;
      } catch (err) {
        continue;
      }
    }
    const fallback = scoreExamples()[0];
    fallback.level = level;
    fallback.fallback = true;
    return fallback;
  }

  function withScore(spec) {
    const problem = spec.isKokushi ? spec.problem : assemble(spec);
    applyScoreContext(problem, spec.context);
    problem.title = spec.title;
    problem.teach = spec.teach || "";
    problem.level = spec.level || "advanced";
    return problem;
  }

  function makeKokushi(winTile, pairTile) {
    const base = ["m1", "m9", "p1", "p9", "s1", "s9", "z1", "z2", "z3", "z4", "z5", "z6", "z7"];
    const concealed = base.concat([pairTile]);
    return {
      isKokushi: true,
      isChiitoi: false,
      isTsumo: false,
      roundWind: "E",
      seatWind: "S",
      winTile: winTile,
      openMelds: [],
      ankans: [],
      closedMelds: [],
      concealed: concealed,
      pair: pairTile,
      wait: winTile === pairTile ? "tanki" : "thirteen",
      answer: { fu: null, menzen: true, isPinfu: false, groups: [], items: [], notes: [], equation: "役满不计符" },
    };
  }

  function scoreExamples() {
    const specs = [
      {
        title: "子家平和荣和",
        teach: "平和 1 番，三十符。子家荣和是 1000 点。没有立直，就不计里宝牌。",
        level: "beginner",
        roundWind: "E",
        seatWind: "S",
        isTsumo: false,
        closedMelds: [seq(["m1", "m2", "m3"]), seq(["m6", "m7", "m8"]), seq(["p1", "p2", "p3"]), seq(["s6", "s7", "s8"])],
        pair: "p9",
        winTile: "m1",
        wait: "ryanmen",
        context: { doraIndicators: ["z1"], uraIndicators: ["m5"], honba: 0, sticks: 0 },
      },
      {
        title: "亲家平和荣和",
        teach: "同一手牌换成亲家（自风东）。亲家荣和按基本点 ×6，1500 点。",
        level: "beginner",
        roundWind: "S",
        seatWind: "E",
        isTsumo: false,
        closedMelds: [seq(["m1", "m2", "m3"]), seq(["m6", "m7", "m8"]), seq(["p1", "p2", "p3"]), seq(["s6", "s7", "s8"])],
        pair: "p9",
        winTile: "m1",
        wait: "ryanmen",
        context: { doraIndicators: ["z1"], honba: 0, sticks: 0 },
      },
      {
        title: "子家平和自摸",
        teach: "平和加门前清自摸和，共 2 番 20 符。子家支付 400，亲家支付 700，合计 1500。",
        level: "beginner",
        roundWind: "E",
        seatWind: "W",
        isTsumo: true,
        closedMelds: [seq(["s1", "s2", "s3"]), seq(["s6", "s7", "s8"]), seq(["p2", "p3", "p4"]), seq(["m6", "m7", "m8"])],
        pair: "p5",
        winTile: "m8",
        wait: "ryanmen",
        context: { doraIndicators: ["z1"], honba: 0, sticks: 0 },
      },
      {
        title: "四番三十符不是满贯",
        teach: "立直、一发、断幺、平和，共 4 番 30 符。子家荣和 7700，再加自己的立直棒 1000。不到满贯。",
        level: "intermediate",
        roundWind: "E",
        seatWind: "S",
        isTsumo: false,
        closedMelds: [seq(["m2", "m3", "m4"]), seq(["p6", "p7", "p8"]), seq(["s2", "s3", "s4"]), seq(["s6", "s7", "s8"])],
        pair: "p5",
        winTile: "m4",
        wait: "ryanmen",
        context: {
          riichi: true,
          ippatsu: true,
          sticks: 1,
          doraIndicators: ["z1"],
          uraIndicators: ["z2"],
          honba: 0,
        },
      },
      {
        title: "红五筒兼表宝牌",
        teach: "平和、断幺是 2 番。两张五筒都是表宝牌，其中一张红五筒再加 1 番。合计 5 番满贯，子家荣和 8000。",
        level: "advanced",
        roundWind: "E",
        seatWind: "S",
        isTsumo: false,
        closedMelds: [seq(["m2", "m3", "m4"]), seq(["m6", "m7", "m8"]), seq(["s2", "s3", "s4"]), seq(["s6", "s7", "s8"])],
        pair: "p5",
        winTile: "m2",
        wait: "ryanmen",
        context: {
          aka: { m5: 0, p5: 1, s5: 0 },
          doraIndicators: ["p4"],
          honba: 0,
          sticks: 0,
        },
      },
      {
        title: "立直才计里宝牌",
        teach: "平和、立直，里宝牌是六万，手牌有一张。共 3 番 30 符，子家荣和 3900，加上供托 1000。",
        level: "advanced",
        roundWind: "E",
        seatWind: "S",
        isTsumo: false,
        closedMelds: [seq(["m1", "m2", "m3"]), seq(["m6", "m7", "m8"]), seq(["p1", "p2", "p3"]), seq(["s6", "s7", "s8"])],
        pair: "p9",
        winTile: "m1",
        wait: "ryanmen",
        context: {
          riichi: true,
          sticks: 1,
          doraIndicators: ["z1"],
          uraIndicators: ["m5"],
          honba: 0,
        },
      },
      {
        title: "四十符四番满贯",
        teach: "役牌白、立直，表宝牌是九条，雀头有两张。4 番 40 符，基本点已到满贯线。子家荣和 8000，加供托 1000。",
        level: "advanced",
        roundWind: "E",
        seatWind: "S",
        isTsumo: false,
        closedMelds: [tri("z5", false), seq(["m1", "m2", "m3"]), seq(["m6", "m7", "m8"]), seq(["p1", "p2", "p3"])],
        pair: "s9",
        winTile: "m8",
        wait: "ryanmen",
        context: {
          riichi: true,
          sticks: 1,
          doraIndicators: ["s8"],
          uraIndicators: ["s2"],
          honba: 0,
        },
      },
      {
        title: "本场加分",
        teach: "平和 1 番 1000 点，一本场再加 300，合计 1300。本场不改变番数。",
        level: "beginner",
        roundWind: "E",
        seatWind: "S",
        isTsumo: false,
        closedMelds: [seq(["m1", "m2", "m3"]), seq(["m6", "m7", "m8"]), seq(["p1", "p2", "p3"]), seq(["s6", "s7", "s8"])],
        pair: "p9",
        winTile: "m1",
        wait: "ryanmen",
        context: { doraIndicators: ["z1"], honba: 1, sticks: 0 },
      },
    ];
    const examples = specs.map(withScore);
    const kokushi = makeKokushi("m1", "z5");
    applyScoreContext(kokushi, { doraIndicators: ["m2"], honba: 0, sticks: 0, aka: { m5: 0, p5: 0, s5: 0 } });
    kokushi.title = "国士无双";
    kokushi.teach = "国士无双是役满。子家荣和 32000。役满不再加表宝牌或红宝牌。";
    kokushi.level = "advanced";
    examples.push(kokushi);
    return examples;
  }

  function evaluateScoreGuess(score, fuGuess, hanGuess, pointGuess, answer, childPayGuess, dealerPayGuess) {
    const fuOk = score.fu == null || fuGuess === score.fu;
    const hanOk = hanGuess === score.han;
    const pointOk = pointGuess === score.total;
    const pays = score.tsumoPays;
    const payOk = !pays || (childPayGuess === pays.child && (pays.dealer == null || dealerPayGuess === pays.dealer));
    const hints = [];
    if (!fuOk) {
      const fuJudged = answer ? evaluateGuess(answer, fuGuess) : { hints: [] };
      hints.push(fuJudged.hints[0] || ("符数是 " + score.fu + "。先把符算对，再用它算得点。"));
    } else if (!hanOk) {
      if (score.yakumanMul > 0) {
        hints.push(score.yakumanMul >= 2 ? "这是双倍役满，番数按 26 计。宝牌不加在役满上。" : "这是役满，番数按 13 计。宝牌不加在役满上。");
      } else if (hanGuess === score.yakuHan && score.han !== score.yakuHan) {
        hints.push("役种是 " + score.yakuHan + " 番。表宝牌 " + score.doraHan + "、红宝牌 " + score.akaHan + "、里宝牌 " + score.uraHan + "，合计 " + score.han + " 番。");
      } else if (score.uraHan > 0 && hanGuess === score.han - score.uraHan) {
        hints.push("立直和牌要计算里宝牌。指示牌的下一张才是宝牌。");
      } else if (score.akaHan > 0 && hanGuess === score.han - score.akaHan) {
        hints.push("红五万、红五筒、红五条每张另加 1 番，和表宝牌分开算。红五如果同时又是表宝牌，两份都算。");
      }
    } else if (!pointOk) {
      if (pointGuess === score.handPoints && score.total !== score.handPoints) {
        hints.push("和了点是 " + score.handPoints + "。还要加本场 " + score.honbaPoints + " 和供托 " + score.stickPoints + "。");
      } else if (pointGuess === score.uncappedHand && score.limit) {
        hints.push("按公式可以乘到 " + score.uncappedHand + "，但这手已经是" + score.limit + "，和了点是 " + score.handPoints + "。");
      } else if (score.limit) {
        hints.push("番数对了。这手是" + score.limit + "，和了点 " + score.handPoints + "，再加本场和供托。");
      } else {
        hints.push("番数对了。得点先算符 × 2^(番+2)，荣和或自摸之后进到百位。");
      }
    } else if (!payOk) {
      const extra = score.honbaPoints ? "，本场每家另加 " + (score.honbaPoints / 3) : "";
      if (pays.dealer == null) {
        hints.push("亲家自摸，三家子各付 " + pays.child + extra + "。供托不由各家付。");
      } else {
        hints.push("子家自摸，子家各付 " + pays.child + "，亲家付 " + pays.dealer + extra + "。供托不由各家付。");
      }
    }
    return { correct: fuOk && hanOk && pointOk && payOk, fuOk: fuOk, hanOk: hanOk, pointOk: pointOk, payOk: payOk, hints: hints };
  }

  return {
    WIND_NAME: WIND_NAME,
    WIND_TILE: WIND_TILE,
    WAIT_NAME: WAIT_NAME,
    LEVELS: LEVELS,
    tileLabel: tileLabel,
    compareTiles: compareTiles,
    sequenceWait: sequenceWait,
    pairInfo: pairInfo,
    scoreHand: scoreHand,
    allDecompositions: allDecompositions,
    exampleProblems: exampleProblems,
    createProblem: createProblem,
    createScoreProblem: createScoreProblem,
    scoreExamples: scoreExamples,
    nextDora: nextDora,
    listYaku: listYaku,
    settleScore: settleScore,
    evaluateScoreGuess: evaluateScoreGuess,
    layoutHand: layoutHand,
    evaluateGuess: evaluateGuess,
    expandTiles: expandTiles,
  };
});
