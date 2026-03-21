import test from "node:test";
import assert from "node:assert";
import { selectRuleForPlayers, pointsForPosition, RankingRule } from "../src/domain/ranking.js";

test("selectRuleForPlayers selects the correct rule based on category and player count", () => {
    const rules: RankingRule[] = [
        { categoryLevel: "Primera", minPlayers: 4, maxPlayers: 8, pointsByPosition: { "1": 100, "2": 50 } },
        { categoryLevel: "Primera", minPlayers: 9, maxPlayers: null, pointsByPosition: { "1": 200, "2": 100 } },
        { categoryLevel: "Segunda", minPlayers: 4, maxPlayers: 8, pointsByPosition: { "1": 80, "2": 40 } },
    ];

    const rule1 = selectRuleForPlayers(rules, "Primera", 6);
    assert.strictEqual(rule1?.minPlayers, 4);

    const rule2 = selectRuleForPlayers(rules, "Primera", 10);
    assert.strictEqual(rule2?.minPlayers, 9);

    const rule3 = selectRuleForPlayers(rules, "Segunda", 5);
    assert.strictEqual(rule3?.categoryLevel, "Segunda");

    const rule4 = selectRuleForPlayers(rules, "Tercera", 5);
    assert.strictEqual(rule4, null);

    const rule5 = selectRuleForPlayers(rules, "Primera", 2);
    assert.strictEqual(rule5, null);
});

test("pointsForPosition correctly assigns points according to the rule", () => {
    const rule: RankingRule = { categoryLevel: "Primera", minPlayers: 4, maxPlayers: 8, pointsByPosition: { "1": 100, "2": 50, "3": 25 } };

    assert.strictEqual(pointsForPosition(rule, 1), 100);
    assert.strictEqual(pointsForPosition(rule, 2), 50);
    assert.strictEqual(pointsForPosition(rule, 3), 25);
    assert.strictEqual(pointsForPosition(rule, 4), 0); // Not defined in rule
    assert.strictEqual(pointsForPosition(null, 1), 0); // Null rule
});
