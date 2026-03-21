import test from "node:test";
import assert from "node:assert";
import { generateCuadro, advanceWinnerToNextMatch } from "../src/domain/draws.js";
import { computeGroupStandings } from "../src/domain/roundRobin.js";

test("generateCuadro correctly positions top 2 seeds opposite to each other", () => {
    const participants = [
        { userId: "player_1", seedRank: 1, registrationOrder: 1 },
        { userId: "player_2", seedRank: 2, registrationOrder: 2 },
        { userId: "player_3", seedRank: null, registrationOrder: 3 },
        { userId: "player_4", seedRank: null, registrationOrder: 4 },
    ];

    const result = generateCuadro(participants, 2, 4);
    assert.strictEqual(result.bracketSize, 4);
    assert.strictEqual(result.slots[0], "player_1");
    assert.strictEqual(result.slots[3], "player_2");
});

test("generateCuadro sizes bracket correctly and pads with BYEs", () => {
    const participants = [
        { userId: "p1", seedRank: 1, registrationOrder: 1 },
        { userId: "p2", seedRank: 2, registrationOrder: 2 },
        { userId: "p3", seedRank: 3, registrationOrder: 3 },
    ];

    const result = generateCuadro(participants, 4);
    assert.strictEqual(result.bracketSize, 4);
    const byesCount = result.slots.filter((s) => s === "BYE").length;
    assert.strictEqual(byesCount, 1);
});

test("advanceWinnerToNextMatch advances correctly in a simple bracket", () => {
    const matches = [
        { round: 1, matchNumber: 1, player1Id: "p1", player2Id: "p2", winnerId: "p1", status: "COMPLETED" as const, scoreJson: null },
        { round: 1, matchNumber: 2, player1Id: "p3", player2Id: "p4", winnerId: "p4", status: "COMPLETED" as const, scoreJson: null },
        { round: 2, matchNumber: 1, player1Id: null, player2Id: null, winnerId: null, status: "PENDING" as const, scoreJson: null }
    ];

    let nextState = advanceWinnerToNextMatch(matches, 1, 1, "p1");
    assert.strictEqual(nextState[2].player1Id, "p1");
    assert.strictEqual(nextState[2].status, "PENDING"); // Waiting for player 2

    nextState = advanceWinnerToNextMatch(nextState, 1, 2, "p4");
    assert.strictEqual(nextState[2].player2Id, "p4");
    assert.strictEqual(nextState[2].status, "READY"); // Both players advanced
});

test("computeGroupStandings correctly computes sets and matches won", () => {
    const group = {
        name: "Group A",
        members: [
            { userId: "p1", seedRank: null, registrationOrder: 1 },
            { userId: "p2", seedRank: null, registrationOrder: 2 },
            { userId: "p3", seedRank: null, registrationOrder: 3 },
        ]
    };

    const matches = [
        {
            groupName: "Group A",
            player1Id: "p1",
            player2Id: "p2",
            winnerId: "p1",
            status: "COMPLETED" as const,
            scoreJson: {
                sets: [
                    { p1_games: 6, p2_games: 4 },
                    { p1_games: 6, p2_games: 2 }
                ]
            }
        }
    ];

    const standings = computeGroupStandings(group, matches);

    // p1 should have 1 win, +2 sets (won 2, lost 0), +6 games (12 won, 6 lost)
    const p1Standing = standings.find(s => s.userId === "p1");
    assert.strictEqual(p1Standing?.wins, 1);
    assert.strictEqual(p1Standing?.setDiff, 2);
    assert.strictEqual(p1Standing?.gameDiff, 6);

    // p2 should have 0 wins, -2 sets, -6 games
    const p2Standing = standings.find(s => s.userId === "p2");
    assert.strictEqual(p2Standing?.wins, 0);
    assert.strictEqual(p2Standing?.setDiff, -2);
    assert.strictEqual(p2Standing?.gameDiff, -6);
});
